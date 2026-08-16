<template>
  <iframe
    v-if="appUrl && method === 'GET'"
    ref="appIframe"
    :src="appUrl"
    class="oc-width-1-1 oc-height-1-1"
    :title="iFrameTitle"
    allowfullscreen
    allow="camera; clipboard-read *; clipboard-write *"
  />
  <div v-if="appUrl && method === 'POST' && formParameters" class="oc-height-1-1 oc-width-1-1">
    <form :action="appUrl" target="app-iframe" method="post">
      <input ref="subm" type="submit" :value="formParameters" class="oc-hidden" />
      <div v-for="(item, key, index) in formParameters" :key="index">
        <input :name="key" :value="item" type="hidden" />
      </div>
    </form>
    <iframe
      ref="appIframe"
      name="app-iframe"
      :src="appUrl"
      class="oc-width-1-1 oc-height-1-1"
      :title="iFrameTitle"
      allowfullscreen
      allow="camera; clipboard-read *; clipboard-write *"
    />
  </div>
</template>

<script lang="ts" setup>
import { stringify } from 'qs'
import {
  computed,
  inject,
  unref,
  nextTick,
  ref,
  toRef,
  watch,
  VNodeRef,
  onMounted,
  onBeforeUnmount,
  type Ref
} from 'vue'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'

import { Resource, SpaceResource } from '@ownclouders/web-client'
import { urlJoin } from '@ownclouders/web-client'
import {
  useCapabilityStore,
  useConfigStore,
  useEmbedMode,
  useMessages,
  useRequest,
  useAppProviderService,
  useRoute,
  useRouter,
  queryItemAsString,
  useRouteQuery,
  useThemeStore,
  isSameResource
} from '@ownclouders/web-pkg'
import {
  isProjectSpaceResource,
  isPublicSpaceResource,
  isShareSpaceResource
} from '@ownclouders/web-client'
import { useOfficePostMessageRegistry } from './composables'

type ExtendedNavigator = Navigator & {
  userAgentData?: {
    mobile: boolean
    platform: string
    brands: { brand: string; version: string }[]
  }
}

interface Props {
  space: SpaceResource
  resource: Resource
  isReadOnly: boolean
}
const props = defineProps<Props>()
const language = useGettext()
const { $gettext } = language
const { showErrorMessage } = useMessages()
const capabilityStore = useCapabilityStore()
const configStore = useConfigStore()
const route = useRoute()
const router = useRouter()
const appProviderService = useAppProviderService()
const { makeRequest } = useRequest()
const { isEnabled: isEmbedModeEnabled } = useEmbedMode()
const themeStore = useThemeStore()

const viewModeQuery = useRouteQuery('view_mode')
const isMobileWidth =
  inject<Ref<boolean>>('isMobileWidth') || (navigator as ExtendedNavigator).userAgentData?.mobile
const viewModeQueryValue = computed(() => {
  return queryItemAsString(unref(viewModeQuery))
})

const templateIdQuery = useRouteQuery('templateId')
const templateIdQueryValue = computed(() => {
  return queryItemAsString(unref(templateIdQuery))
})

const appName = computed(() => {
  const lowerCaseAppName = unref(route)
    .name.toString()
    .replace('external-', '')
    .replace('-apps', '')
  return appProviderService.appNames.find((appName) => appName.toLowerCase() === lowerCaseAppName)
})

// The grouped Save-As control is a Collabora-specific WOPI extension; other app
// providers don't implement it.
const isCollabora = computed(() => unref(appName) === 'Collabora')

const appUrl = ref()
const formParameters = ref({})
const method = ref()
const subm: VNodeRef = ref()
const appIframe = ref<HTMLIFrameElement>()

// Origin of the editor (e.g. the Collabora host) used as the target origin when
// posting messages into the iframe. Resolved against the current origin so a
// relative `app_url` (WOPI server co-hosted with the web app) still yields a
// usable origin instead of permanently failing the postMessage origin check.
const appOrigin = computed(() => {
  try {
    return new URL(unref(appUrl), window.location.origin).origin
  } catch {
    return ''
  }
})

// Collabora exposes "Save As" (export to another format, saved back to storage
// via WOPI PutRelativeFile) as a host-delegated operation: it shows a grouped
// Save-As control and posts a `UI_SaveAs` message, expecting the host to reply
// with the target filename. Request that grouped control via `ui_defaults`,
// which is a semicolon-delimited list, so append rather than overwrite it in
// case the server already decorates the URL with its own defaults.
const withSaveAsUiDefaults = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl)
    const existing = url.searchParams.get('ui_defaults')
    url.searchParams.set(
      'ui_defaults',
      existing ? `${existing};SaveAsMode=group` : 'SaveAsMode=group'
    )
    return url.href
  } catch {
    return rawUrl
  }
}

