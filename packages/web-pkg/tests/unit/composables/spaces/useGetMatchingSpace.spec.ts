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
          const resource = mock<Resource>({ spaceId: '1' })
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
