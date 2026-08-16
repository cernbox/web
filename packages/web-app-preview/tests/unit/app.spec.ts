import App from '../../src/App.vue'
import { nextTick, ref } from 'vue'
import { defaultComponentMocks, defaultPlugins, shallowMount } from '@ownclouders/web-test-helpers'
import { FileContext, isLocationSharesActive, queryItemAsString } from '@ownclouders/web-pkg'
import { mock } from 'vitest-mock-extended'

vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  queryItemAsString: vi.fn(),
  isLocationSharesActive: vi.fn(),
  createFileRouteOptions: vi.fn(() => ({ params: {}, query: {} }))
}))

const activeFiles = [
  {
    id: '1',
    fileId: '1',
    remoteItemId: 'remote-1',
    spaceId: '1',
    name: 'bear.png',
    mimeType: 'image/png',
    path: 'personal/admin/bear.png',
    hidden: false,
    canDownload: () => true
  },
  {
    id: '2',
    fileId: '2',
    remoteItemId: 'remote-2',
    spaceId: '1',
    name: 'elephant.png',
    mimeType: 'image/png',
    path: 'personal/admin/elephant.png',
    hidden: false,
    canDownload: () => true
  },
  {
    id: '3',
    fileId: '3',
    spaceId: '1',
    name: 'wale_sounds.flac',
    mimeType: 'audio/flac',
    path: 'personal/admin/wale_sounds.flac',
    hidden: true,
    canDownload: () => true
  },
  {
    id: '4',
    fileId: '4',
    spaceId: '1',
    name: 'lonely_sloth_very_sad.gif',
    mimeType: 'image/gif',
    path: 'personal/admin/lonely_sloth_very_sad.gif',
    hidden: false,
    canDownload: () => true
  },
  {
    id: '5',
    fileId: '5',
    spaceId: '1',
    name: 'tiger_eats_plants.mp4',
    mimeType: 'video/mp4',
    path: 'personal/admin/tiger_eats_plants.mp4',
    hidden: true,
    canDownload: () => true
  },
  {
    id: '6',
    fileId: '6',
    spaceId: '1',
    name: 'happy_hippo.gif',
    mimeType: 'image/gif',
    path: 'personal/admin/happy_hippo.gif',
    hidden: false,
    canDownload: () => true
  },
  {
    id: '7',
    fileId: '7',
    spaceId: '1',
    name: 'sleeping_dog.gif',
    mimeType: 'image/gif',
    path: 'personal/admin/sleeping_dog.gif',
    hidden: false,
    canDownload: () => true
  },
  {
    id: '8',
    fileId: '8',
    spaceId: '1',
    name: 'cat_murr_murr.gif',
    mimeType: 'image/gif',
    path: 'personal/admin/cat_murr_murr.gif',
    hidden: false,
    canDownload: () => true
  },
  {
    id: '9',
    fileId: '9',
    spaceId: '1',
    name: 'labrador.gif',
    mimeType: 'image/gif',
    path: 'personal/admin/labrador.gif',
    hidden: false,
    canDownload: () => true
  }
]

describe('Preview app', () => {
  describe('Method "preloadImages"', () => {
    it('should preload images if active file changes', async () => {
      const { wrapper } = createShallowMountWrapper()
      await nextTick()
      ;(wrapper.vm as any).cachedFiles = {}
      ;(wrapper.vm as any).goToNext()

      await nextTick()

      expect(
        Object.values((wrapper.vm as any).cachedFiles)
          .filter((cachedFile) => (cachedFile as any).isImage)
          .map((cachedFile) => (cachedFile as any).id)
          .sort((a, b) => a.localeCompare(b))
      ).toEqual(['1', '2', '4', '6', '7', '8', '9'])
    })
  })

  describe('Computed "filteredFiles"', () => {
    it('should hide hidden shares if the share visibility query is not set to "hidden"', () => {
      const { wrapper } = createShallowMountWrapper()
      expect((wrapper.vm as any).filteredFiles.length).toStrictEqual(7)
    })

    it('should hide visible shares if the share visibility query is set to "hidden"', () => {
      const { wrapper } = createShallowMountWrapper({
        currentFileContext: { routeQuery: ref({ ['q_share-visibility']: 'hidden' }) }
      })
      expect((wrapper.vm as any).filteredFiles.length).toStrictEqual(2)
    })

    it('should filter files even when routeQuery is undefined', () => {
      const { wrapper } = createShallowMountWrapper({
        currentFileContext: { routeQuery: undefined }
      })
      expect((wrapper.vm as any).filteredFiles.length).toStrictEqual(7)
    })
  })

  describe('Method "setActiveFile"', () => {
    it('matches on remoteItemId on Shared with me', async () => {
      const { wrapper } = createShallowMountWrapper({ sharedWithMe: true, fileId: 'remote-2' })
      await nextTick()
      expect((wrapper.vm as any).activeFilteredFile.id).toStrictEqual('2')
    })

    it('matches on fileId on Shared with me when fullShareOwnerPaths is enabled', async () => {
      // the owner's real space is resolved instead of a share space, so resources carry no
      // remoteItemId and matching has to fall back to the regular fileId
      const { wrapper } = createShallowMountWrapper({
        sharedWithMe: true,
        fullShareOwnerPaths: true,
        fileId: '2'
      })
      await nextTick()
      expect((wrapper.vm as any).activeFilteredFile.id).toStrictEqual('2')
    })
  })
})

function createShallowMountWrapper({
  currentFileContext,
  sharedWithMe = false,
  fullShareOwnerPaths = false,
  fileId = '1'
}: {
  currentFileContext?: Partial<FileContext>
  sharedWithMe?: boolean
  fullShareOwnerPaths?: boolean
  fileId?: string
} = {}) {
  const mocks = defaultComponentMocks()
  mocks.$previewService.loadPreview.mockResolvedValue('')
  vi.mocked(queryItemAsString).mockImplementation(() => fileId)
  vi.mocked(isLocationSharesActive).mockReturnValue(sharedWithMe)

  return {
    wrapper: shallowMount(App, {
      props: {
        currentFileContext: mock<FileContext>({
          path: 'personal/admin/bear.png',
          ...currentFileContext
        }),
        activeFiles,
        isFolderLoading: true,
        revokeUrl: vi.fn(),
        getUrlForResource: vi.fn(),
        loadFolderForFileContext: vi.fn()
      },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              configState: { options: { routing: { fullShareOwnerPaths } } } as any
            }
          })
        ],
        mocks,
        provide: mocks
      }
    })
  }
}
