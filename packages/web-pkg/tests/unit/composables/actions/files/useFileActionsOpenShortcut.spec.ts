import { mock } from 'vitest-mock-extended'
import { ref, unref } from 'vue'
import {
  defaultComponentMocks,
  RouteLocation,
  getComposableWrapper
} from '@ownclouders/web-test-helpers'
import { useFileActionsOpenShortcut, useRoute, useSpacesStore } from '../../../../../src'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { GetFileContentsResponse } from '@ownclouders/web-client/webdav'

vi.mock('../../../../../src/composables/router', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useRoute: vi.fn()
}))

window = Object.create(window)
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://demo.owncloud.com'
  },
  writable: true
})
Object.defineProperty(window, 'open', { writable: true })
window.open = vi.fn()

// @vitest-environment jsdom
describe('openShortcut', () => {
  describe('computed property "actions"', () => {
    describe('method "isVisible"', () => {
      it.each([
        {
          resources: [],
          expectedStatus: false
        },
        {
          resources: [mock<Resource>({ extension: 'txt', linkTarget: undefined })],
          expectedStatus: false
        },
        {
          resources: [mock<Resource>({ extension: 'url', linkTarget: undefined, canDownload: () => false })],
          expectedStatus: false
        },
        {
          resources: [mock<Resource>({ extension: 'url', linkTarget: undefined, canDownload: () => true })],
          expectedStatus: true
        },
        {
          resources: [mock<Resource>({ extension: 'lnk', linkTarget: undefined })],
          expectedStatus: false
        },
        {
          resources: [mock<Resource>({ extension: 'lnk', linkTarget: '/docs' })],
          expectedStatus: true
        },
        {
          resources: [mock<Resource>({ extension: '', linkType: 'symlink', linkTarget: '/docs' })],
          expectedStatus: true
        }
      ])('should be set correctly', ({ resources, expectedStatus }) => {
        getWrapper({
          setup: ({ actions }) => {
            expect(unref(actions)[0].isVisible({ resources, space: null })).toBe(expectedStatus)
          }
        })
      })
    })
    describe('method "handler"', () => {
      it('adds http(s) protocol if missing and opens the url in a new tab', () => {
        getWrapper({
          getFileContentsValue: '[InternetShortcut]\nURL=owncloud.com',
          setup: async ({ actions }) => {
            await unref(actions)[0].handler({
              resources: [mock<Resource>({ linkTarget: undefined })],
              space: null
            })
            expect(window.open).toHaveBeenCalledWith('https://owncloud.com')
          }
        })
      })
      it('omits xss code and opens the url in a new tab', () => {
        getWrapper({
          getFileContentsValue:
            '[InternetShortcut]\nURL=https://owncloud.com?default=<script>alert(document.cookie)</script>',
          setup: async ({ actions }) => {
            await unref(actions)[0].handler({
              resources: [mock<Resource>({ linkTarget: undefined })],
              space: null
            })
            expect(window.open).toHaveBeenCalledWith('https://owncloud.com?default=')
          }
        })
      })
      it('opens the url in the same window if url links to OCIS instance', () => {
        getWrapper({
          getFileContentsValue: '[InternetShortcut]\nURL=https://demo.owncloud.com',
          setup: async ({ actions }) => {
            await unref(actions)[0].handler({
              resources: [mock<Resource>({ linkTarget: undefined })],
              space: null
            })
            expect(window.location.href).toBe('https://demo.owncloud.com')
          }
        })
      })
    })
  })
  describe('method "handler" for links', () => {
    it('navigates to the target folder', () => {
      const { mocks } = getWrapper({
        fileInfo: mock<Resource>({ isFolder: true, path: '/docs', fileId: 'f1' }),
        setup: async ({ actions }) => {
          await unref(actions)[0].handler({
            resources: [mock<Resource>({ linkTarget: '/docs', linkTargetSpaceId: undefined })],
            space: mock<SpaceResource>()
          })
          expect(mocks.$clientService.webdav.getFileInfo).toHaveBeenCalledWith(expect.anything(), {
            path: '/docs'
          })
          expect(mocks.$router.push).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'files-spaces-generic' })
          )
          expect(mocks.$router.push.mock.calls[0][0].query?.scrollTo).toBeUndefined()
        }
      })
    })
    it('navigates to the parent folder of a target file and opens it', () => {
      const { mocks } = getWrapper({
        fileInfo: mock<Resource>({
          isFolder: false,
          path: '/docs/report.docx',
          fileId: 'f2',
          parentFolderId: 'f1'
        }),
        setup: async ({ actions }) => {
          await unref(actions)[0].handler({
            resources: [mock<Resource>({ linkTarget: '/docs/report.docx', linkTargetSpaceId: undefined })],
            space: mock<SpaceResource>()
          })
          expect(mocks.$router.push).toHaveBeenCalledWith(
            expect.objectContaining({
              name: 'files-spaces-generic',
              query: expect.objectContaining({ scrollTo: 'f2', openWithDefaultApp: 'true' })
            })
          )
        }
      })
    })
    it('shows an error if the target is not available', () => {
      const { mocks } = getWrapper({
        fileInfoError: new Error('not found'),
        setup: async ({ actions }) => {
          await unref(actions)[0].handler({
            resources: [mock<Resource>({ linkTarget: '/gone', linkTargetSpaceId: undefined, name: 'l.lnk' })],
            space: mock<SpaceResource>()
          })
          expect(mocks.$router.push).not.toHaveBeenCalled()
        }
      })
    })
    it('navigates to a target in another space known to the user', () => {
      const targetSpace = mock<SpaceResource>({ id: 'eosproject$abc' })
      const { mocks } = getWrapper({
        fileInfo: mock<Resource>({ isFolder: true, path: '/docs', fileId: 'f1' }),
        setup: async ({ actions }) => {
          vi.mocked(useSpacesStore().getSpace).mockReturnValue(targetSpace)
          await unref(actions)[0].handler({
            resources: [mock<Resource>({ linkTarget: '/docs', linkTargetSpaceId: 'eosproject$abc' })],
            space: mock<SpaceResource>({ id: 'eoshome$xyz' })
          })
          expect(useSpacesStore().getSpace).toHaveBeenCalledWith('eosproject$abc')
          expect(mocks.$clientService.webdav.getFileInfo).toHaveBeenCalledWith(targetSpace, {
            path: '/docs'
          })
          expect(mocks.$router.push).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'files-spaces-generic' })
          )
        }
      })
    })
    it('resolves a target in a space unknown to the user by its id', () => {
      const { mocks } = getWrapper({
        fileInfo: mock<Resource>({ isFolder: false, path: '/x.txt', fileId: 'f3' }),
        setup: async ({ actions }) => {
          vi.mocked(useSpacesStore().getSpace).mockReturnValue(undefined)
          await unref(actions)[0].handler({
            resources: [mock<Resource>({ linkTarget: '/x.txt', linkTargetSpaceId: 'eoshome$other' })],
            space: mock<SpaceResource>({ id: 'eoshome$xyz' })
          })
          expect(useSpacesStore().loadSpacesByType).toHaveBeenCalledWith(
            'project',
            expect.anything()
          )
          expect(mocks.$clientService.webdav.getFileInfo).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'eoshome$other', webDavPath: '/spaces/eoshome$other' }),
            { path: '/x.txt' }
          )
          expect(mocks.$router.push).toHaveBeenCalledWith({
            name: 'resolvePrivateLink',
            params: { fileId: 'f3' }
          })
        }
      })
    })
  })
  describe('method "extractUrl"', () => {
    it('extracts url correctly', () => {
      getWrapper({
        setup: ({ extractUrl }) => {
          expect(extractUrl('[InternetShortcut]\n' + 'URL=https://owncloud.com')).toEqual(
            'https://owncloud.com'
          )
        }
      })
    })
    it('throws error if url cannot be extracted', () => {
      getWrapper({
        setup: ({ extractUrl }) => {
          expect(() => extractUrl('�������')).toThrow('unable to extract url')
        }
      })
    })
  })
})

function getWrapper({
  setup,
  getFileContentsValue = null,
  fileInfo = null,
  fileInfoError = null
}: {
  getFileContentsValue?: string
  fileInfo?: Resource
  fileInfoError?: Error
  setup: (instance: ReturnType<typeof useFileActionsOpenShortcut>) => void
}) {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ name: 'files-spaces-generic' })
    })
  }

  mocks.$clientService.webdav.getFileContents.mockResolvedValue(
    mock<GetFileContentsResponse>({
      body: getFileContentsValue
    })
  )

  if (fileInfoError) {
    mocks.$clientService.webdav.getFileInfo.mockRejectedValue(fileInfoError)
  } else {
    mocks.$clientService.webdav.getFileInfo.mockResolvedValue(fileInfo)
  }

  vi.mocked(useRoute).mockImplementation(() =>
    ref(mock<RouteLocation>({ name: 'files-spaces-generic', path: '/files/' }))
  )

  return {
    mocks,
    wrapper: getComposableWrapper(
      () => {
        const instance = useFileActionsOpenShortcut()
        setup(instance)
      },
      {
        mocks,
        provide: mocks
      }
    )
  }
}