const iFrameTitle = computed(() => {
  return $gettext('"%{appName}" app content area', {
    appName: unref(appName)
  })
})

const errorPopup = (error: string) => {
  showErrorMessage({
    title: $gettext('An error occurred'),
    desc: error,
    errors: [new Error(error)]
  })
}

const loadAppUrl = useTask(function* (signal, viewMode: string) {
  try {
    if (props.isReadOnly && viewMode === 'write') {
      showErrorMessage({ title: $gettext('Cannot open file in edit mode as it is read-only') })
      return
    }

    const fileId = props.resource.fileId
    const baseUrl = urlJoin(configStore.serverUrl, capabilityStore.filesAppProviders[0].open_url)

    const query = stringify({
      file_id: fileId,
      lang: language.current,
      ui_theme: themeStore.currentTheme.isDark ? 'dark' : 'light',
      mobile: unref(isMobileWidth) ? 1 : 0,
      ...(unref(appName) && { app_name: encodeURIComponent(unref(appName)) }),
      ...(viewMode && { view_mode: viewMode }),
      ...(unref(templateIdQueryValue) && { template_id: unref(templateIdQueryValue) })
    })

    const url = `${baseUrl}?${query}`
    const response = yield makeRequest('POST', url, {
      validateStatus: () => true,
      signal
    })

    if (response.status !== 200) {
      switch (response.status) {
        case 425:
          errorPopup(
            $gettext(
              'This file is currently being processed and is not yet available for use. Please try again shortly.'
            )
          )
          break
        default:
          errorPopup(response.data?.message)
      }

      throw new Error('Error fetching app information')
    }

    if (!response.data.app_url || !response.data.method) {
      throw new Error('Error in app server response')
    }

    appUrl.value = unref(isCollabora)
      ? withSaveAsUiDefaults(response.data.app_url)
      : response.data.app_url
    method.value = response.data.method

    if (response.data.form_parameters) {
      formParameters.value = response.data.form_parameters
    }

    if (method.value === 'POST' && formParameters.value) {
      yield nextTick()
      unref(subm).click()
    }
  } catch (e) {
    console.error('web-app-external error', e)
    throw e
  }
}).restartable()

const determineOpenAsPreview = (appName: string) => {
  const openAsPreview = configStore.options.editor.openAsPreview
  return openAsPreview === true || (Array.isArray(openAsPreview) && openAsPreview.includes(appName))
}

const {
  register: registerOfficePostMessageHandler,
  unregister: unregisterOfficePostMessageHandler,
  handleMessage: handleOfficePostMessage,
  notifyResourceChanged: notifyOfficePostMessageResourceChanged,
  hasPendingMentions: hasPendingOfficeMentions
} = useOfficePostMessageRegistry(appName, {
  space: toRef(props, 'space'),
  resource: toRef(props, 'resource'),
  appIframeRef: appIframe,
  switchToWriteMode: () => loadAppUrl.perform('write')
})

// Fail closed: reject every message until the editor origin is known (i.e. `appUrl`
// has resolved) and accept only messages from that exact origin. The listener is
// attached on mount, before the WOPI `open_url` POST resolves, so an empty
// `appOrigin` must reject rather than wave messages through.
const catchOfficePostMessage = (event: MessageEvent) => {
  if (!unref(appOrigin) || event.origin !== unref(appOrigin)) {
    return
  }
  handleOfficePostMessage(event)
}

// warns before leaving the tab if @mentions are queued but not yet flushed to
// notifyMentionedUsers - can't block/wait for the flush itself, browsers don't allow that,
// this only gives the user a chance to cancel and let it happen naturally
const warnAboutPendingMentions = (event: BeforeUnloadEvent) => {
  if (!unref(hasPendingOfficeMentions)) {
    return
  }
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('message', catchOfficePostMessage)
  window.addEventListener('beforeunload', warnAboutPendingMentions)
  registerOfficePostMessageHandler()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', catchOfficePostMessage)
  window.removeEventListener('beforeunload', warnAboutPendingMentions)
  unregisterOfficePostMessageHandler()
})

watch(
  [props.resource],
  ([newResource], [oldResource]) => {
    if (isSameResource(newResource, oldResource)) {
      return
    }

    notifyOfficePostMessageResourceChanged()

    let viewMode = 'view'

    if (unref(isEmbedModeEnabled)) {
      viewMode = 'embedded'
    } else if (!props.isReadOnly) {
      viewMode = unref(viewModeQueryValue) || 'write'
    }

    if (
      determineOpenAsPreview(unref(appName)) &&
      (isShareSpaceResource(props.space) ||
        isPublicSpaceResource(props.space) ||
        isProjectSpaceResource(props.space))
    ) {
      viewMode = 'preview'
    }
    loadAppUrl.perform(viewMode)
  },
  { immediate: true, deep: true }
)
</script>
