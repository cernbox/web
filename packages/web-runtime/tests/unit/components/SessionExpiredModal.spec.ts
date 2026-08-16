import { defaultPlugins, shallowMount, createTestingPinia } from '@ownclouders/web-test-helpers'
import { flushPromises } from '@vue/test-utils'
import SessionExpiredModal from '../../../src/components/SessionExpiredModal.vue'
import { useAuthService, useAuthStore } from '@ownclouders/web-pkg'
import { loginWithPopupCoopFallback } from '../../../src/helpers/loginWithPopupCoopFallback'

const mockAuthService = {
  loginUserPopup: vi.fn(),
  signinSilent: vi.fn(),
  reloadUserFromStorage: vi.fn()
}

vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuthService: vi.fn()
}))

// the COOP/BroadcastChannel plumbing is covered by loginWithPopupCoopFallback.spec.ts;
// here we only care that the component drives it and reacts to the outcome
vi.mock('../../../src/helpers/loginWithPopupCoopFallback', () => ({
  loginWithPopupCoopFallback: vi.fn()
}))

describe('SessionExpiredModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuthService).mockReturnValue(mockAuthService as any)
    vi.mocked(loginWithPopupCoopFallback).mockImplementation((popupLogin) =>
      popupLogin().then(() => undefined)
    )
  })

  it('is hidden when sessionExpired is false', () => {
    const { wrapper } = getWrapper({ sessionExpired: false })
    expect(wrapper.find('.session-expired-overlay').exists()).toBe(false)
  })

  it('is visible when sessionExpired is true', () => {
    const { wrapper } = getWrapper({ sessionExpired: true })
    expect(wrapper.find('.session-expired-overlay').exists()).toBe(true)
  })

  it('reconnect: dismisses modal on successful popup login', async () => {
    mockAuthService.loginUserPopup.mockResolvedValue(undefined)
    const { wrapper, authStore } = getWrapper({ sessionExpired: true })

    await wrapper.find('oc-button-stub').trigger('click')
    await flushPromises()

    expect(authStore.sessionExpired).toBe(false)
  })

  it('reconnect: shows popup-blocked hint when popup throws', async () => {
    mockAuthService.loginUserPopup.mockRejectedValue(new Error('Popup blocked'))
    const { wrapper } = getWrapper({ sessionExpired: true })

    await wrapper.find('oc-button-stub').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Popup was blocked')
  })

  it('dismisses when storage event signals another tab refreshed the token', async () => {
    mockAuthService.signinSilent.mockResolvedValue(undefined)
    const { authStore } = getWrapper({ sessionExpired: true })

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'oc_oAuth.user:something', newValue: '{"token":"x"}' })
    )
    await flushPromises()

    expect(mockAuthService.signinSilent).toHaveBeenCalled()
    expect(authStore.sessionExpired).toBe(false)
  })

  it('ignores storage events for unrelated keys', async () => {
    mockAuthService.signinSilent.mockResolvedValue(undefined)
    const { authStore } = getWrapper({ sessionExpired: true })

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'v' }))
    await flushPromises()

    expect(mockAuthService.signinSilent).not.toHaveBeenCalled()
    expect(authStore.sessionExpired).toBe(true)
  })
})

function getWrapper({ sessionExpired = false } = {}) {
  // Create pinia first so we can set initial state before the component mounts
  const pinia = createTestingPinia({ stubActions: false })
  const authStore = useAuthStore(pinia)
  authStore.sessionExpired = sessionExpired

  const wrapper = shallowMount(SessionExpiredModal, {
    global: {
      plugins: [...defaultPlugins({ pinia: false }), pinia]
    }
  })

  return { wrapper, authStore }
}
