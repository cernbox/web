import { loginWithPopupCoopFallback } from '../../../src/helpers/loginWithPopupCoopFallback'
import { authService } from '../../../src/services/auth'

vi.mock('../../../src/services/auth', () => ({
  authService: {
    reloadUserFromStorage: vi.fn()
  }
}))

describe('loginWithPopupCoopFallback', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('resolves when popup login succeeds', async () => {
    const popupLogin = vi.fn().mockResolvedValue(undefined)

    await expect(loginWithPopupCoopFallback(popupLogin)).resolves.toBeUndefined()
    expect(popupLogin).toHaveBeenCalledTimes(1)
    expect(authService.reloadUserFromStorage).not.toHaveBeenCalled()
  })

  it('resolves via BroadcastChannel when a COOP completion arrives after popup rejection', async () => {
    vi.useFakeTimers()
    const popupLogin = vi.fn().mockRejectedValue(new Error('popup blocked'))

    const loginPromise = loginWithPopupCoopFallback(popupLogin)

    const bc = new BroadcastChannel('oc_oidc_popup_complete')
    bc.postMessage({ type: 'complete' })
    bc.close()

    await expect(loginPromise).resolves.toBeUndefined()
    expect(authService.reloadUserFromStorage).toHaveBeenCalledTimes(1)
  })

  it('rejects after the grace period when the popup is blocked and no completion arrives', async () => {
    vi.useFakeTimers()
    const error = new Error('popup blocked')
    const popupLogin = vi.fn().mockRejectedValue(error)

    const loginPromise = loginWithPopupCoopFallback(popupLogin)
    const expectation = expect(loginPromise).rejects.toBe(error)

    await vi.advanceTimersByTimeAsync(2_000)

    await expectation
    expect(authService.reloadUserFromStorage).not.toHaveBeenCalled()
  })
})
