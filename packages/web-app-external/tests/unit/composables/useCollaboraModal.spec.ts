import { unref } from 'vue'
import { getComposableWrapper } from '@ownclouders/web-test-helpers'
import { useCollaboraModal } from '../../../src/composables/useCollaboraModal'

describe('useCollaboraModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
    vi.useRealTimers()
  })

  describe('isCollaboraModalClosed', () => {
    it('is falsy when never closed', () => {
      getComposableWrapper(() => {
        const { isCollaboraModalClosed } = useCollaboraModal()
        expect(unref(isCollaboraModalClosed)).toBeFalsy()
      })
    })

    it('is true when closed earlier today', () => {
      localStorage.setItem('collaboraModalClosed', new Date().toLocaleDateString())
      getComposableWrapper(() => {
        const { isCollaboraModalClosed } = useCollaboraModal()
        expect(unref(isCollaboraModalClosed)).toBe(true)
      })
    })
  })

  describe('showCollaboraModal', () => {
    it('shows the dialog after a delay and records dismissal in localStorage on close', () => {
      vi.useFakeTimers()
      getComposableWrapper(() => {
        const { showCollaboraModal } = useCollaboraModal()
        showCollaboraModal()
      })

      expect(document.getElementById('collabora-modal')).toBeFalsy()
      vi.advanceTimersByTime(2000)

      const modal = document.getElementById('collabora-modal')
      expect(modal).toBeTruthy()

      const closeButton = modal.querySelector('#collabora-close-button') as HTMLButtonElement
      closeButton.click()

      expect(localStorage.getItem('collaboraModalClosed')).toBe(new Date().toLocaleDateString())
    })
  })
})
