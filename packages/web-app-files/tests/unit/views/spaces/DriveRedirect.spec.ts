import DriveRedirect from '../../../../src/views/spaces/DriveRedirect.vue'
import { mock } from 'vitest-mock-extended'
import {
  defaultPlugins,
  mount,
  defaultComponentMocks,
  defaultStubs,
  RouteLocation
} from '@ownclouders/web-test-helpers'
import { SpaceResource } from '@ownclouders/web-client'

const selectors = Object.freeze({
  spaceNotFound: '#files-space-not-found'
})

const personalSpace = mock<SpaceResource>({
  id: 'personal-space',
  driveType: 'personal',
  driveAlias: 'personal/admin',
  getDriveAliasAndItem: () => 'personal/admin'
})

describe('DriveRedirect view', () => {
  it('redirects to the personal space once it is loaded', () => {
    const { mocks } = getMountedWrapper({
      props: { driveAliasAndItem: 'personal' },
      spaces: [personalSpace],
      spacesInitialized: true
    })
    expect(mocks.$router.replace).toHaveBeenCalled()
  })

  it('shows not found when no personal space exists for a personal alias', () => {
    const { wrapper, mocks } = getMountedWrapper({
      props: { driveAliasAndItem: 'personal' },
      spacesInitialized: true
    })
    expect(wrapper.find(selectors.spaceNotFound).exists()).toBe(true)
    expect(mocks.$router.replace).not.toHaveBeenCalled()
  })

  it('shows not found for an alias that is not the personal one', () => {
    const { wrapper, mocks } = getMountedWrapper({
      props: { driveAliasAndItem: 'missing-space' },
      spacesInitialized: true
    })
    expect(wrapper.find(selectors.spaceNotFound).exists()).toBe(true)
    expect(mocks.$router.replace).not.toHaveBeenCalled()
  })

  it('neither redirects nor reports not found while spaces are still loading', () => {
    const { wrapper, mocks } = getMountedWrapper({
      props: { driveAliasAndItem: 'personal' },
      spacesInitialized: false,
      spacesLoading: true
    })
    expect(wrapper.find(selectors.spaceNotFound).exists()).toBe(false)
    expect(mocks.$router.replace).not.toHaveBeenCalled()
  })
})

function getMountedWrapper({
  currentRouteName = 'files-spaces-generic',
  props = {},
  spaces = [] as SpaceResource[],
  spacesInitialized = false,
  spacesLoading = false
} = {}) {
  const mocks = {
    ...defaultComponentMocks({ currentRoute: mock<RouteLocation>({ name: currentRouteName }) })
  }
  // the view chains .catch() on the replace to swallow NavigationDuplicated
  mocks.$router.replace.mockResolvedValue(undefined)

  return {
    mocks,
    wrapper: mount(DriveRedirect, {
      props,
      global: {
        plugins: defaultPlugins({
          piniaOptions: {
            spacesState: { spaces, spacesInitialized, spacesLoading }
          }
        }),
        stubs: defaultStubs,
        mocks,
        provide: mocks
      }
    })
  }
}
