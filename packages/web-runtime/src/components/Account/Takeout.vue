<template>
  <div>
    <span v-if="loading">
      <oc-spinner />
    </span>
    <div
      v-else-if="takeoutInProgress"
      class="oc-flex oc-flex-middle oc-flex-right"
      role="status"
      data-testid="takeout-in-process"
    >
      <oc-spinner size="xsmall" aria-hidden="true" />
      <span class="oc-ml-xs" v-text="statusMessage" v-oc-tooltip="statusHint" />
      <oc-button
        v-if="cancellable"
        appearance="raw"
        variation="primary"
        class="oc-ml-m"
        :disabled="cancelPending"
        data-testid="takeout-cancel-btn"
        @click="cancelTakeout"
      >
        <div class="oc-flex oc-flex-middle">
          <oc-icon name="close-circle" fill-type="line" size="small" />
          <span class="oc-ml-xs" v-text="$gettext('Cancel')" />
        </div>
      </oc-button>
    </div>
    <div v-else class="oc-flex oc-flex-middle oc-flex-right">
      <div
        v-if="recentlyCompleted"
        v-oc-tooltip="finishedAtExact"
        class="oc-flex oc-flex-middle"
        data-testid="takeout-last-run"
      >
        <oc-icon name="mail-send" fill-type="line" size="small" variation="success" />
        <template v-if="userEmail">
          <span class="oc-ml-xs" v-text="$gettext('Export sent to')" />
          <span class="oc-ml-xs oc-text-bold oc-text-break" v-text="userEmail" />
        </template>
        <span v-else class="oc-ml-xs" v-text="$gettext('Your export is ready')" />
      </div>

      <template v-else>
        <oc-button
          id="takeout-export-toggle"
          appearance="raw"
          variation="primary"
          data-testid="takeout-export-btn"
        >
          <div class="oc-flex oc-flex-middle">
            <oc-icon name="archive" fill-type="line" size="small" />
            <span class="oc-ml-xs" v-text="$gettext('Export your files')" />
          </div>
        </oc-button>
        <oc-drop
          ref="takeoutDrop"
          drop-id="takeout-options-drop"
          toggle="#takeout-export-toggle"
          mode="click"
          padding-size="medium"
          position="bottom-end"
          :close-on-click="false"
        >
          <div class="oc-mb-m">
            <oc-select
              :model-value="selectedFormat"
              :label="$gettext('Archive format')"
              :clearable="false"
              :options="formatOptions"
              class="oc-mb-s"
              @update:model-value="(value) => (selectedFormat = value)"
            />
            <oc-select
              :model-value="selectedSize"
              :label="$gettext('Maximum archive size')"
              :clearable="false"
              :options="sizeOptions"
              @update:model-value="(value) => (selectedSize = value)"
            />
            <p
              class="oc-mt-s oc-text-small"
              v-text="
                $gettext(
                  'The maximum archive size is a soft limit, archives may be larger or smaller.'
                )
              "
            />
            <div class="oc-flex oc-flex-right oc-mt-m">
              <oc-button
                variation="primary"
                appearance="filled"
                :disabled="requestPending"
                data-testid="takeout-start-btn"
                @click="requestTakeout"
              >
                <span v-text="$gettext('Start export')" />
              </oc-button>
            </div>
          </div>
        </oc-drop>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, unref } from 'vue'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'
import { DateTime } from 'luxon'
import {
  useClientService,
  useMessages,
  useModals,
  useUserStore,
  formatDateFromISO
} from '@ownclouders/web-pkg'
import { call } from '@ownclouders/web-client'

type TakeoutState = 'queued' | 'running' | 'failed' | 'succeeded' | 'cancelling' | 'cancelled'

interface TakeoutStatus {
  run_id?: string
  state: TakeoutState
  enqueued_at?: string
  started_at?: string
  finished_at?: string
}

interface SelectOption<T> {
  label: string
  value: T
}

