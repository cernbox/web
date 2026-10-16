import {
  defaultComponentMocks,
  getComposableWrapper,
  mockAxiosResolve
} from '@ownclouders/web-test-helpers'
import { Resource, SpaceResource, urlJoin } from '@ownclouders/web-client'
import {
  ActionExtension,
  ApplicationInformation,
  FileAction,
  FileActionOptions,
  useConfigStore,
  useMessages
} from '@ownclouders/web-pkg'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { extensions } from '../../src/extensions'
import resourceExpectations from '../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/resource-expectations.json'

const remoteActionId = 'com.github.owncloud.web.open-file-remote'
const targetStamp = 1700000000000
const targetName = `ocm-remote-${targetStamp}`
const server = 'https://receiver.example'
const launchAction = 'https://receiver.example/sciencemesh/webapp-launch'
const redirectUri = 'https://receiver.example'
const pageUrl =
  'http://receiver.example:8443/apps/files/space?access_token=page-query-secret&token=synthetic-launch-token#frag'
const token = 'synthetic-launch-token'
const pageSecret = 'page-query-secret'
const openError = {
  title: 'An error occurred',
  desc: "Couldn't open remotely"
}
const popupWarning = {
  title: 'Pop-up and redirect block detected',
  timeout: 20,
  status: 'warning',
  desc: 'Please turn on pop-ups and redirects in your browser settings to make sure everything works right.'
}
const fieldNames = ['file', 'expired_session_redirect_uri', 'access-token', 'access_token'] as const

const appInfo: ApplicationInformation = {
  id: 'open-cloud-mesh',
  name: 'ScienceMesh',
  icon: 'contacts-book',
  color: '#AE291D'
}

type MessageStore = ReturnType<typeof useMessages>
type LaunchField = { name: string | null; type: string | null; value: string }

const positiveCase = resourceExpectations.cases.find(
  (item) => item.response === 'positive.sharedWithMe.json'
)
if (!positiveCase) {
  throw new Error('missing positive received-webapp fixture')
}

const asResource = (value: object): Resource => {
  return value as Resource
}

const rootResource = asResource(positiveCase.mappedResource)
const nestedResource = asResource(positiveCase.children[0])

const optionsFor = (resource: Resource): FileActionOptions => {
  return {
    resources: [resource],
    space: mock<SpaceResource>()
  }
}

const findRemoteAction = (items: ReturnType<typeof extensions>['value']): FileAction => {
  const extension = items.find((item): item is ActionExtension => {
    return item.id === remoteActionId && item.type === 'action'
  })
  if (!extension?.action.handler) {
    throw new Error('missing remote open action')
  }
  return extension.action as FileAction
}

const setPageUrl = (url: string) => {
  const browser = window as Window & { happyDOM?: { setURL?: (next: string) => void } }
  if (!browser.happyDOM?.setURL) {
    throw new Error('happy-dom setURL is unavailable')
  }
  browser.happyDOM.setURL(url)
}

const mountLaunch = (trackSpy?: <T extends { mockRestore: () => void }>(spy: T) => T) => {
  const mocks = defaultComponentMocks()
  let action: FileAction | undefined
  let showErrorMessage: MessageStore['showErrorMessage'] | undefined
  let showMessage: MessageStore['showMessage'] | undefined
  let serverUrl = ''

  getComposableWrapper(
    () => {
      const messages = useMessages()
      showErrorMessage = messages.showErrorMessage
      showMessage = messages.showMessage
      const configStore = useConfigStore()
      // The server ref is not store state; stub the public URL the handler joins.
      const serverUrlSpy = vi.spyOn(configStore, 'serverUrl', 'get').mockReturnValue(`${server}/`)
      trackSpy?.(serverUrlSpy)
      serverUrl = configStore.serverUrl
      action = findRemoteAction(unref(extensions(appInfo)))
    },
    {
      mocks,
      provide: mocks,
      pluginOptions: {
        piniaOptions: {
          authState: { accessToken: token },
          configState: {
            server,
            options: {
              cernFeatures: true,
              ocm: { openRemotely: true }
            }
          }
        }
      }
    }
  )

  if (!action?.handler || !showErrorMessage || !showMessage) {
    throw new Error('launch harness did not mount')
  }

  return {
    action,
    handler: action.handler,
    showErrorMessage,
    showMessage,
    serverUrl,
    http: mocks.$clientService.httpAuthenticated
  }
}

const isFormOrInputTarget = (target: unknown): target is HTMLFormElement | HTMLInputElement => {
  return target instanceof HTMLFormElement || target instanceof HTMLInputElement
}

