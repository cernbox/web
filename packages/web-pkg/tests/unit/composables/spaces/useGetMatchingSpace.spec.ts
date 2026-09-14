import { useGetMatchingSpace } from '../../../../src/composables/spaces'
import {
  defaultComponentMocks,
  getComposableWrapper,
  RouteLocation
} from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { ref } from 'vue'
import { Resource, ShareSpaceResource, SpaceResource } from '@ownclouders/web-client'
import { useSpacesStore } from '../../../../src/composables/piniaStores'

describe('useSpaceHelpers', () => {
  it('should be valid', () => {
    expect(useGetMatchingSpace).toBeDefined()
  })
  describe('method "getMatchingSpace"', () => {
    it('should return the matching project space', () => {
      getWrapper({
        setup: ({ getMatchingSpace }) => {
          const resource = mock<Resource>({ storageId: '1' })
          expect(getMatchingSpace(resource).id).toEqual('1')
        }
      })
    })
    it('should return the matching public space', () => {
      getWrapper({
        driveAliasAndItem: 'public/xyz',
        setup: ({ getMatchingSpace }) => {
          const resource = mock<Resource>()
          expect(getMatchingSpace(resource).id).toEqual('xyz')
        }
      })
    })
    it('should return the matching share space', () => {
      getWrapper({
        setup: ({ getMatchingSpace }) => {
          const resource = mock<Resource>({ remoteItemPath: '/' })
          const shareSpace = { id: '1' } as ShareSpaceResource
          const { createShareSpace } = useSpacesStore()
          vi.mocked(createShareSpace).mockReturnValue(shareSpace)

          expect(getMatchingSpace(resource)).toEqual(shareSpace)
        }
      })
    })
  })

  describe('fallback space', () => {
    it('returns the fallback space for a resource it listed', () => {
      const { spaces } = getWrapper({
        includeFallbackSpace: true,
        setup: ({ getMatchingSpace }) => {
          // storageId points at the real project space, but the resource was listed through the
          // fallback space, so its path is relative to the fallback's webdav root
          const resource = mock<Resource>({
            storageId: '1',
            webDavPath: '/files/jdoe/eos/project/c/cernbox/foo.txt'
          })
          expect(getMatchingSpace(resource).driveType).toEqual('explorer')
        }
      })
      expect(spaces.some((s) => s.driveType === 'explorer')).toBe(true)
    })

    it("returns the resource's own space while a fallback route is open", () => {
      const fallbackSpace = mock<SpaceResource>({
        id: 'fallback',
        driveType: 'explorer',
        webDavPath: '/files/jdoe/eos'
      })

      getWrapper({
        includeFallbackSpace: true,
        currentSpace: fallbackSpace,
        setup: ({ getMatchingSpace }) => {
          // e.g. a clipboard entry copied from a project space, pasted while browsing the fallback
          const resource = mock<Resource>({ storageId: '1', webDavPath: '/spaces/1/foo.txt' })
          expect(getMatchingSpace(resource).id).toEqual('1')
        }
      })
    })

    it('ignores the fallback space when an explicit space is passed', () => {
      const explicitSpace = mock<SpaceResource>({ id: 'explicit', driveType: 'project' })

      getWrapper({
        includeFallbackSpace: true,
        options: { space: ref(explicitSpace) },
        setup: ({ getMatchingSpace }) => {
          const resource = mock<Resource>({
            storageId: '1',
            webDavPath: '/files/jdoe/eos/project/c/cernbox/foo.txt'
          })
          expect(getMatchingSpace(resource)).toEqual(explicitSpace)
        }
      })
    })

    it('does not treat a string-prefix webDavPath as fallback-listed', () => {
      getWrapper({
        includeFallbackSpace: true,
        setup: ({ getMatchingSpace }) => {
          const resource = mock<Resource>({
            storageId: '1',
            webDavPath: '/files/jdoe/eos-archive/foo.txt'
          })
          expect(getMatchingSpace(resource).id).toEqual('1')
        }
      })
    })

    it('resolves normally when the deployment has no fallback space', () => {
      getWrapper({
        includeFallbackSpace: false,
        setup: ({ getMatchingSpace }) => {
          const resource = mock<Resource>({
            storageId: '1',
            webDavPath: '/files/jdoe/eos/project/c/cernbox/foo.txt'
          })
          expect(getMatchingSpace(resource).id).toEqual('1')
        }
      })
    })
  })
})

function getWrapper({
  driveAliasAndItem = '',
  includeFallbackSpace = false,
  currentSpace = undefined,
  options = undefined,
  setup
}: {
  driveAliasAndItem?: string
  includeFallbackSpace?: boolean
  currentSpace?: SpaceResource
  options?: Parameters<typeof useGetMatchingSpace>[0]
  setup: (instance: ReturnType<typeof useGetMatchingSpace>) => void
}) {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({
        name: 'files-spaces-generic',
        params: { driveAliasAndItem }
      })
    })
  }

  const spaces = [
    mock<SpaceResource>({ id: '1', driveType: 'project' }),
    mock<SpaceResource>({ id: 'xyz', driveType: 'public' }),
    ...(includeFallbackSpace
      ? [
          mock<SpaceResource>({
            id: 'fallback',
            driveType: 'explorer',
            webDavPath: '/files/jdoe/eos'
          })
        ]
      : [])
  ]

  return {
    spaces,
    wrapper: getComposableWrapper(
      () => {
        const instance = useGetMatchingSpace(options)
        setup(instance)
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: { piniaOptions: { spacesState: { spaces, currentSpace } } }
      }
    )
  }
}