const TAKEOUT_ENDPOINT = '/takeout'
const ACTIVE_STATES: TakeoutState[] = ['queued', 'running', 'failed', 'cancelling']
const CANCELLABLE_STATES: TakeoutState[] = ['queued', 'running', 'failed']
const POLL_DELAY = 60000
const POLL_DELAY_FAST = 5000

const isCancellation = (e: any) => e?.code === 'ERR_CANCELED' || e?.name === 'AbortError'

const unhandledState = (state: never): string => {
  console.error(`Unhandled takeout state: ${state}`)
  return ''
}

export default defineComponent({
  name: 'TakeoutExport',
  setup() {
    const { showMessage, showErrorMessage } = useMessages()
    const language = useGettext()
    const { $gettext } = language
    const { dispatchModal } = useModals()
    const clientService = useClientService()
    const userStore = useUserStore()

    const loading = ref(true)
    const requestPending = ref(false)
    const cancelPending = ref(false)
    const status = ref<TakeoutStatus>()
    const takeoutDrop = ref()

    const pollTimer = ref<ReturnType<typeof setTimeout>>()

    const formatOptions: SelectOption<string>[] = [
      { label: $gettext('ZIP (.zip)'), value: 'zip' },
      { label: $gettext('Tarball (.tar.gz)'), value: 'tgz' }
    ]
    const sizeOptions: SelectOption<number>[] = [
      { label: $gettext('%{size} GB', { size: '1' }), value: 1 },
      { label: $gettext('%{size} GB', { size: '2' }), value: 2 },
      { label: $gettext('%{size} GB', { size: '5' }), value: 5 },
      { label: $gettext('%{size} GB', { size: '10' }), value: 10 }
    ]
    const selectedFormat = ref<SelectOption<string>>(formatOptions[0])
    const selectedSize = ref<SelectOption<number>>(sizeOptions[1])

    const showTakeoutError = (title: string, error: unknown) => {
      const runId = unref(status)?.run_id
      showErrorMessage({
        title,
        errors: [error],
        ...(runId && { errorLogContent: `Job ID: ${runId}` })
      })
    }

    const stopPolling = () => {
      clearTimeout(unref(pollTimer))
      pollTimer.value = undefined
    }

    const pollDelay = () => (unref(status)?.state === 'running' ? POLL_DELAY : POLL_DELAY_FAST)

    const schedulePoll = () => {
      clearTimeout(unref(pollTimer))
      if (document.hidden) {
        return
      }
      pollTimer.value = setTimeout(() => loadStatusTask.perform(), pollDelay())
    }

    const awaitingRun = computed(() => {
      const s = unref(status)
      return s?.state === 'queued' && !s.run_id
    })

    const takeoutInProgress = computed(() => {
      const s = unref(status)
      return !!s && ACTIVE_STATES.includes(s.state)
    })

    const cancellable = computed(() => {
      const s = unref(status)
      return !!s && CANCELLABLE_STATES.includes(s.state)
    })

    const loadStatusTask = useTask(function* (signal) {
      try {
        const { data } = yield* call(
          clientService.httpAuthenticated.get<TakeoutStatus>(TAKEOUT_ENDPOINT, { signal })
        )

        status.value = data
      } catch (e) {
        if (isCancellation(e)) {
          return
        }

        // A 404 means there is no run. Right after a request the run may not be
        // registered yet, so the optimistic status is kept until it shows up.
        if (e.response?.status === 404 && !unref(awaitingRun)) {
          status.value = undefined
        } else {
          // Anything else is transient, keep the last known status and retry
          console.error(e)
        }
      } finally {
        loading.value = false
      }

      if (unref(takeoutInProgress)) {
        schedulePoll()
      } else {
        stopPolling()
      }
    }).restartable()

    const recentlyCompleted = computed(() => {
      const s = unref(status)
      if (s?.state !== 'succeeded' || !s.finished_at) {
        return false
      }
      return DateTime.fromISO(s.finished_at).hasSame(DateTime.now(), 'day')
    })

    const coarseRelativeTime = (iso: string): string => {
      const then = DateTime.fromISO(iso)
      if (Math.abs(then.diffNow('minutes').minutes) < 1) {
        return $gettext('just now')
      }
      return then.toRelative({ locale: language.current, unit: ['days', 'hours', 'minutes'] })
    }

    const statusMessage = computed(() => {
      const s = unref(status)
      if (!s) {
        return ''
      }
      switch (s.state) {
        case 'queued':
          return $gettext('Waiting to start…')
        case 'running':
          return s.started_at
            ? $gettext('In progress… Started %{when}', { when: coarseRelativeTime(s.started_at) })
            : $gettext('In progress…')
        case 'failed':
          return $gettext('Something went wrong, retrying shortly…')
        case 'cancelling':
          return $gettext('Cancelling…')
        case 'succeeded':
        case 'cancelled':
          return ''
        default:
          return unhandledState(s.state)
      }
    })

    const statusHint = computed(() => {
      return unref(status)?.state === 'cancelling'
        ? $gettext('The export will stop shortly')
        : $gettext('You will receive an email once the export is ready')
    })

    const userEmail = computed(() => userStore.user?.mail)

    const finishedAtExact = computed(() => {
      const s = unref(status)
      return s?.finished_at ? formatDateFromISO(s.finished_at, language.current) : ''
    })

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
        return
      }
      if (unref(takeoutInProgress)) {
        loadStatusTask.perform()
      }
    }

    const requestTakeout = async () => {
      requestPending.value = true
      try {
        await clientService.httpAuthenticated.post(TAKEOUT_ENDPOINT, {
          archive_format: unref(selectedFormat).value,
          max_archive_size: unref(selectedSize).value * 10 ** 9 // In GB, bitshifts overflow
        })

        status.value = { state: 'queued' }
        schedulePoll()

        unref(takeoutDrop)?.hide()
        showMessage({
          title: $gettext('Export requested'),
          desc: $gettext(
            'You will get an email once the export is ready, you can safely close this page.'
          )
        })
      } catch (e) {
        console.error(e)
        showTakeoutError($gettext('Takeout export could not be requested'), e)
      } finally {
        requestPending.value = false
      }
    }

    const performCancel = async () => {
      cancelPending.value = true
      loadStatusTask.cancelAll()
      stopPolling()
      try {
        const { data } =
          await clientService.httpAuthenticated.delete<TakeoutStatus>(TAKEOUT_ENDPOINT)

        status.value = data
      } catch (e) {
        console.error(e)
        showTakeoutError($gettext('Takeout export could not be cancelled'), e)
      } finally {
        cancelPending.value = false
        if (unref(takeoutInProgress)) {
          schedulePoll()
        }
      }
    }

    const cancelTakeout = () => {
      dispatchModal({
        variation: 'warning',
        icon: 'alert',
        title: $gettext('Cancel the export'),
        message: $gettext('All progress made so far will be lost.'),
        confirmText: $gettext('Cancel export'),
        cancelText: $gettext('Continue export'),
        onConfirm: performCancel
      })
    }

    onMounted(() => {
      loadStatusTask.perform()
      document.addEventListener('visibilitychange', onVisibilityChange)
    })

    onUnmounted(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopPolling()
      loadStatusTask.cancelAll()
    })

    return {
      loading,
      loadStatusTask,
      status,
      requestPending,
      cancelPending,
      takeoutDrop,
      formatOptions,
      sizeOptions,
      selectedFormat,
      selectedSize,
      takeoutInProgress,
      cancellable,
      recentlyCompleted,
      statusMessage,
      statusHint,
      userEmail,
      finishedAtExact,
      requestTakeout,
      cancelTakeout
    }
  }
})
</script>
