import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mock } from 'vitest-mock-extended'
import {
  defaultComponentMocks,
  defaultPlugins,
  defaultStubs,
  RouteLocation,
  shallowMount
} from '@ownclouders/web-test-helpers'
import { ApplicationInformation, Resource, SpaceResource } from '@ownclouders/web-client'
import { DavPermission } from '@ownclouders/web-client/webdav'
import AppWrapper from '../../../../src/components/AppTemplates/AppWrapper.vue'
import { FileContext } from '../../../../src/composables/appDefaults/types'
import { useAppDefaults } from '../../../../src/composables'

vi.mock('../../../../src/composables', async () => {
  const actual = await vi.importActual<typeof import('../../../../src/composables')>(
    '../../../../src/composables'
  )
  return {
    ...actual,
    useAppDefaults: vi.fn()
  }
})

const wrappedEditorComponent = {
  emits: ['update:currentContent'],
  props: {
    currentContent: {},
    url: {}
  },
  template: '<div />'
}

describe('AppWrapper', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let getFileInfoMock: ReturnType<typeof vi.fn>
  let getFileContentsMock: ReturnType<typeof vi.fn>
  let putFileContentsMock: ReturnType<typeof vi.fn>

  const createFileContext = (): FileContext => {
    const space = mock<SpaceResource>({ id: 'space-id' })
    return {
      routeName: ref('files-spaces-generic'),
      space: ref(space),
      item: ref('/file.txt'),
      itemId: ref('file-id'),
      path: ref('/file.txt'),
      driveAliasAndItem: ref('personal/file.txt'),
      fileName: ref('file.txt'),
      routeParams: ref({}),
      routeQuery: ref({})
    }
  }

  const mountWrapper = () => {
    const mocks = defaultComponentMocks({
      currentRoute: mock<RouteLocation>({
        name: 'files-app',
        path: '/files/personal/file.txt',
        params: { driveAliasAndItem: 'personal/file.txt' }
      })
    })

    return shallowMount(AppWrapper, {
      props: {
        applicationId: 'test-app',
        wrappedComponent: wrappedEditorComponent
      },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              stubActions: false,
              appsState: {
                apps: {
                  'test-app': mock<ApplicationInformation>({ name: 'Test App' })
                }
              }
            }
          })
        ],
        mocks,
        provide: mocks,
        stubs: {
          ...defaultStubs,
          AppTopBar: true,
          FileSideBar: true,
          ErrorScreen: true,
          LoadingScreen: true
        }
      }
    })
  }

  const setupAppDefaults = () => {
    const currentFileContext = ref<FileContext>(createFileContext())
    getFileInfoMock = vi.fn()
    getFileContentsMock = vi.fn()
    putFileContentsMock = vi.fn()

    vi.mocked(useAppDefaults).mockReturnValue({
      applicationConfig: ref({}),
      closeApp: vi.fn(),
      currentFileContext,
      getFileContents: getFileContentsMock,
      getFileInfo: getFileInfoMock,
      getUrlForResource: vi.fn(),
      putFileContents: putFileContentsMock,
      replaceInvalidFileRoute: vi.fn(() => false),
      revokeUrl: vi.fn(),
      activeFiles: ref([]),
      loadFolderForFileContext: vi.fn(),
      isFolderLoading: ref(false),
      isPublicLinkContext: ref(false)
    } as ReturnType<typeof useAppDefaults>)
  }

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setupAppDefaults()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe('error logging', () => {
    it('logs a redacted message when loading the app resource fails', async () => {
      const sensitiveError = Object.assign(new Error('leaked'), {
        url: 'https://example.test/?token=secret'
      })
      getFileInfoMock.mockRejectedValue(sensitiveError)

      const wrapper = mountWrapper()
      await flushPromises()

      expect(wrapper.vm.loadingError).toBe(sensitiveError)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app resource')
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(sensitiveError)
    })

    it('logs a redacted message when loading the app file fails', async () => {
      const fileResource = mock<Resource>({
        name: 'file.txt',
        path: '/file.txt',
        permissions: DavPermission.Updateable
      })
      const sensitiveError = Object.assign(new Error('leaked'), {
        config: { url: 'https://example.test/?token=secret' }
      })
      getFileInfoMock.mockResolvedValue(fileResource)
      getFileContentsMock.mockRejectedValue(sensitiveError)

      mountWrapper()
      await flushPromises()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app file')
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(sensitiveError)
    })

    it('logs a redacted message when saving the file fails', async () => {
      const fileResource = mock<Resource>({
        name: 'file.txt',
        path: '/file.txt',
        permissions: DavPermission.Updateable,
        storageId: 'space-id'
      })
      const sensitiveError = {
        statusCode: 500,
        response: { status: 500, data: { token: 'secret' } }
      }
      getFileInfoMock.mockResolvedValue(fileResource)
      getFileContentsMock.mockResolvedValue({
        body: 'initial',
        headers: { 'OC-ETag': 'etag-1' }
      })
      putFileContentsMock.mockRejectedValue(sensitiveError)

      const wrapper = mountWrapper()
      await flushPromises()

      wrapper.vm.slotAttrs['onUpdate:currentContent']('changed')
      await flushPromises()

      await wrapper.vm.slotAttrs.onSave()
      await flushPromises()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save file')
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(sensitiveError)
    })
  })
})
