import {
  ApplicationInformation,
  Extension,
  FileActionOptions,
  useClientService,
  useConfigStore,
  useMessages,
  useUserStore
} from '@ownclouders/web-pkg'
import { urlJoin } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const readOcmWebAppName = (resource: unknown): string | undefined => {
  if (!isPlainObject(resource) || !Object.hasOwn(resource, 'ocmWebApp')) {
    return undefined
  }

  const metadata = resource.ocmWebApp
  if (!isPlainObject(metadata) || typeof metadata.appName !== 'string') {
    return undefined
  }

  return metadata.appName
}

const getLaunchUrl = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

const submitRemoteAppLaunch = (appUrl: string, accessToken: string, targetWindowName: string) => {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = appUrl
  form.target = targetWindowName
  form.style.display = 'none'

  const tokenInput = document.createElement('input')
  tokenInput.type = 'hidden'
  tokenInput.name = 'access_token'
  tokenInput.value = accessToken
  form.appendChild(tokenInput)
  document.body.appendChild(form)

  try {
    form.submit()
  } finally {
    // form.remove() throws in happy-dom and leaves the node mounted.
    document.body.removeChild(form)
  }
}

export const extensions = (appInfo: ApplicationInformation) => {
  const { showErrorMessage, showMessage } = useMessages()
  const clientService = useClientService()
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const { $gettext } = useGettext()

  const showOpenError = () => {
    showErrorMessage({
      title: $gettext('An error occurred'),
      desc: $gettext("Couldn't open remotely")
    })
  }

  const showPopupWarning = () => {
    showMessage({
      title: $gettext('Pop-up and redirect block detected'),
      timeout: 20,
      status: 'warning',
      desc: $gettext(
        'Please turn on pop-ups and redirects in your browser settings to make sure everything works right.'
      )
    })
  }

  const handler = async ({ resources }: FileActionOptions) => {
    const targetWindowName = `ocm-remote-${Date.now()}`
    const remoteWindow = window.open('about:blank', targetWindowName)

    if (!remoteWindow) {
      showPopupWarning()
      return
    }

    remoteWindow.focus()

    try {
      const resource = resources?.[0]
      if (!resource) {
        remoteWindow.close()
        showOpenError()
        return
      }

      const params = new URLSearchParams()
      params.append('file', resource.id.toString())

      const { data } = await clientService.httpAuthenticated.post(
        '/sciencemesh/open-in-app',
        params
      )
      const payload: unknown = data
      const appUrl = getLaunchUrl(isPlainObject(payload) ? payload.app_url : undefined)
      const accessToken = isPlainObject(payload) ? payload.access_token : undefined

      if (appUrl === null || !isNonEmptyString(accessToken)) {
        remoteWindow.close()
        showOpenError()
        return
      }

      submitRemoteAppLaunch(appUrl, accessToken, targetWindowName)
    } catch {
      remoteWindow.close()
      showOpenError()
    }
  }

  const appNameFor = (options?: FileActionOptions) => {
    return readOcmWebAppName(options?.resources?.[0])
  }

  return computed<Extension[]>(() => [
    {
      id: 'com.github.owncloud.web.open-file-remote',
      type: 'action',
      extensionPointIds: ['global.files.context-actions'],
      action: {
        name: 'open-file-remote',
        category: 'actions',
        icon: 'remote-control',
        handler,
        label: (options?: FileActionOptions) => {
          const appName = appNameFor(options)
          if (!isNonEmptyString(appName)) {
            return ''
          }
          return $gettext('Open remotely with %{appName}', { appName }, true)
        },
        isVisible: (options?: FileActionOptions) => {
          if (!options?.resources?.length) {
            return false
          }
          if (!configStore.options.ocm.openRemotely) {
            return false
          }
          return isNonEmptyString(appNameFor(options))
        },
        class: 'oc-files-actions-open-file-remote'
      }
    },
    ...((userStore.user && [
      {
        id: `app.${appInfo.id}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        path: urlJoin(appInfo.id)
      }
    ]) ||
      [])
  ])
}