const fieldsOf = (form: HTMLFormElement | undefined): LaunchField[] => {
  return Array.from(form?.querySelectorAll('input, textarea, select, button') ?? []).map((node) => {
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      return { name: node.getAttribute('name'), type: node.getAttribute('type'), value: node.value }
    }
    return {
      name: node.getAttribute('name'),
      type: node.getAttribute('type'),
      value: node.getAttribute('value') ?? ''
    }
  })
}

const expectCleanDom = (secret: string) => {
  expect(document.body.querySelector('form')).toBeNull()
  expect(document.body.innerHTML).not.toContain(secret)
  expect(document.body.innerHTML).not.toContain(pageSecret)
}

describe('remote webapp launch', () => {
  const restorables: { mockRestore: () => void }[] = []
  const originalUrl = window.location.href

  const track = <T extends { mockRestore: () => void }>(spy: T) => {
    restorables.push(spy)
    return spy
  }

  beforeEach(() => {
    setPageUrl(pageUrl)
  })

  afterEach(() => {
    while (restorables.length > 0) {
      restorables.pop()?.mockRestore()
    }
    for (const form of document.body.querySelectorAll('form')) {
      document.body.removeChild(form)
    }
    setPageUrl(originalUrl)
  })

  const installBrowser = () => {
    track(vi.spyOn(Date, 'now').mockReturnValue(targetStamp))
    const remoteWindow = {
      focus: vi.fn(),
      close: vi.fn()
    }
    const openSpy = track(
      vi.spyOn(window, 'open').mockReturnValue(remoteWindow as unknown as Window)
    )
    let submitted: HTMLFormElement | undefined
    const submitSpy = track(
      vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
        this: HTMLFormElement
      ) {
        const copy = this.cloneNode(true)
        if (!(copy instanceof HTMLFormElement)) {
          throw new Error('expected a form copy')
        }
        submitted = copy
      })
    )

    return {
      remoteWindow,
      openSpy,
      submitSpy,
      submitted: () => submitted
    }
  }

  const silenceConsole = () => {
    return (['log', 'error', 'info', 'debug', 'warn'] as const).map((method) => {
      return track(vi.spyOn(console, method).mockImplementation(() => undefined))
    })
  }

  const expectNoHttp = (http: ReturnType<typeof mountLaunch>['http']) => {
    expect(http.post).not.toHaveBeenCalled()
    expect(http.get).not.toHaveBeenCalled()
    expect(http.put).not.toHaveBeenCalled()
    expect(http.patch).not.toHaveBeenCalled()
    expect(http.delete).not.toHaveBeenCalled()
    expect(http.request).not.toHaveBeenCalled()
  }

  it('locks the fixture launch file ids', () => {
    expect(resourceExpectations.revision).toBe('received-webapp-v1-2026-09-28')
    expect(rootResource.id).toBe(resourceExpectations.launch.rootFileParameter)
    expect(nestedResource.id).toBe(resourceExpectations.launch.nestedFileParameter)
    expect(rootResource.id).toBe('ocm-share-1')
  })

  it.each([
    ['root', rootResource],
    ['nested', nestedResource]
  ] as const)(
    'submits the %s file through the same-origin launcher form',
    (_label, resource) => {
      const { handler, http, showErrorMessage, showMessage, serverUrl } = mountLaunch(track)
      const browser = installBrowser()
      const childCount = document.body.childElementCount

      const result = handler(optionsFor(resource))

      expect(result).toBeUndefined()
      expect(serverUrl).toBe(urlJoin(server, { trailingSlash: true }))
      expect(browser.openSpy).toHaveBeenCalledTimes(1)
      expect(browser.openSpy.mock.calls[0]).toEqual(['about:blank', targetName])
      expect(browser.submitSpy).toHaveBeenCalledTimes(1)
      expectNoHttp(http)

      const form = browser.submitted()
      expect(form).toBeInstanceOf(HTMLFormElement)
      expect(form?.method.toLowerCase()).toBe('post')
      expect(form?.getAttribute('action')).toBe(urlJoin(serverUrl, 'sciencemesh/webapp-launch'))
      expect(form?.getAttribute('action')).toBe(launchAction)
      expect(form?.action).toBe(launchAction)
      expect(form?.getAttribute('onsubmit')).toBeNull()
      expect(form?.onsubmit).toBeNull()
      expect(form?.target).toBe(targetName)
      expect(form?.getAttribute('target')).toBe(targetName)

      const actionUrl = new URL(form?.action || '')
      expect(`${actionUrl.origin}${actionUrl.pathname}`).toBe(launchAction)
      expect(actionUrl.search).toBe('')
      expect(actionUrl.hash).toBe('')
      expect(actionUrl.username).toBe('')
      expect(actionUrl.password).toBe('')
      expect(actionUrl.href).not.toContain(token)
      expect(actionUrl.href).not.toContain(pageSecret)
      expect(actionUrl.href).not.toContain('access_token')
      expect(actionUrl.href).not.toContain('access-token')
      expect(serverUrl).not.toContain(token)
      expect(serverUrl).not.toContain('access_token')

      expect(browser.remoteWindow.close).not.toHaveBeenCalled()
      expect(showErrorMessage).not.toHaveBeenCalled()
      expect(showMessage).not.toHaveBeenCalled()
      expect(document.body.childElementCount).toBe(childCount)
      expectCleanDom(token)
    }
  )

  it.each([
    ['root', rootResource],
    ['nested', nestedResource]
  ] as const)('sends only the four launcher fields for the %s file', (_label, resource) => {
    const { handler } = mountLaunch(track)
    const browser = installBrowser()

    handler(optionsFor(resource))

    const form = browser.submitted()
    const fields = fieldsOf(form)
    expect(fields.map((field) => field.name)).toEqual([...fieldNames])
    expect(fields).toEqual([
      { name: 'file', type: 'hidden', value: resource.id.toString() },
      { name: 'expired_session_redirect_uri', type: 'hidden', value: redirectUri },
      { name: 'access-token', type: 'hidden', value: token },
      { name: 'access_token', type: 'hidden', value: token }
    ])
    expect(fields[2]?.value).toBe(fields[3]?.value)
    expect(form?.querySelectorAll('input')).toHaveLength(4)
    expect(redirectUri).toBe(`https://${window.location.hostname}`)
    expect(redirectUri).not.toBe(window.location.origin)
    expect(redirectUri).not.toContain(token)
    expect(redirectUri).not.toContain(pageSecret)
    expect(redirectUri).not.toContain('?')
    expect(window.location.origin).toBe('http://receiver.example:8443')
  })

  it('keeps the token out of every URL the launch touches', () => {
    const { handler, serverUrl } = mountLaunch(track)
    const browser = installBrowser()

    handler(optionsFor(rootResource))

    const form = browser.submitted()
    const touched = [
      serverUrl,
      launchAction,
      form?.action ?? '',
      form?.getAttribute('action') ?? '',
      redirectUri,
      ...browser.openSpy.mock.calls.map((call) => String(call[0]))
    ]
    for (const url of touched) {
      expect(url).not.toContain(token)
      expect(url).not.toContain(pageSecret)
      expect(url).not.toContain('access_token=')
      expect(url).not.toContain('access-token=')
      expect(new URL(url, window.location.origin).search).toBe('')
    }
    expect(fieldsOf(form).map((field) => field.value)).toEqual([
      rootResource.id.toString(),
      redirectUri,
      token,
      token
    ])
  })

  it('submits synchronously after opening the popup and does not call the network', () => {
    const { handler, http } = mountLaunch(track)
    const order: string[] = []
    const browser = installBrowser()
    const fetchSpy = track(vi.spyOn(window, 'fetch').mockResolvedValue(new Response()))
    const addListener = track(vi.spyOn(EventTarget.prototype, 'addEventListener'))
    http.post.mockImplementation(() => {
      order.push('post')
      return Promise.resolve(
        mockAxiosResolve({ access_token: token, app_url: 'https://remote.example/open' })
      )
    })
    browser.openSpy.mockImplementation((url, name) => {
      order.push('open')
      expect(url).toBe('about:blank')
      expect(name).toBe(targetName)
      return {
        focus: () => {
          order.push('focus')
        },
        close: browser.remoteWindow.close
      } as unknown as Window
    })
    let submitted: HTMLFormElement | undefined
    browser.submitSpy.mockImplementation(function (this: HTMLFormElement) {
      order.push('submit')
      expect(this.parentNode).toBe(document.body)
      expect(document.body.querySelectorAll('form')).toHaveLength(1)
      const copy = this.cloneNode(true)
      if (!(copy instanceof HTMLFormElement)) {
        throw new Error('expected a form copy')
      }
      submitted = copy
    })

    const result = handler(optionsFor(rootResource))

    expect(result).toBeUndefined()
    expect(order).toEqual(['open', 'focus', 'submit'])
    expect(browser.submitSpy).toHaveBeenCalledTimes(1)
    expectNoHttp(http)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(addListener.mock.instances.some((target) => isFormOrInputTarget(target))).toBe(false)
    expect(submitted?.target).toBe(targetName)
    expect(browser.remoteWindow.close).not.toHaveBeenCalled()
    expectCleanDom(token)
  })

  it('warns and skips the form when the popup is blocked', () => {
    const { handler, http, showErrorMessage, showMessage } = mountLaunch(track)
    const browser = installBrowser()
    browser.openSpy.mockReturnValue(null)

    const result = handler(optionsFor(rootResource))

    expect(result).toBeUndefined()
    expect(browser.openSpy).toHaveBeenCalledTimes(1)
    expect(browser.openSpy).toHaveBeenCalledWith('about:blank', targetName)
    expectNoHttp(http)
    expect(browser.submitSpy).not.toHaveBeenCalled()
    expect(browser.remoteWindow.close).not.toHaveBeenCalled()
    expect(showMessage).toHaveBeenCalledTimes(1)
    expect(showMessage).toHaveBeenCalledWith(popupWarning)
    expect(showErrorMessage).not.toHaveBeenCalled()
    expectCleanDom(token)
  })

  it.each([
    ['empty', []],
    ['missing', undefined]
  ] as const)('closes the popup for a %s resource list and does not submit', (_label, resources) => {
    const { handler, http, showErrorMessage, showMessage } = mountLaunch(track)
    const browser = installBrowser()

    const result = handler({ resources, space: mock<SpaceResource>() })

    expect(result).toBeUndefined()
    expect(browser.openSpy).toHaveBeenCalledTimes(1)
    expect(browser.openSpy).toHaveBeenCalledWith('about:blank', targetName)
    expect(browser.remoteWindow.focus).toHaveBeenCalledTimes(1)
    expect(browser.remoteWindow.close).toHaveBeenCalledTimes(1)
    expectNoHttp(http)
    expect(browser.submitSpy).not.toHaveBeenCalled()
    expect(showErrorMessage).toHaveBeenCalledTimes(1)
    expect(showErrorMessage).toHaveBeenCalledWith(openError)
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain(token)
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain(pageSecret)
    expect(showMessage).not.toHaveBeenCalled()
    expectCleanDom(token)
  })

  it('removes the form when submit throws and reports the fixed error', () => {
    const { handler, http, showErrorMessage, showMessage } = mountLaunch(track)
    const browser = installBrowser()
    const logs = silenceConsole()
    const addListener = track(vi.spyOn(EventTarget.prototype, 'addEventListener'))
    browser.submitSpy.mockImplementation(function (this: HTMLFormElement) {
      expect(this.querySelector('input[name="access_token"]')?.getAttribute('value')).toBe(token)
      expect(document.body.contains(this)).toBe(true)
      throw new Error(`submit failed ${token}`)
    })

    const result = handler(optionsFor(rootResource))

    expect(result).toBeUndefined()
    expect(browser.submitSpy).toHaveBeenCalledTimes(1)
    expect(browser.remoteWindow.close).toHaveBeenCalledTimes(1)
    expect(showErrorMessage).toHaveBeenCalledTimes(1)
    expect(showErrorMessage).toHaveBeenCalledWith(openError)
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain(token)
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain('submit failed')
    expect(showMessage).not.toHaveBeenCalled()
    expectNoHttp(http)
    expect(addListener.mock.instances.some((target) => isFormOrInputTarget(target))).toBe(false)
    expectCleanDom(token)
    for (const log of logs) {
      expect(log).not.toHaveBeenCalled()
      expect(JSON.stringify(log.mock.calls)).not.toContain(token)
    }
  })

  it('does not submit twice or leave a listener when the launch succeeds', () => {
    const { handler } = mountLaunch(track)
    const browser = installBrowser()
    const addListener = track(vi.spyOn(EventTarget.prototype, 'addEventListener'))
    const childCount = document.body.childElementCount

    handler(optionsFor(rootResource))
    handler(optionsFor(nestedResource))

    expect(browser.submitSpy).toHaveBeenCalledTimes(2)
    expect(browser.openSpy).toHaveBeenCalledTimes(2)
    expect(document.body.childElementCount).toBe(childCount)
    expect(document.body.querySelector('form')).toBeNull()
    expect(addListener.mock.instances.some((target) => isFormOrInputTarget(target))).toBe(false)
  })
})
