import { computed, unref, type Ref } from 'vue'
import { useGettext } from 'vue3-gettext'

export type ShowAlertFn = (
  id: string,
  status: 'danger' | 'warning',
  buildContent: (content: HTMLElement) => void,
  onClose?: () => void,
  action?: { label: string; onClick: () => void }
) => void

/**
 * The "having connection issues with MS365?" banner - shown once per page load, 2s after
 * mount, if the app still hasn't loaded by then and hasn't already been dismissed for good
 * via localStorage. Mirrors useCollaboraModal.ts's one-time-disclaimer shape
 * (is*Closed computed + show* function), but reuses App.vue's generic alert DOM-builder
 * (showAlert) rather than building its own markup from scratch, since that builder is also
 * shared with the unrelated file-locked warning.
 */
export function useOfficeAlert(showAlert: ShowAlertFn) {
  const { $gettext } = useGettext()

  const isOfficeAlertClosed = computed(() => {
    return localStorage.getItem('officeAlertClosed')
  })

  const showOfficeAlert = (isAppLoaded: Ref<boolean>): void => {
    setTimeout(() => {
      if (unref(isAppLoaded)) {
        return
      }
      showAlert(
        'office-alert',
        'danger',
        (content) => {
          content.innerHTML = $gettext(
            'Having connection issues displaying Office files? Try and refresh this page until it loads properly and please&nbsp;'
          )
          content.innerHTML += `<a
              target="_blank"
              rel="noopener noreferrer"
              href="https://cern.service-now.com/service-portal?id=sc_cat_item&name=request&se=CERNBox-Service&short_description=MS365%20issue%20feedback"
            >
              let us know so we can report the issue
            </a>!`
        },
        () => localStorage.setItem('officeAlertClosed', 'true')
      )
    }, 2000)
  }

  return { isOfficeAlertClosed, showOfficeAlert }
}
