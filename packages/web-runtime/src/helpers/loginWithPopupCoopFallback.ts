import { authService } from '../services/auth'

const POPUP_COMPLETE_CHANNEL = 'oc_oidc_popup_complete'
const FALLBACK_TIMEOUT_MS = 120_000
// Grace period after the popup flow rejects, to let an already-dispatched COOP
// "complete" message (posted by the popup just before it closed) be delivered.
// If none arrives within this window, the popup was genuinely blocked or dismissed.
const POPUP_REJECTION_GRACE_MS = 2_000

/**
 * Runs popup OIDC login and waits for the COOP BroadcastChannel fallback when the popup
 * cannot use window.opener.
 *
 * A popup promise rejection does not fail the flow immediately: under COOP the opener
 * handshake can reject even though the popup authenticated successfully and a "complete"
 * message is already in flight. We wait a short grace period for that message before
 * surfacing the failure, so a genuinely blocked popup still fails fast.
 */
export const loginWithPopupCoopFallback = (popupLogin: () => Promise<unknown>): Promise<void> => {
  return new Promise((resolve, reject) => {
    const bc = new BroadcastChannel(POPUP_COMPLETE_CHANNEL)
    let settled = false
    let graceTimeoutId: ReturnType<typeof setTimeout>

    const finish = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeoutId)
      clearTimeout(graceTimeoutId)
      bc.close()
      callback()
    }

    const timeoutId = setTimeout(() => {
      finish(() => reject(new Error('popup_auth_timeout')))
    }, FALLBACK_TIMEOUT_MS)

    bc.addEventListener('message', async (e) => {
      if (e.data?.type !== 'complete') {
        return
      }
      try {
        await authService.reloadUserFromStorage()
        finish(resolve)
      } catch (error) {
        finish(() => reject(error))
      }
    })

    popupLogin()
      .then(() => finish(resolve))
      .catch((error) => {
        graceTimeoutId = setTimeout(() => {
          finish(() => reject(error))
        }, POPUP_REJECTION_GRACE_MS)
      })
  })
}
