<template>
  <iframe
    v-if="appUrl && method === 'GET'"
    :src="appUrl"
    class="oc-width-1-1 oc-height-1-1"
    :title="iFrameTitle"
    allowfullscreen
    allow="camera"
  />
  <div v-if="appUrl && method === 'POST' && formParameters" class="oc-height-1-1 oc-width-1-1">
    <form :action="appUrl" target="app-iframe" method="post">
      <input ref="subm" type="submit" :value="formParameters" class="oc-hidden" />
      <div v-for="(item, key, index) in formParameters" :key="index">
        <input :name="key" :value="item" type="hidden" />
      </div>
    </form>
    <iframe
      name="app-iframe"
      class="oc-width-1-1 oc-height-1-1"
      :title="iFrameTitle"
      allowfullscreen
      allow="camera"
    />
  </div>
</template>

<script lang="ts">
import { stringify } from 'qs'
import {
  PropType,
  computed,
  defineComponent,
  unref,
  nextTick,
  ref,
  watch,
  VNodeRef,
  onMounted
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
  queryItemAsString,
  useRouteQuery
} from '@ownclouders/web-pkg'
import {
  isProjectSpaceResource,
  isPublicSpaceResource,
  isShareSpaceResource
} from '@ownclouders/web-client'

export default defineComponent({
  name: 'ExternalApp',
  props: {
    space: { type: Object as PropType<SpaceResource>, required: true },
    resource: { type: Object as PropType<Resource>, required: true },
    isReadOnly: { type: Boolean, required: true }
  },
  setup(props) {
    const language = useGettext()
    const { $gettext } = language
    const { showErrorMessage } = useMessages()
    const capabilityStore = useCapabilityStore()
    const configStore = useConfigStore()
    const route = useRoute()
    const appProviderService = useAppProviderService()
    const { makeRequest } = useRequest()
    const { isEnabled: isEmbedModeEnabled } = useEmbedMode()

    const viewModeQuery = useRouteQuery('view_mode')
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
      return appProviderService.appNames.find(
        (appName) => appName.toLowerCase() === lowerCaseAppName
      )
    })

    const appUrl = ref()
    const formParameters = ref({})
    const method = ref()
    const subm: VNodeRef = ref()

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

    const successfulLoad = ref(false)
    const isAlertClosed = computed(() => {
      return localStorage.getItem('officeAlertClosed')
    })

    const removeAlertOnSuccessfulLoad = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.MessageId === 'Wac_AppBootState') {
        successfulLoad.value = true
        if (document.getElementById('office-alert')) {
          document.getElementById('office-alert').style.display = 'none'
        }
      }
    }

    const showAlert = () => {
      const officeAlert = document.createElement('div')
      officeAlert.id = 'office-alert'
      const officeText = document.createElement('span')
      officeText.innerHTML = $gettext(
        'Having issues displaying Office files? As a workaround we recommend using Firefox, or just refreshing this page until it loads properly. More information:&nbsp;'
      )
      officeText.innerHTML += `<a
          target="_blank"
          rel="noopener noreferrer"
          href="https://cern.service-now.com/service-portal?id=outage&n=OTG0155118"
        >
          OTG0155118
        </a>`
      officeAlert.appendChild(officeText)
      officeAlert.classList.add('oc-my-xxl', 'oc-mx-xl', 'oc-p-m', 'oc-text-center', 'oc-rounded')
      officeAlert.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background-color: #f8d7da;
        color: #721c1c;
        text-align: left;
        font-size: 14px;
        z-index: 9999;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `

      const closeButton = document.createElement('span')
      closeButton.innerHTML = '&times;'
      closeButton.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
      `
      officeAlert.appendChild(closeButton)

      closeButton.onclick = () => {
        officeAlert.style.display = 'none'
        localStorage.setItem('officeAlertClosed', 'true')
      }
      setTimeout(() => {
        if (unref(successfulLoad)) return
        document.body.appendChild(officeAlert)
      }, 2000)
    }

    const loadAppUrl = useTask(function* (signal, viewMode: string) {
      try {
        if (!props.resource) {
          return null
        }
        if (props.isReadOnly && viewMode === 'write') {
          showErrorMessage({ title: $gettext('Cannot open file in edit mode as it is read-only') })
          return
        }

        const fileId = props.resource?.fileId
        const baseUrl = urlJoin(
          configStore.serverUrl,
          capabilityStore.filesAppProviders[0].open_url
        )

        const query = stringify({
          file_id: fileId,
          lang: language.current,
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

        appUrl.value = response.data.app_url
        method.value = response.data.method

        if (response.data.form_parameters) {
          formParameters.value = response.data.form_parameters
        }

        if (method.value === 'POST' && formParameters.value) {
          // eslint-disable-next-line vue/valid-next-tick
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
      return (
        openAsPreview === true || (Array.isArray(openAsPreview) && openAsPreview.includes(appName))
      )
    }

    // switch to write mode when edit is clicked
    const catchClickMicrosoftEdit = (event: MessageEvent) => {
      try {
        if (JSON.parse(event.data)?.MessageId === 'UI_Edit') {
          loadAppUrl.perform('write')
        }
      } catch {}
    }
    onMounted(() => {
      if (determineOpenAsPreview(unref(appName))) {
        window.addEventListener('message', catchClickMicrosoftEdit)
      } else {
        window.removeEventListener('message', catchClickMicrosoftEdit)
      }
      if (unref(appName) === 'MS365' && !unref(isAlertClosed)) {
        window.addEventListener('message', removeAlertOnSuccessfulLoad)
        showAlert()
      }
    })

    watch(
      [props],
      ([newProps], [oldProps]) => {
        if (!newProps || !newProps.resource || !newProps.space) {
          return
        }
        // if (isSameResource(newResource, oldResource)) {
        //   return
        // }

        let viewMode = 'view'

        if (unref(isEmbedModeEnabled)) {
          viewMode = 'embedded'
        } else if (!props.isReadOnly) {
          viewMode = unref(viewModeQueryValue) || 'write'

          if (
            determineOpenAsPreview(unref(appName)) &&
            (isShareSpaceResource(props.space) ||
              isPublicSpaceResource(props.space) ||
              isProjectSpaceResource(props.space))
          ) {
            viewMode = 'preview'
          }
        }
        loadAppUrl.perform(viewMode)
      },
      { immediate: true, deep: true }
    )

    return {
      appUrl,
      formParameters,
      iFrameTitle,
      method,
      subm
    }
  }
})
</script>
