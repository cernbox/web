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
import { useOfficeAlert, useOfficePostMessageRegistry } from './composables'

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

// navigates to the same resource, opened with a different external app
const switchToApp = (targetAppName: string) => {
  router.push({
    name: `external-${targetAppName.toLowerCase()}-apps`,
    params: unref(route).params,
    query: unref(route).query
  })
}

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

// the container itself is position:fixed, full-width, z-index:9999 - even with no
// alerts left, its own padding still occupies space and blocks clicks on whatever's
// underneath, so it needs to go once the last alert in it is removed
const removeAlert = (alert: HTMLElement) => {
  const container = alert.parentElement
  alert.remove()
  if (container?.id === 'app-alerts-container' && !container.hasChildNodes()) {
    container.remove()
  }
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
  onClose?: () => void,
  action?: { label: string; onClick: () => void }
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

  const contentWrapper = document.createElement('span')
  contentWrapper.style.cssText = `
    display: flex;
    align-items: center;
    flex-grow: 1;
  `

  const content = document.createElement('span')
  buildContent(content)
  contentWrapper.appendChild(content)

  if (action) {
    const actionButton = document.createElement('button')
    actionButton.type = 'button'
    actionButton.textContent = action.label
    actionButton.style.cssText = `
      font: inherit;
      font-weight: bold;
      background: none;
      border: 1px solid currentColor;
      border-radius: 16px;
      color: inherit;
      cursor: pointer;
      padding: 4px 12px;
      margin-left: 12px;
      flex-shrink: 0;
    `
    actionButton.onclick = () => {
      removeAlert(alert)
      action.onClick()
    }
    contentWrapper.appendChild(actionButton)
  }

  alert.appendChild(contentWrapper)

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
    removeAlert(alert)
    onClose?.()
  }
  alert.appendChild(closeButton)

  getAlertsContainer().appendChild(alert)
}

const { isOfficeAlertClosed, showOfficeAlert } = useOfficeAlert(showAlert)

const showWarningAlert = (message: string, action?: { label: string; onClick: () => void }) => {
  showAlert(
    'warning-alert',
    'warning',
    (content) => {
      content.innerHTML = message
    },
    undefined,
    action
  )
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

    if (response.data.forced_viewmode_reason && response.data.forced_viewmode_reason !== '') {
      // Check if an alternative app can be used in Web to open in write mode
      // We will suggest the user changing to that app
      const lockedByAppName = response.data.app_for_editing as string | undefined
      const matchedAppName = lockedByAppName
        ? appProviderService.appNames.find(
            (name) => name.toLowerCase() === lockedByAppName.toLowerCase()
          )
        : undefined

      const canSwitchToApp =
        matchedAppName && matchedAppName.toLowerCase() !== unref(appName)?.toLowerCase()

      showWarningAlert(
        response.data.forced_viewmode_reason,
        canSwitchToApp
          ? {
              label: $gettext('Switch to %{appName}', { appName: matchedAppName }),
              onClick: () => switchToApp(matchedAppName)
            }
          : undefined
      )
    }

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
  isAppLoaded: isOfficeAppLoaded,
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
  if (unref(appName) === 'MS365' && !unref(isOfficeAlertClosed)) {
    showOfficeAlert(isOfficeAppLoaded)
  }

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
