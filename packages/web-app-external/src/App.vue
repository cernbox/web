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
    const isOfficeAlertClosed = computed(() => {
      return localStorage.getItem('officeAlertClosed')
    })
    const isCollaboraModalClosed = computed(() => {
      const currentDate = new Date().toLocaleDateString()
      return localStorage.getItem('collaboraModalClosed') === currentDate
    })

    const removeAlertOnSuccessfulLoad = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.MessageId === 'App_LoadingStatus') {
        successfulLoad.value = true
        if (document.getElementById('office-alert')) {
          document.getElementById('office-alert').style.display = 'none'
        }
      }
    }

    const getAlertsContainer = () => {
      let alertsContainer = document.getElementById('app-alerts-container')
      if (!alertsContainer) {
        alertsContainer = document.createElement('div')
        alertsContainer.id = 'app-alerts-container'
        alertsContainer.classList.add('oc-px-xl', 'oc-pt-xxl', 'oc-mt-xs')
        alertsContainer.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
        `
        document.body.appendChild(alertsContainer)
      }
      return alertsContainer
    }

    // remixicon error-warning-fill
    const alertIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"></path></svg>'

    const alertStyles = {
      danger: {
        background: '#f8d7da',
        color: '#721c1c'
      },
      warning: {
        background: '#fff3cd',
        color: '#856404'
      }
    }

    const showAlert = (
      id: string,
      status: keyof typeof alertStyles,
      buildContent: (content: HTMLElement) => void,
      onClose?: () => void
    ) => {
      const { background, color } = alertStyles[status]

      const alert = document.createElement('div')
      alert.id = id
      alert.classList.add('oc-mb-xs', 'oc-p-m', 'oc-text-center', 'oc-rounded')
      alert.style.cssText = `
        background-color: ${background};
        color: ${color};
        text-align: left;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 3px 8px 1px rgb(0 0 0 / 14%);
      `

      const iconWrapper = document.createElement('span')
      iconWrapper.innerHTML = alertIcon
      iconWrapper.style.cssText = `
        display: flex;
        align-items: center;
        margin-right: 12px;
        flex-shrink: 0;
      `
      alert.appendChild(iconWrapper)

      const content = document.createElement('span')
      content.style.cssText = `
        flex-grow: 1;
      `
      buildContent(content)
      alert.appendChild(content)

      const closeButton = document.createElement('span')
      closeButton.innerHTML = '&times;'
      closeButton.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        margin-left: 12px;
        flex-shrink: 0;
      `
      closeButton.onclick = () => {
        alert.style.display = 'none'
        onClose?.()
      }
      alert.appendChild(closeButton)

      getAlertsContainer().appendChild(alert)
    }

    const showOfficeAlert = () => {
      setTimeout(() => {
        if (unref(successfulLoad)) return
        showAlert(
          'office-alert',
          'danger',
          (content) => {
            content.innerHTML = $gettext(
              'Having connection issues displaying Office files? Try and refresh this page until it loads properly and please&nbsp;'
            )
            content.innerHTML += `<a
                target="_blank"
                rel="noopener noreferrer"
                href="https://cern.service-now.com/service-portal?id=sc_cat_item&name=request&se=CERNBox-Service&short_description=MS365%20issue%20feedback"
              >
                let us know so we can report the issue
              </a>!`
          },
          () => localStorage.setItem('officeAlertClosed', 'true')
        )
      }, 2000)
    }

    const showCollaboraModal = () => {
      const collaboraModal = document.createElement('dialog') as HTMLDialogElement
      collaboraModal.id = 'collabora-modal'
      collaboraModal.innerHTML = `
        <form method="dialog" class="oc-p-m">
          <div class="oc-flex oc-flex-around oc-flex-middle oc-mb-m">
            <img src="https://cernbox.docs.cern.ch/assets/images/logo-full.png" height="100"/>
            <img src="https://www.collaboraonline.com/wp-content/uploads/2023/06/collabora-online-primary300-e1709657485501.png" height="70"/>
          </div>
          <h3>Collabora Online</h3>
          <p>
            The Collabora integration in CERNBox is
              <span class="oc-text-bold oc-background-highlight">experimental</span>,
              <span class="oc-text-bold oc-background-highlight">time-limited</span>, and is provided for
              <span class="oc-text-bold oc-background-highlight">testing</span>
              and <span class="oc-text-bold oc-background-highlight">evaluation purposes only</span>
            (<a
              target="_blank"
              rel="noopener noreferrer"
              href="https://cernbox.docs.cern.ch/web/apps/collabora/"
            >know more here</a>).
          </p>
          <p>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://indico.cern.ch/event/1652846/surveys/7168"
            >Please provide feedback via this survey!</a>
          </p>
          <menu class="oc-flex oc-flex-center oc-m-rm oc-px-rm">
            <button class="oc-button oc-button-m oc-button-primary oc-button-primary-filled oc-rounded oc-py-s oc-px-xxl" id="collabora-close-button">
              ${$gettext('I understand')}
            </button>
          </menu>
        </form>
      `
      collaboraModal.style.cssText = `
        background-color: var(--oc-color-background-default);
        border: none;
        border-radius: 16px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        min-width: min-content;
        width: 30vw;
        max-width: 80vw;
        padding: 20px;
      `
      const closeButton = collaboraModal.querySelector(
        '#collabora-close-button'
      ) as HTMLButtonElement
      closeButton.onclick = () => {
        const currentDate = new Date().toLocaleDateString()
        console.log('Collabora modal closed')
        localStorage.setItem('collaboraModalClosed', currentDate)
      }
      setTimeout(() => {
        document.body.appendChild(collaboraModal)
        collaboraModal.showModal()
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
      if (unref(appName) === 'MS365' && !unref(isOfficeAlertClosed)) {
        window.addEventListener('message', removeAlertOnSuccessfulLoad)
        showOfficeAlert()
      }
      if (unref(appName) === 'Collabora' && !unref(isCollaboraModalClosed)) {
        showCollaboraModal()
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
