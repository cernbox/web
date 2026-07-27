import { ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { FilePickerModal, useModals } from '@ownclouders/web-pkg'
import { useOfficeFileOperations } from '../../../src/composables/useOfficeFileOperations'

describe('useOfficeFileOperations', () => {
  const getContext = (resourceOverrides: Partial<Resource> = {}) => ({
    space: ref(mock<SpaceResource>()),
    resource: ref(
      mock<Resource>({
        name: 'document.odt',
        extension: 'odt',
        path: '/document.odt',
        remoteItemPath: undefined,
        remoteItemId: undefined,
        ...resourceOverrides
      })
    ),
    appIframeRef: ref(null)
  })

  const getWrapper = ({
    existingFiles = [],
    ctx = getContext()
  }: { existingFiles?: Resource[]; ctx?: ReturnType<typeof getContext> } = {}) => {
    const mocks = defaultComponentMocks()
    mocks.$clientService.webdav.listFiles.mockResolvedValue({
      resource: mock<Resource>(),
      children: existingFiles
    })

    let instance: ReturnType<typeof useOfficeFileOperations>
    let modalStore: ReturnType<typeof useModals>
    const wrapper = getComposableWrapper(
      () => {
        instance = useOfficeFileOperations(ctx)
        modalStore = useModals()
      },
      { mocks, provide: mocks }
    )
    return { wrapper, mocks, ctx, getInstance: () => instance, getModalStore: () => modalStore }
  }

  describe('insertGraphic', () => {
    it('dispatches a FilePickerModal restricted to image types', async () => {
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().insertGraphic({ onPicked: vi.fn() })

      const modalStore = getModalStore()
      expect(modalStore.dispatchModal).toHaveBeenCalledWith(
        expect.objectContaining({
          customComponent: FilePickerModal,
          customComponentAttrs: expect.any(Function)
        })
      )
      const { allowedFileTypes } = vi
        .mocked(modalStore.dispatchModal)
        .mock.calls[0][0].customComponentAttrs() as { allowedFileTypes: string[] }
      expect(allowedFileTypes).toEqual(['image/png', 'image/gif', 'image/jpeg', 'image/svg'])
    })

    it("calls onPicked with the picked resource's download URL", async () => {
      const onPicked = vi.fn()
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().insertGraphic({ onPicked })

      const modalStore = getModalStore()
      const { callbackFn } = vi
        .mocked(modalStore.dispatchModal)
        .mock.calls[0][0].customComponentAttrs() as {
        callbackFn: (payload: { resource: Resource }) => void
      }
      callbackFn({ resource: mock<Resource>({ downloadURL: 'https://example.test/image.png' }) })

      expect(onPicked).toHaveBeenCalledWith('https://example.test/image.png')
    })
  })

  describe('insertFile', () => {
    it('dispatches a FilePickerModal restricted to the requested mime types', async () => {
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().insertFile({ mimeTypeFilter: ['docx'], onPicked: vi.fn() })

      const modalStore = getModalStore()
      const { allowedFileTypes } = vi
        .mocked(modalStore.dispatchModal)
        .mock.calls[0][0].customComponentAttrs() as { allowedFileTypes: string[] }
      expect(allowedFileTypes).toEqual(['docx'])
    })

    it("calls onPicked with the picked resource's download URL and file name", async () => {
      const onPicked = vi.fn()
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().insertFile({ onPicked })

      const modalStore = getModalStore()
      const { callbackFn } = vi
        .mocked(modalStore.dispatchModal)
        .mock.calls[0][0].customComponentAttrs() as {
        callbackFn: (payload: { resource: Resource }) => void
      }
      callbackFn({
        resource: mock<Resource>({
          downloadURL: 'https://example.test/doc.docx',
          name: 'doc.docx'
        })
      })

      expect(onPicked).toHaveBeenCalledWith('https://example.test/doc.docx', 'doc.docx')
    })
  })

  describe('insertLink', () => {
    it("calls onPicked with the picked resource's private link and name", async () => {
      const onPicked = vi.fn()
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().insertLink({ onPicked })

      const modalStore = getModalStore()
      const { callbackFn } = vi
        .mocked(modalStore.dispatchModal)
        .mock.calls[0][0].customComponentAttrs() as {
        callbackFn: (payload: { resource: Resource }) => void
      }
      callbackFn({
        resource: mock<Resource>({ privateLink: 'https://example.test/f/2', name: 'file.txt' })
      })

      expect(onPicked).toHaveBeenCalledWith('https://example.test/f/2', 'file.txt')
    })
  })

  describe('saveAs', () => {
    it('dispatches a modal with the resource name as the default value', async () => {
      const { getInstance, getModalStore } = getWrapper()
      const onConfirm = vi.fn()
      await getInstance().saveAs({ onConfirm })

      const modalStore = getModalStore()
      expect(modalStore.dispatchModal).toHaveBeenCalledWith(
        expect.objectContaining({ hasInput: true, inputValue: 'document.odt' })
      )
    })

    it('suggests a non-conflicting name when the default name already exists', async () => {
      const ctx = getContext()
      const { getInstance, getModalStore } = getWrapper({
        existingFiles: [mock<Resource>({ name: 'document.odt' })],
        ctx
      })
      const onConfirm = vi.fn()
      await getInstance().saveAs({ onConfirm })

      const modalStore = getModalStore()
      expect(modalStore.dispatchModal).toHaveBeenCalledWith(
        expect.objectContaining({ inputValue: 'document (1).odt' })
      )
    })

    it('builds the export-as filename using the requested extension', async () => {
      const { getInstance, getModalStore } = getWrapper()
      const onConfirm = vi.fn()
      await getInstance().saveAs({ fileExtension: 'pdf', onConfirm })

      const modalStore = getModalStore()
      expect(modalStore.dispatchModal).toHaveBeenCalledWith(
        expect.objectContaining({ inputValue: 'document.pdf' })
      )
    })

    it('calls onConfirm with the confirmed name', async () => {
      const { getInstance, getModalStore } = getWrapper()
      const onConfirm = vi.fn()
      await getInstance().saveAs({ onConfirm })

      const modalStore = getModalStore()
      const dispatchedModal = vi.mocked(modalStore.dispatchModal).mock.calls[0][0]
      dispatchedModal.onConfirm('renamed.odt')

      expect(onConfirm).toHaveBeenCalledWith('renamed.odt')
    })

    it('rejects an empty name via onInput', async () => {
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().saveAs({ onConfirm: vi.fn() })

      const modalStore = getModalStore()
      const dispatchedModal = vi.mocked(modalStore.dispatchModal).mock.calls[0][0]
      const setError = vi.fn()
      dispatchedModal.onInput('', setError)

      expect(setError).toHaveBeenCalledWith('The name cannot be empty')
    })

    it('rejects a name that conflicts with an existing file via onInput', async () => {
      const { getInstance, getModalStore } = getWrapper({
        existingFiles: [mock<Resource>({ name: 'taken.odt' })]
      })
      await getInstance().saveAs({ onConfirm: vi.fn() })

      const modalStore = getModalStore()
      const dispatchedModal = vi.mocked(modalStore.dispatchModal).mock.calls[0][0]
      const setError = vi.fn()
      dispatchedModal.onInput('taken.odt', setError)

      expect(setError).toHaveBeenCalledWith('The name "taken.odt" is already taken')
    })

    it('accepts a valid, non-conflicting name via onInput', async () => {
      const { getInstance, getModalStore } = getWrapper()
      await getInstance().saveAs({ onConfirm: vi.fn() })

      const modalStore = getModalStore()
      const dispatchedModal = vi.mocked(modalStore.dispatchModal).mock.calls[0][0]
      const setError = vi.fn()
      dispatchedModal.onInput('valid-name.odt', setError)

      expect(setError).toHaveBeenCalledWith(null)
    })
  })
})
