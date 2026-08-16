import CreateNewFileModal from '../../../../src/components/Modals/CreateNewFileModal.vue'
import { defaultComponentMocks, defaultPlugins, shallowMount } from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { Modal } from '../../../../src/composables/piniaStores'
import { ApplicationFileExtension } from '../../../../src/apps'

describe('CreateNewFileModal', () => {
  describe('app dropdown', () => {
    it('is not rendered when only one app file extension is given', () => {
      const appFileExtensions = [mock<ApplicationFileExtension>({ app: 'app-a' })]
      const { wrapper } = getWrapper({
        props: {
          appFileExtensions,
          defaultAppFileExtension: appFileExtensions[0]
        }
      })

      expect(wrapper.find('oc-filter-chip-stub').exists()).toBeFalsy()
    })

    it('is rendered with one option per app file extension when several are given', () => {
      const appFileExtensions = [
        mock<ApplicationFileExtension>({ app: 'app-a' }),
        mock<ApplicationFileExtension>({ app: 'app-b' })
      ]
      const { wrapper } = getWrapper({
        props: {
          appFileExtensions,
          defaultAppFileExtension: appFileExtensions[0]
        }
      })

      expect(wrapper.find('oc-filter-chip-stub').exists()).toBeTruthy()
      expect(wrapper.vm.appOptions.length).toBe(2)
    })

    it('defaults the selection to the given defaultAppFileExtension', () => {
      const appFileExtensions = [
        mock<ApplicationFileExtension>({ app: 'app-a' }),
        mock<ApplicationFileExtension>({ app: 'app-b' })
      ]
      const { wrapper } = getWrapper({
        props: {
          appFileExtensions,
          defaultAppFileExtension: appFileExtensions[1]
        }
      })

      expect(wrapper.vm.selectedOption.appFileExtension).toEqual(appFileExtensions[1])
    })
  })

  describe('onFileNameInput', () => {
    it('updates the name error via the given getNameErrorMsg', () => {
      const getNameErrorMsg = vi.fn().mockReturnValue('some error')
      const { wrapper } = getWrapper({ props: { getNameErrorMsg } })

      wrapper.vm.onFileNameInput('new-name.txt')

      expect(getNameErrorMsg).toHaveBeenCalledWith('new-name.txt')
      expect(wrapper.vm.nameError).toBe('some error')
    })
  })

  describe('onConfirm', () => {
    it('calls the callback with the file name and the default app file extension', () => {
      const callbackFn = vi.fn()
      const appFileExtensions = [mock<ApplicationFileExtension>({ app: 'app-a' })]
      const { wrapper } = getWrapper({
        props: {
          callbackFn,
          defaultName: 'file.txt',
          appFileExtensions,
          defaultAppFileExtension: appFileExtensions[0]
        }
      })

      wrapper.vm.onConfirm()

      expect(callbackFn).toHaveBeenCalledWith('file.txt', appFileExtensions[0])
    })

    it('calls the callback with the app chosen via the dropdown', () => {
      const callbackFn = vi.fn()
      const appFileExtensions = [
        mock<ApplicationFileExtension>({ app: 'app-a' }),
        mock<ApplicationFileExtension>({ app: 'app-b' })
      ]
      const { wrapper } = getWrapper({
        props: {
          callbackFn,
          defaultName: 'file.txt',
          appFileExtensions,
          defaultAppFileExtension: appFileExtensions[0]
        }
      })

      wrapper.vm.onAppChange(wrapper.vm.appOptions[1])
      wrapper.vm.onConfirm()

      expect(callbackFn).toHaveBeenCalledWith('file.txt', appFileExtensions[1])
    })

    it('does not call the callback when there is a name error', () => {
      const callbackFn = vi.fn()
      const { wrapper } = getWrapper({
        props: { callbackFn, getNameErrorMsg: vi.fn().mockReturnValue('some error') }
      })

      wrapper.vm.onConfirm()

      expect(callbackFn).not.toHaveBeenCalled()
    })
  })
})

function getWrapper({ props = {} } = {}) {
  const mocks = defaultComponentMocks()
  const appFileExtensions = [mock<ApplicationFileExtension>({ app: 'app-a' })]

  return {
    mocks,
    wrapper: shallowMount(CreateNewFileModal, {
      props: {
        modal: mock<Modal>(),
        defaultName: 'New file.txt',
        inputSelectionRange: null,
        appFileExtensions,
        defaultAppFileExtension: appFileExtensions[0],
        getNameErrorMsg: vi.fn().mockReturnValue(null),
        callbackFn: vi.fn(),
        ...props
      },
      global: {
        plugins: [...defaultPlugins()],
        mocks,
        provide: mocks,
        renderStubDefaultSlot: true,
        stubs: { OcTextInput: false }
      }
    })
  }
}
