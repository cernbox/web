import {
  ApplicationInformation,
  FileActionOptions,
  useClientService,
  useConfigStore,
  useMessages,
  useUserStore
} from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'
import { Extension } from '@ownclouders/web-pkg'
import { OCM_PROVIDER_ID, urlJoin } from '@ownclouders/web-client'

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

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

const submitRemoteAppLaunch = (
  appUrl: string,
  accessToken: string,
  targetWindowName: string
) => {
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
  form.submit()
  document.body.removeChild(form)
}

export const extensions = (appInfo: ApplicationInformation) => {
  const { showErrorMessage, showMessage } = useMessages()
  const clientService = useClientService()
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const { $gettext } = useGettext()

  const handler = async ({ resources }: FileActionOptions) => {
    const resource = resources[0]
    const targetWindowName = `ocm-remote-${Date.now()}`
    const remoteWindow = window.open('about:blank', targetWindowName)

    if (!remoteWindow) {
      showMessage({
        title: $gettext('Pop-up and redirect block detected'),
        timeout: 20,
        status: 'warning',
        desc: $gettext(
          'Please turn on pop-ups and redirects in your browser settings to make sure everything works right.'
        )
      })
      return
    }

    remoteWindow.focus()

    try {
      const params = new URLSearchParams()
      params.append('file', resource.id.toString())

      const { data } = await clientService.httpAuthenticated.post(
        '/sciencemesh/open-in-app',
        params
      )

      const appUrl = getLaunchUrl(data?.app_url)
      const accessToken = data?.access_token

      if (!appUrl || !isNonEmptyString(accessToken)) {
        remoteWindow.close()
        showErrorMessage({
          title: $gettext('An error occurred'),
          desc: $gettext("Couldn't open remotely")
        })
        return
      }

      submitRemoteAppLaunch(appUrl, accessToken, targetWindowName)
    } catch (error) {
      remoteWindow.close()
      console.log(error)
      showErrorMessage({
        title: $gettext('An error occurred'),
        desc: $gettext("Couldn't open remotely"),
        errors: [error]
      })
    }
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
        label: () => $gettext('Open remotely'),
        isVisible: ({ resources }: FileActionOptions) => {
          if (!resources?.length) {
            return false
          }
          return (
            configStore.options.ocm.openRemotely &&
            resources[0]?.storageId?.startsWith(OCM_PROVIDER_ID)
          )
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
