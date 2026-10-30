import {
  defaultComponentMocks,
  getComposableWrapper,
  mockAxiosResolve
} from '@ownclouders/web-test-helpers'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  ActionExtension,
  ApplicationInformation,
  FileAction,
  FileActionOptions,
  useMessages
} from '@ownclouders/web-pkg'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { extensions } from '../../src/extensions'
import resourceExpectations from '../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/resource-expectations.json'

const remoteActionId = 'com.github.owncloud.web.open-file-remote'
const targetStamp = 1700000000000
const targetName = `ocm-remote-${targetStamp}`
const httpsUrl = 'https://remote.example/open'
const httpUrl = 'http://remote.example/open'
const token = 'synthetic-launch-token'
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

const appInfo: ApplicationInformation = {
  id: 'open-cloud-mesh',
  name: 'ScienceMesh',
  icon: 'contacts-book',
  color: '#AE291D'
}

type MessageStore = ReturnType<typeof useMessages>

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

const mountLaunch = () => {
  const mocks = defaultComponentMocks()
  let action: FileAction | undefined
  let showErrorMessage: MessageStore['showErrorMessage'] | undefined
  let showMessage: MessageStore['showMessage'] | undefined

  getComposableWrapper(
    () => {
      const messages = useMessages()
      showErrorMessage = messages.showErrorMessage
      showMessage = messages.showMessage
      action = findRemoteAction(unref(extensions(appInfo)))
    },
    {
      mocks,
      provide: mocks,
      pluginOptions: {
        piniaOptions: {
          configState: {
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
    post: mocks.$clientService.httpAuthenticated.post
  }
}

const assertPostedFile = (post: ReturnType<typeof mountLaunch>['post'], fileId: string) => {
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith('/sciencemesh/open-in-app', expect.any(URLSearchParams))
  const body = post.mock.calls[0]?.[1]
  if (!(body instanceof URLSearchParams)) {
    throw new Error('expected URLSearchParams body')
  }
  expect(body.get('file')).toBe(fileId)
  expect(Array.from(body.keys())).toEqual(['file'])
}

const expectSafeError = (showErrorMessage: MessageStore['showErrorMessage'], secret: string) => {
  expect(showErrorMessage).toHaveBeenCalledTimes(1)
  expect(showErrorMessage).toHaveBeenCalledWith(openError)
  expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain(secret)
  expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain('?')
}

describe('remote webapp launch', () => {
  const restorables: { mockRestore: () => void }[] = []

  const track = <T extends { mockRestore: () => void }>(spy: T) => {
    restorables.push(spy)
    return spy
  }

  afterEach(() => {
    while (restorables.length > 0) {
      restorables.pop()?.mockRestore()
    }
    for (const form of document.body.querySelectorAll('form')) {
      document.body.removeChild(form)
    }
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

  it('locks the fixture launch file ids', () => {
    expect(resourceExpectations.revision).toBe('received-webapp-v1-2026-09-28')
    expect(rootResource.id).toBe(resourceExpectations.launch.rootFileParameter)
    expect(nestedResource.id).toBe(resourceExpectations.launch.nestedFileParameter)
    expect(rootResource.id).toBe('ocm-share-1')
  })

  it('opens a named blank window before the ScienceMesh request and focuses it', async () => {
    const { handler, post, showErrorMessage, showMessage } = mountLaunch()
    const order: string[] = []
    const browser = installBrowser()
    let resolvePost: (value: ReturnType<typeof mockAxiosResolve>) => void = () => undefined
    post.mockImplementation(() => {
      order.push('post')
      return new Promise((resolve) => {
        resolvePost = resolve
      })
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

    const pending = handler(optionsFor(rootResource))
    expect(order).toEqual(['open', 'focus', 'post'])
    resolvePost(mockAxiosResolve({ app_url: httpsUrl, access_token: token }))
    await pending

    expect(showErrorMessage).not.toHaveBeenCalled()
    expect(showMessage).not.toHaveBeenCalled()
    expect(browser.remoteWindow.close).not.toHaveBeenCalled()
  })

  it('warns and skips the request when the popup is blocked', async () => {
    const { handler, post, showErrorMessage, showMessage } = mountLaunch()
    const browser = installBrowser()
    browser.openSpy.mockReturnValue(null)

    await handler(optionsFor(rootResource))

    expect(browser.openSpy).toHaveBeenCalledTimes(1)
    expect(browser.openSpy).toHaveBeenCalledWith('about:blank', targetName)
    expect(post).not.toHaveBeenCalled()
    expect(browser.submitSpy).not.toHaveBeenCalled()
    expect(showMessage).toHaveBeenCalledTimes(1)
    expect(showMessage).toHaveBeenCalledWith(popupWarning)
    expect(showErrorMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['root', rootResource, httpsUrl],
    ['nested', nestedResource, httpsUrl],
    ['http root', rootResource, httpUrl]
  ] as const)(
    'posts the %s file id and submits the token form',
    async (_label, resource, appUrl) => {
      const { handler, post, showErrorMessage, showMessage } = mountLaunch()
      const browser = installBrowser()
      post.mockResolvedValue(mockAxiosResolve({ app_url: appUrl, access_token: token }))

      await handler(optionsFor(resource))

      assertPostedFile(post, resource.id)
      expect(browser.openSpy).toHaveBeenCalledTimes(1)
      expect(browser.openSpy).toHaveBeenCalledWith('about:blank', targetName)
      expect(browser.openSpy.mock.calls.some((call) => String(call[0]).includes(token))).toBe(false)
      expect(browser.openSpy.mock.calls.some((call) => call[0] === appUrl)).toBe(false)
      expect(browser.submitSpy).toHaveBeenCalledTimes(1)

      const form = browser.submitted()
      const input = form?.querySelector('input')
      expect(form).toBeInstanceOf(HTMLFormElement)
      expect(form?.method.toLowerCase()).toBe('post')
      expect(form?.getAttribute('action')).toBe(appUrl)
      expect(form?.target).toBe(targetName)
      expect(input).toBeInstanceOf(HTMLInputElement)
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('missing access token input')
      }
      expect(input.name).toBe('access_token')
      expect(input.type).toBe('hidden')
      expect(input.value).toBe(token)
      expect(form?.action).not.toContain(token)
      expect(form?.action).not.toContain('access_token')
      expect(document.body.querySelector('form')).toBeNull()
      expect(document.body.innerHTML).not.toContain(token)
      expect(browser.remoteWindow.close).not.toHaveBeenCalled()
      expect(showErrorMessage).not.toHaveBeenCalled()
      expect(showMessage).not.toHaveBeenCalled()
    }
  )

  it.each([
    ['missing url', { access_token: token }],
    ['null url', { app_url: null, access_token: token }],
    ['empty url', { app_url: '', access_token: token }],
    ['whitespace url', { app_url: '   ', access_token: token }],
    ['unparsed url', { app_url: 'not a url', access_token: token }],
    ['non-http url', { app_url: 'ftp://remote.example/open', access_token: token }],
    ['javascript url', { app_url: 'javascript:alert(1)', access_token: token }],
    ['missing token', { app_url: httpsUrl }],
    ['null token', { app_url: httpsUrl, access_token: null }],
    ['empty token', { app_url: httpsUrl, access_token: '' }],
    ['whitespace token', { app_url: httpsUrl, access_token: '   ' }],
    ['non-string token', { app_url: httpsUrl, access_token: 42 }],
    ['null body', null]
  ] as const)('closes the window for a %s response', async (name, data) => {
    const { handler, post, showErrorMessage, showMessage } = mountLaunch()
    const browser = installBrowser()
    const logs = silenceConsole()
    post.mockResolvedValue(mockAxiosResolve(data))

    await handler(optionsFor(rootResource))

    expect(name).not.toHaveLength(0)
    assertPostedFile(post, resourceExpectations.launch.rootFileParameter)
    expect(browser.remoteWindow.close).toHaveBeenCalledTimes(1)
    expect(browser.submitSpy).not.toHaveBeenCalled()
    expect(browser.openSpy).toHaveBeenCalledTimes(1)
    expect(browser.openSpy).toHaveBeenCalledWith('about:blank', targetName)
    expectSafeError(showErrorMessage, token)
    expect(showMessage).not.toHaveBeenCalled()
    expect(document.body.querySelector('form')).toBeNull()
    for (const log of logs) {
      expect(JSON.stringify(log.mock.calls)).not.toContain(token)
    }
  })

  it('closes the window when the request throws and does not leak the token', async () => {
    const { handler, post, showErrorMessage } = mountLaunch()
    const browser = installBrowser()
    const logs = silenceConsole()
    const secret = 'synthetic-launch-token'
    post.mockRejectedValue(
      Object.assign(new Error(`request failed ${secret}`), {
        isAxiosError: true,
        response: {
          data: {
            access_token: secret,
            app_url: `${httpsUrl}?access_token=${secret}`
          }
        },
        config: { url: `/sciencemesh/open-in-app?access_token=${secret}` }
      })
    )

    await handler(optionsFor(nestedResource))

    assertPostedFile(post, resourceExpectations.launch.nestedFileParameter)
    expect(browser.remoteWindow.close).toHaveBeenCalledTimes(1)
    expect(browser.submitSpy).not.toHaveBeenCalled()
    expect(browser.openSpy.mock.calls.some((call) => String(call[0]).includes(secret))).toBe(false)
    expectSafeError(showErrorMessage, secret)
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain('request failed')
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain(httpsUrl)
    for (const log of logs) {
      expect(log).not.toHaveBeenCalled()
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret)
    }
  })

  it('removes the form when submit throws and reports the fixed error', async () => {
    const { handler, post, showErrorMessage } = mountLaunch()
    const browser = installBrowser()
    const logs = silenceConsole()
    post.mockResolvedValue(mockAxiosResolve({ app_url: httpsUrl, access_token: token }))
    browser.submitSpy.mockImplementation(function (this: HTMLFormElement) {
      expect(this.querySelector('input')?.getAttribute('value')).toBe(token)
      throw new Error('submit failed')
    })

    await handler(optionsFor(rootResource))

    expect(browser.submitSpy).toHaveBeenCalledTimes(1)
    expect(browser.remoteWindow.close).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('form')).toBeNull()
    expect(document.body.innerHTML).not.toContain(token)
    expectSafeError(showErrorMessage, token)
    expect(JSON.stringify(vi.mocked(showErrorMessage).mock.calls)).not.toContain('submit failed')
    for (const log of logs) {
      expect(log).not.toHaveBeenCalled()
    }
  })
})
