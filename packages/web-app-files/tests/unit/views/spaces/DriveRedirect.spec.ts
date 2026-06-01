import DriveRedirect from '../../../../src/views/spaces/DriveRedirect.vue'
import { mock } from 'vitest-mock-extended'
import {
  defaultPlugins,
  mount,
  defaultComponentMocks,
  defaultStubs,
  RouteLocation
} from '@ownclouders/web-test-helpers'

describe('DriveRedirect view', () => {
  it('shows not found when no personal space exists for a personal alias', () => {
    const { wrapper } = getMountedWrapper({
      driveAliasAndItem: 'personal',
      spacesInitialized: true,
      spacesLoading: false
    })
    expect(wrapper.vm.showNotFound).toBe(true)
  })

  it('shows loading spinner while spaces are still loading', () => {
    const { wrapper } = getMountedWrapper({
      driveAliasAndItem: 'personal',
      spacesInitialized: false,
      spacesLoading: true
    })
    expect(wrapper.vm.showNotFound).toBe(false)
  })
})

function getMountedWrapper({
  currentRouteName = 'files-spaces-generic',
  driveAliasAndItem = '',
  spacesInitialized = false,
  spacesLoading = false
} = {}) {
  const mocks = {
    ...defaultComponentMocks({ currentRoute: mock<RouteLocation>({ name: currentRouteName }) })
  }

  return {
    mocks,
    wrapper: mount(DriveRedirect, {
      props: { driveAliasAndItem },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              spacesState: { spacesInitialized, spacesLoading }
            }
          })
        ],
        stubs: defaultStubs,
        mocks,
        provide: mocks
      }
    })
  }
}
