import {
  RouteLocation,
  defaultComponentMocks,
  defaultPlugins,
  shallowMount
} from '@ownclouders/web-test-helpers'
import oidcCallback from '../../../src/pages/oidcCallback.vue'
import { authService } from '../../../src/services/auth'
import { mock } from 'vitest-mock-extended'
import { computed } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useRoute } from '@ownclouders/web-pkg'

const mockUseEmbedMode = vi.fn()

vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useRoute: vi.fn().mockReturnValue({ path: '/web-oidc-callback', query: {} }),
  useEmbedMode: vi.fn().mockImplementation(() => mockUseEmbedMode())
}))

const postMessageMock = vi.fn()
console.debug = vi.fn()

describe('oidcCallback page', () => {
  describe('delegated authentication', () => {
    it('when authentication is delegated does not call signInCallback immediately', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      expect(signInCallbackSpy).not.toHaveBeenCalled()
    })

    it('when authentication is not delegated calls signInCallback immediately', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => false),
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      expect(signInCallbackSpy).toHaveBeenCalled()
    })

    it('when authentication is delegated calls postMessage with token request event', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      vi.spyOn(authService, 'signInCallback').mockImplementation(() => Promise.resolve())

      getWrapper()

      expect(postMessageMock).toHaveBeenCalledWith('owncloud-embed:request-token')
    })

    it('when token update event is received calls signInCallback', async () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      window.postMessage(
        {
          name: 'owncloud-embed:update-token',
          data: { access_token: 'access-token' }
        },
        '*'
      )

      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10))

      expect(signInCallbackSpy).toHaveBeenCalledWith('access-token')
    })

    it('when token update event is received but name is incorrect does not call signInCallback', async () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      window.postMessage(
        {
          name: 'update-token',
          data: { access_token: 'access-token' }
        },
        '*'
      )

      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10))

      expect(signInCallbackSpy).not.toHaveBeenCalled()
    })
  })
})

describe('popup callback (/web-oidc-popup-callback)', () => {
  beforeEach(() => {
    mockUseEmbedMode.mockReturnValue({
      isDelegatingAuthentication: computed(() => false),
      verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
    })
  })

  it('calls signInPopupCallback when on popup callback route', async () => {
    vi.mocked(useRoute).mockReturnValue({ path: '/web-oidc-popup-callback', query: {} } as any)
    const spy = vi.spyOn(authService, 'signInPopupCallback').mockResolvedValue()
    getWrapper()
    await flushPromises()
    expect(spy).toHaveBeenCalled()
  })

  it('triggers COOP fallback when signInPopupCallback fails with "window.opener"', async () => {
    vi.mocked(useRoute).mockReturnValue({ path: '/web-oidc-popup-callback', query: {} } as any)
    vi.spyOn(authService, 'signInPopupCallback').mockRejectedValue(
      new Error("No window.opener. Can't complete notification.")
    )
    const fallbackSpy = vi.spyOn(authService, 'signInCallbackForCOOPFallback').mockResolvedValue()
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {})

    getWrapper()
    await flushPromises()

    expect(fallbackSpy).toHaveBeenCalled()
    expect(closeSpy).toHaveBeenCalled()
  })

  it('shows error when signInPopupCallback fails with unrelated error', async () => {
    vi.mocked(useRoute).mockReturnValue({ path: '/web-oidc-popup-callback', query: {} } as any)
    vi.spyOn(authService, 'signInPopupCallback').mockRejectedValue(new Error('some other error'))
    vi.spyOn(authService, 'signInCallbackForCOOPFallback').mockResolvedValue()

    const { wrapper } = getWrapper()
    await flushPromises()

    // Popup path shows the minimal page; error span should be visible
    expect(wrapper.find('.popup-callback').text()).toContain('Authentication failed')
  })
})

function getWrapper() {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ query: {} })
    })
  }

  return {
    wrapper: shallowMount(oidcCallback, {
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: { configState: { server: 'http://server/address/' } }
          })
        ],
        mocks,
        provide: {}
      }
    })
  }
}
