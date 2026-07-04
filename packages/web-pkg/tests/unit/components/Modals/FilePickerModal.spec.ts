import FilePickerModal from '../../../../src/components/Modals/FilePickerModal.vue'
import { defaultComponentMocks, defaultPlugins, shallowMount } from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@ownclouders/web-client'
import { Modal, useModals } from '../../../../src/composables/piniaStores'

describe('FilePickerModal', () => {
  describe('iframe', () => {
    it('sets the iframe src correctly', () => {
      const { wrapper } = getWrapper()
      expect(wrapper.vm.iframeSrc).toEqual(
        'http://localhost:3000/files-spaces-generic?hide-logo=true&embed=true&embed-target=file&embed-delegate-authentication=false&embed-file-types=text%2Cmd%2Ctext%2Frtf'
      )
    })
    it('sets the iframe title correctly', () => {
      const { wrapper } = getWrapper()
      expect(wrapper.vm.iframeTitle).toEqual('ownCloud')
    })
  })
  describe('method "onFilePick"', () => {
    it('does nothing if the event message does not equal "owncloud-embed:file-pick"', () => {
      const callbackFn = vi.fn()
      const { wrapper } = getWrapper({ callbackFn })
      wrapper.vm.onFilePick(mock<MessageEvent>({ data: { name: 'some-other-event' } }))
      expect(callbackFn).not.toHaveBeenCalled()
    })
    it('closes the modal and invokes callbackFn when message equals "owncloud-embed:file-pick"', () => {
      const callbackFn = vi.fn()
      const { wrapper } = getWrapper({ callbackFn })
      const modalStore = useModals()
      const resource = mock<Resource>({ storageId: '1' })
      const locationQuery = { fileId: 'abc' }

      wrapper.vm.onFilePick(
        mock<MessageEvent>({
          data: {
            name: 'owncloud-embed:file-pick',
            data: { resource, locationQuery }
          }
        })
      )
      expect(modalStore.removeModal).toHaveBeenCalled()
      expect(callbackFn).toHaveBeenCalledWith({ resource, locationQuery })
    })
  })
})

function getWrapper({ callbackFn = vi.fn() } = {}) {
  const mocks = defaultComponentMocks()

  return {
    mocks,
    wrapper: shallowMount(FilePickerModal, {
      props: {
        modal: mock<Modal>(),
        allowedFileTypes: ['text', 'md', 'text/rtf'],
        parentFolderLink: {
          name: 'files-spaces-generic',
          params: {
            driveAliasAndItem: 'personal/admin'
          },
          query: {
            fileId:
              '61dcd768-0bc4-4dd5-975a-2fe2bc9bc664$f1e4f3ec-1f24-460d-9f9a-4416ab6ddb6b!36cce768-8c9d-45e4-9c7d-4c9611962a75'
          }
        },
        callbackFn
      },
      global: {
        plugins: [...defaultPlugins()],
        mocks,
        provide: mocks
      }
    })
  }
}
