import {
  ApplicationInformation,
  Extension,
  FileActionOptions,
  useAuthStore,
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

export const extensions = (appInfo: ApplicationInformation) => {
  const { showErrorMessage, showMessage } = useMessages()
  const configStore = useConfigStore()
  const authStore = useAuthStore()
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

  const submitServedWebappLaunch = (
    remoteWindow: Window,
    targetWindowName: string,
    action: string,
    fields: readonly (readonly [string, string])[]
  ) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    form.target = targetWindowName
    form.style.display = 'none'

    for (const [name, value] of fields) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }

    document.body.appendChild(form)
    try {
      form.submit()
    } catch {
      remoteWindow.close()
      showOpenError()
    } finally {
      // form.remove() throws in happy-dom and leaves the node mounted.
      document.body.removeChild(form)
    }
  }

  const handler = ({ resources }: FileActionOptions) => {
    const targetWindowName = `ocm-remote-${Date.now()}`
    const remoteWindow = window.open('about:blank', targetWindowName)

    if (!remoteWindow) {
      showPopupWarning()
      return
    }

    remoteWindow.focus()

    const resource = resources?.[0]
    if (!resource) {
      remoteWindow.close()
      showOpenError()
      return
    }

    const accessToken = typeof authStore.accessToken === 'string' ? authStore.accessToken : ''
    // Reva keeps this only for https on the receiver host, port 443 or none.
    // The hostname is the SPA origin; the page query and port are not copied.
    const expiredSessionRedirectUri = `https://${window.location.hostname}`
    const action = urlJoin(configStore.serverUrl, 'sciencemesh/webapp-launch')

    submitServedWebappLaunch(remoteWindow, targetWindowName, action, [
      ['file', resource.id.toString()],
      ['expired_session_redirect_uri', expiredSessionRedirectUri],
      ['access-token', accessToken],
      ['access_token', accessToken]
    ])
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
