import { useDriveResolver } from '../../../../src/composables/driveResolver'
import { ref, unref } from 'vue'
import { mock, mockDeep } from 'vitest-mock-extended'
import { isShareSpaceResource, ShareSpaceResource, SpaceResource } from '@ownclouders/web-client'
import {
  getComposableWrapper,
  defaultComponentMocks,
  RouteLocation
} from '@ownclouders/web-test-helpers'
import { useSpacesStore } from '../../../../src/composables/piniaStores'

describe('useDriveResolver', () => {
  it('should be valid', () => {
    expect(useDriveResolver).toBeDefined()
  })
  it('space and item should be null when no driveAliasAndItem given', () => {
    const mocks = defaultComponentMocks()

    getComposableWrapper(
      () => {
        const { space, item } = useDriveResolver({ driveAliasAndItem: ref('') })
        expect(unref(space)).toEqual(null)
        expect(unref(item)).toEqual(null)
      },
      { mocks, provide: mocks }
    )
  })
  it('returns a public space on a public page', () => {
    const token = 'token'
    const spaceMock = mockDeep<SpaceResource>({ id: token })

    const mocks = defaultComponentMocks()

    getComposableWrapper(
      () => {
        const { space, item } = useDriveResolver({ driveAliasAndItem: ref(`public/${token}`) })
        expect(unref(space)).toEqual(spaceMock)
        expect(unref(item)).toEqual('/')
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: { piniaOptions: { spacesState: { spaces: [spaceMock] } } }
      }
    )
  })
  it('returns a share space for a share', () => {
    const shareSpace = mockDeep<ShareSpaceResource>({ driveType: 'share' })

    const mocks = defaultComponentMocks()
    getComposableWrapper(
      () => {
        const spacesStore = useSpacesStore()
        vi.mocked(spacesStore.createShareSpace).mockReturnValue(shareSpace)
        const { space, item } = useDriveResolver({
          driveAliasAndItem: ref(`share/someSharedFolder`)
        })
        expect(isShareSpaceResource(unref(space))).toEqual(true)
        expect(unref(item)).toEqual('/')
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: { piniaOptions: { spacesState: { spaces: [shareSpace] } } }
      }
    )
  })
  it('returns a space by fileId if given', () => {
    const fileId = 'someFileId'
    const resourcePath = '/someFolder'
    const spaceMock = mockDeep<SpaceResource>({ fileId, driveAlias: 'driveAlias' })
    const mocks = defaultComponentMocks({
      currentRoute: mock<RouteLocation>({
        name: 'files-spaces-generic',
        path: '/',
        query: { fileId }
      })
    })

    getComposableWrapper(
      () => {
        const { space, item, itemId } = useDriveResolver({
          driveAliasAndItem: ref(`/personal${resourcePath}`)
        })
        expect(unref(space)).toEqual(spaceMock)
        expect(unref(item)).toEqual(resourcePath)
        expect(unref(itemId)).toEqual(fileId)
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: { piniaOptions: { spacesState: { spaces: [spaceMock] } } }
      }
    )
  })
  it('returns a space by driveAlias if no fileId given', () => {
    const driveAlias = '/personal'
    const resourcePath = '/someFolder'
    const spaceMock = mockDeep<SpaceResource>({ driveAlias })
    const mocks = defaultComponentMocks({
      currentRoute: mock<RouteLocation>({
        name: 'files-spaces-generic',
        path: '/',
        query: { fileId: undefined }
      })
    })

    getComposableWrapper(
      () => {
        const { space, item } = useDriveResolver({
          driveAliasAndItem: ref(`${driveAlias}${resourcePath}`)
        })
        expect(unref(space)).toEqual(spaceMock)
        expect(unref(item)).toEqual(resourcePath)
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: { piniaOptions: { spacesState: { spaces: [spaceMock] } } }
      }
    )
  })
  describe('eos explorer space', () => {
    const explorerSpaceMock = () =>
      mockDeep<SpaceResource>({ driveType: 'explorer', driveAlias: 'eos' })
    const genericRouteMocks = () =>
      defaultComponentMocks({
        currentRoute: mock<RouteLocation>({
          name: 'files-spaces-generic',
          path: '/',
          query: { fileId: undefined }
        })
      })

    it.each([
      ['a share root space', 'share'],
      ['the personal space', 'personal']
    ])('does not shadow %s matching the same drive alias', (_, driveType) => {
      const driveAlias = 'eos/user/j/john'
      const spaceMock = mockDeep<SpaceResource>({ id: 'realSpace', driveType, driveAlias })
      const mocks = genericRouteMocks()

      getComposableWrapper(
        () => {
          const { space, item } = useDriveResolver({
            driveAliasAndItem: ref(`${driveAlias}/someFolder`)
          })
          expect(unref(space).id).toEqual('realSpace')
          expect(unref(item)).toEqual('/someFolder')
        },
        {
          mocks,
          provide: mocks,
          pluginOptions: {
            piniaOptions: {
              // the explorer space is being added to the store before mount points are loaded
              spacesState: { spaces: [explorerSpaceMock(), spaceMock], mountPointsInitialized: true }
            }
          }
        }
      )
    })
    it('loads mount points before falling back to the explorer space', () => {
      const mocks = genericRouteMocks()

      getComposableWrapper(
        () => {
          const spacesStore = useSpacesStore()
          useDriveResolver({ driveAliasAndItem: ref('eos/user/j/john/someFolder') })
          expect(spacesStore.loadMountPoints).toHaveBeenCalled()
        },
        {
          mocks,
          provide: mocks,
          pluginOptions: {
            piniaOptions: {
              spacesState: { spaces: [explorerSpaceMock()], mountPointsInitialized: false },
              configState: { options: { routing: { fullShareOwnerPaths: true } } }
            }
          }
        }
      )
    })
    it('resolves as a last resort when no other space matches', () => {
      const explorerSpace = explorerSpaceMock()
      const mocks = genericRouteMocks()

      getComposableWrapper(
        () => {
          const { space, item } = useDriveResolver({
            driveAliasAndItem: ref('eos/project/someProject/someFolder')
          })
          expect(unref(space).driveType).toEqual('explorer')
          expect(unref(item)).toEqual('/project/someProject/someFolder')
        },
        {
          mocks,
          provide: mocks,
          pluginOptions: {
            piniaOptions: {
              spacesState: { spaces: [explorerSpace], mountPointsInitialized: true }
            }
          }
        }
      )
    })
    it('does not resolve for a drive alias outside of its own', () => {
      const mocks = genericRouteMocks()

      getComposableWrapper(
        () => {
          const { space } = useDriveResolver({
            driveAliasAndItem: ref('personal/someRemovedSpace/someFolder')
          })
          expect(unref(space)).toBeFalsy()
        },
        {
          mocks,
          provide: mocks,
          pluginOptions: {
            piniaOptions: {
              spacesState: { spaces: [explorerSpaceMock()], mountPointsInitialized: true }
            }
          }
        }
      )
    })
  })
})
