import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

/**
 * The one-time "Collabora is experimental" onboarding disclaimer, shown once per day
 * until dismissed for good via localStorage.
 */
export function useCollaboraModal() {
  const { $gettext } = useGettext()

  const isCollaboraModalClosed = computed(() => {
    const currentDate = new Date().toLocaleDateString()
    return localStorage.getItem('collaboraModalClosed') === currentDate
  })

  const showCollaboraModal = (): void => {
    const collaboraModal = document.createElement('dialog') as HTMLDialogElement
    collaboraModal.id = 'collabora-modal'
    collaboraModal.innerHTML = `
      <form method="dialog" class="oc-p-m">
        <div class="oc-flex oc-flex-around oc-flex-middle oc-mb-m">
          <img src="https://cernbox.docs.cern.ch/assets/images/logo-full.png" height="100"/>
          <img src="https://www.collaboraonline.com/wp-content/uploads/2023/06/collabora-online-primary300-e1709657485501.png" height="70"/>
        </div>
        <h3>Collabora Online</h3>
        <p>
          The Collabora integration in CERNBox is
            <span class="oc-text-bold oc-background-highlight">experimental</span>,
            <span class="oc-text-bold oc-background-highlight">time-limited</span>, and is provided for
            <span class="oc-text-bold oc-background-highlight">testing</span>
            and <span class="oc-text-bold oc-background-highlight">evaluation purposes only</span>
          (<a
            target="_blank"
            rel="noopener noreferrer"
            href="https://cernbox.docs.cern.ch/web/apps/collabora/"
          >know more here</a>).
        </p>
        <p>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://indico.cern.ch/event/1652846/surveys/7168"
          >Please provide feedback via this survey!</a>
        </p>
        <menu class="oc-flex oc-flex-center oc-m-rm oc-px-rm">
          <button class="oc-button oc-button-m oc-button-primary oc-button-primary-filled oc-rounded oc-py-s oc-px-xxl" id="collabora-close-button">
            ${$gettext('I understand')}
          </button>
        </menu>
      </form>
    `
    collaboraModal.style.cssText = `
      background-color: var(--oc-color-background-default);
      border: none;
      border-radius: 16px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      min-width: min-content;
      width: 30vw;
      max-width: 80vw;
      padding: 20px;
    `
    const closeButton = collaboraModal.querySelector('#collabora-close-button') as HTMLButtonElement
    closeButton.onclick = () => {
      const currentDate = new Date().toLocaleDateString()
      localStorage.setItem('collaboraModalClosed', currentDate)
    }
    setTimeout(() => {
      document.body.appendChild(collaboraModal)
      collaboraModal.showModal()
    }, 2000)
  }

  return { isCollaboraModalClosed, showCollaboraModal }
}
