import { useDriveResolver } from '../../../../src/composables/driveResolver'
import { nextTick, Ref, ref, unref } from 'vue'
import { mock, mockDeep } from 'vitest-mock-extended'
import { isShareSpaceResource, ShareSpaceResource, SpaceResource } from '@ownclouders/web-client'
import { flushPromises } from '@vue/test-utils'
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

  describe('space precedence', () => {
    // a real `fileId` string matters: an unset one would be an auto-mocked function whose
    // stringification is identical for every space, which makes the fileId branch match blindly
    const buildSpaceMock = (driveAlias: string, driveType = 'project') =>
      mock<SpaceResource>({ id: driveAlias, fileId: `${driveAlias}!node`, driveAlias, driveType })

    const fallbackSpace = () => buildSpaceMock('eos', 'explorer')

    const resolve = async ({
      driveAliasAndItem,
      spaces,
      mountPointsInitialized = true,
      fullShareOwnerPaths = false,
      initializedTypes,
      onLoadMountPoints
    }: {
      driveAliasAndItem: Ref<string>
      spaces: SpaceResource[]
      mountPointsInitialized?: boolean
      fullShareOwnerPaths?: boolean
      initializedTypes?: Partial<Record<'personal' | 'project' | 'mountpoint', boolean>>
      onLoadMountPoints?: (spacesStore: ReturnType<typeof useSpacesStore>) => void
    }) => {
      const mocks = defaultComponentMocks({
        currentRoute: mock<RouteLocation>({
          name: 'files-spaces-generic',
          path: '/',
          query: { fileId: undefined }
        })
      })

      let result: ReturnType<typeof useDriveResolver>
      let spacesStore: ReturnType<typeof useSpacesStore>

      getComposableWrapper(
        () => {
          spacesStore = useSpacesStore()
          onLoadMountPoints?.(spacesStore)
          result = useDriveResolver({ driveAliasAndItem })
        },
        {
          mocks,
          provide: mocks,
          pluginOptions: {
            piniaOptions: {
              spacesState: { spaces, mountPointsInitialized, initializedTypes },
              configState: { options: { routing: { fullShareOwnerPaths } } } as any
            }
          }
        }
      )

      await flushPromises()
      return { ...result, spacesStore }
    }

    it.each([
      { label: 'fallback first', order: (f: SpaceResource, p: SpaceResource) => [f, p] },
      { label: 'fallback last', order: (f: SpaceResource, p: SpaceResource) => [p, f] }
    ])('a real space beats the catch-all fallback ($label)', async ({ order }) => {
      const fallback = fallbackSpace()
      const projectSpace = buildSpaceMock('eos/project/c/cernbox')

      const { space, item } = await resolve({
        driveAliasAndItem: ref('eos/project/c/cernbox/foo'),
        spaces: order(fallback, projectSpace)
      })

      expect(unref(space)).toEqual(projectSpace)
      expect(unref(item)).toEqual('/foo')
    })

    it('falls back to the catch-all when no real space matches', async () => {
      const fallback = fallbackSpace()

      const { space, item } = await resolve({
        driveAliasAndItem: ref('eos/project/c/other/pub'),
        spaces: [fallback, buildSpaceMock('eos/project/c/cernbox')]
      })

      expect(unref(space)).toEqual(fallback)
      expect(unref(item)).toEqual('/project/c/other/pub')
    })

    it('does not match a space whose driveAlias is only a string prefix', async () => {
      const { space } = await resolve({
        driveAliasAndItem: ref('eos/project/c/cernbox/x'),
        spaces: [buildSpaceMock('eos/project/c/cern')]
      })

      expect(unref(space)).toEqual(null)
    })

    it('lazily loads mount points when only the catch-all matches', async () => {
      const fallback = fallbackSpace()
      const mountPoint = buildSpaceMock('eos/project/c/cernbox', 'mountpoint')

      const { space, spacesStore } = await resolve({
        driveAliasAndItem: ref('eos/project/c/cernbox/shared/x'),
        spaces: [fallback],
        mountPointsInitialized: false,
        fullShareOwnerPaths: true,
        onLoadMountPoints: (store) => {
          vi.mocked(store.loadSpacesByType).mockImplementation(async (driveType) => {
            store.setTypeInitialized(driveType, true)
            if (driveType === 'mountpoint') {
              store.spaces.push(mountPoint)
            }
          })
        }
      })

      expect(spacesStore.loadSpacesByType).toHaveBeenCalledWith('mountpoint', expect.anything())
      expect(unref(space)).toEqual(mountPoint)
    })

    it('does not load mount points when fullShareOwnerPaths is disabled', async () => {
      const fallback = fallbackSpace()

      const { space, spacesStore } = await resolve({
        driveAliasAndItem: ref('eos/project/c/cernbox/shared/x'),
        spaces: [fallback],
        mountPointsInitialized: false,
        fullShareOwnerPaths: false
      })

      expect(spacesStore.loadSpacesByType).not.toHaveBeenCalledWith('mountpoint', expect.anything())
      expect(unref(space)).toEqual(fallback)
    })

    it('does not load mount points when they are already initialized', async () => {
      const fallback = fallbackSpace()

      const { space, spacesStore } = await resolve({
        driveAliasAndItem: ref('eos/project/c/cernbox/shared/x'),
        spaces: [fallback],
        mountPointsInitialized: true,
        fullShareOwnerPaths: true
      })

      expect(spacesStore.loadSpacesByType).not.toHaveBeenCalledWith('mountpoint', expect.anything())
      expect(unref(space)).toEqual(fallback)
    })

    it('switches from the catch-all to a real space when navigating deeper', async () => {
      const fallback = fallbackSpace()
      const projectSpace = buildSpaceMock('eos/project/c/cernbox')
      const driveAliasAndItem = ref('eos/project/c/other')

      const { space, item } = await resolve({
        driveAliasAndItem,
        spaces: [fallback, projectSpace]
      })
      expect(unref(space)).toEqual(fallback)

      driveAliasAndItem.value = 'eos/project/c/cernbox/foo'
      await nextTick()
      await flushPromises()

      expect(unref(space)).toEqual(projectSpace)
      expect(unref(item)).toEqual('/foo')
    })

    it('loads drive types in order and stops as soon as one matches', async () => {
      const fallback = fallbackSpace()
      const projectSpace = buildSpaceMock('eos/project/c/cernbox')

      const { space, spacesStore } = await resolve({
        driveAliasAndItem: ref('eos/project/c/cernbox/foo'),
        spaces: [fallback],
        initializedTypes: { personal: false, project: false, mountpoint: false },
        fullShareOwnerPaths: true,
        onLoadMountPoints: (store) => {
          vi.mocked(store.loadSpacesByType).mockImplementation(async (driveType) => {
            store.setTypeInitialized(driveType, true)
            if (driveType === 'project') {
              store.spaces.push(projectSpace)
            }
          })
        }
      })

      expect(unref(space)).toEqual(projectSpace)
      // personal is tried first, project resolves it, mountpoint is never fetched
      expect(spacesStore.loadSpacesByType).toHaveBeenCalledWith('personal', expect.anything())
      expect(spacesStore.loadSpacesByType).toHaveBeenCalledWith('project', expect.anything())
      expect(spacesStore.loadSpacesByType).not.toHaveBeenCalledWith('mountpoint', expect.anything())
    })

    it('stops loading even when a drive type fails to load', async () => {
      // `loading` gates whether consumers get a file context at all - AppWrapper renders a loading
      // screen while it is true - so a failed request must not wedge it on forever
      const fallback = fallbackSpace()
      let result: Awaited<ReturnType<typeof resolve>>

      try {
        result = await resolve({
          driveAliasAndItem: ref('eos/project/c/cernbox/foo'),
          spaces: [fallback],
          initializedTypes: { personal: false, project: false, mountpoint: false },
          fullShareOwnerPaths: true,
          onLoadMountPoints: (store) => {
            vi.mocked(store.loadSpacesByType).mockRejectedValue(new Error('drives unavailable'))
          }
        })
      } catch {
        // the rejection surfaces through the watcher; what matters is the flag below
      }

      expect(unref(result.loading)).toBe(false)
    })

    it('does not keep a space whose driveAlias is only a string prefix when the path changes', async () => {
      const cernSpace = buildSpaceMock('eos/project/c/cern')
      const driveAliasAndItem = ref('eos/project/c/cern')

      const { space, item } = await resolve({ driveAliasAndItem, spaces: [cernSpace] })
      expect(unref(space)).toEqual(cernSpace)

      driveAliasAndItem.value = 'eos/project/c/cernbox/x'
      await nextTick()
      await flushPromises()

      expect(unref(item)).not.toEqual('/box/x')
      expect(unref(space)).toEqual(null)
    })
  })
})
