import { ref, unref } from 'vue'
import { getComposableWrapper } from '@ownclouders/web-test-helpers'
import { useOfficeAlert } from '../../../src/composables/useOfficeAlert'

describe('useOfficeAlert', () => {
  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  describe('isOfficeAlertClosed', () => {
    it('is falsy when never closed', () => {
      getComposableWrapper(() => {
        const { isOfficeAlertClosed } = useOfficeAlert(vi.fn())
        expect(unref(isOfficeAlertClosed)).toBeFalsy()
      })
    })

    it('is truthy once dismissed', () => {
      localStorage.setItem('officeAlertClosed', 'true')
      getComposableWrapper(() => {
        const { isOfficeAlertClosed } = useOfficeAlert(vi.fn())
        expect(unref(isOfficeAlertClosed)).toBeTruthy()
      })
    })
  })

  describe('showOfficeAlert', () => {
    it('shows the alert after a delay when the app has not loaded yet', () => {
      vi.useFakeTimers()
      const showAlert = vi.fn()
      getComposableWrapper(() => {
        const { showOfficeAlert } = useOfficeAlert(showAlert)
        showOfficeAlert(ref(false))
      })

      expect(showAlert).not.toHaveBeenCalled()
      vi.advanceTimersByTime(2000)

      expect(showAlert).toHaveBeenCalledWith(
        'office-alert',
        'danger',
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('does not show the alert once the app has already loaded', () => {
      vi.useFakeTimers()
      const showAlert = vi.fn()
      getComposableWrapper(() => {
        const { showOfficeAlert } = useOfficeAlert(showAlert)
        showOfficeAlert(ref(true))
      })

      vi.advanceTimersByTime(2000)

      expect(showAlert).not.toHaveBeenCalled()
    })

    it('records dismissal in localStorage when the alert is closed', () => {
      vi.useFakeTimers()
      const showAlert = vi.fn()
      getComposableWrapper(() => {
        const { showOfficeAlert } = useOfficeAlert(showAlert)
        showOfficeAlert(ref(false))
      })
      vi.advanceTimersByTime(2000)

      const onClose = showAlert.mock.calls[0][3]
      onClose()

      expect(localStorage.getItem('officeAlertClosed')).toBe('true')
    })
  })
})
