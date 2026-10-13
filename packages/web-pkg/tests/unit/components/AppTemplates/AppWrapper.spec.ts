import { defineComponent, ref, Ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  RouteLocation,
  defaultComponentMocks,
  defaultPlugins,
  flushPromises,
  shallowMount,
  useAppDefaultsMock
} from '@ownclouders/web-test-helpers'
import AppWrapper from '../../../../src/components/AppTemplates/AppWrapper.vue'
import { FileContext } from '../../../../src/composables/appDefaults'
import { useAppDefaults } from '../../../../src/composables/appDefaults/useAppDefaults'

vi.mock('../../../../src/composables/appDefaults/useAppDefaults')

const selectors = {
  loadingScreenStub: 'loading-screen-stub',
  errorScreenStub: 'error-screen-stub',
  wrappedApp: '.wrapped-app'
}

const applicationId = 'text-editor'

const selfLoadingApp = defineComponent({ props: {}, emits: ['update:resource'] })
const wrapperLoadedApp = defineComponent({ props: { resource: { type: Object } } })

const fileContext = mock<FileContext>({
  fileName: 'file.txt',
  space: mock<SpaceResource>({ id: 'space-id', driveType: 'personal' })
})

describe('AppWrapper', () => {
  describe('if no file context is present', () => {
    it('renders the loading screen instead of an app that loads its own resource', () => {
      const { wrapper } = getWrapper({ wrappedComponent: selfLoadingApp })

      expect(wrapper.find(selectors.loadingScreenStub).exists()).toBeTruthy()
      expect(wrapper.find(selectors.wrappedApp).exists()).toBeFalsy()
    })

    it('keeps rendering the loading screen and does not load the resource', async () => {
      const { wrapper, getFileInfo } = getWrapper({ wrappedComponent: wrapperLoadedApp })
      await flushPromises()

      expect(getFileInfo).not.toHaveBeenCalled()
      expect(wrapper.find(selectors.loadingScreenStub).exists()).toBeTruthy()
      expect(wrapper.find(selectors.errorScreenStub).exists()).toBeFalsy()
      expect(wrapper.find(selectors.wrappedApp).exists()).toBeFalsy()
    })
  })

  describe('if the file context becomes available', () => {
    it('renders an app that loads its own resource', async () => {
      const { wrapper, currentFileContext } = getWrapper({ wrappedComponent: selfLoadingApp })

      currentFileContext.value = fileContext
      await flushPromises()

      expect(wrapper.find(selectors.loadingScreenStub).exists()).toBeFalsy()
      expect(wrapper.find(selectors.wrappedApp).exists()).toBeTruthy()
    })

    it('loads the resource and renders the app', async () => {
      const { wrapper, currentFileContext, getFileInfo } = getWrapper({
        wrappedComponent: wrapperLoadedApp
      })

      currentFileContext.value = fileContext
      await flushPromises()

      expect(getFileInfo).toHaveBeenCalledTimes(1)
      expect(wrapper.find(selectors.loadingScreenStub).exists()).toBeFalsy()
      expect(wrapper.find(selectors.errorScreenStub).exists()).toBeFalsy()
      expect(wrapper.find(selectors.wrappedApp).exists()).toBeTruthy()
    })
  })
})

function getWrapper({
  wrappedComponent
}: {
  wrappedComponent: ReturnType<typeof defineComponent>
}) {
  const mocks = defaultComponentMocks({
    currentRoute: mock<RouteLocation>({
      name: applicationId,
      path: `/${applicationId}/personal/admin/file.txt`,
      params: { driveAliasAndItem: 'personal/admin/file.txt' },
      query: {}
    })
  })

  const currentFileContext: Ref<FileContext> = ref(null)
  const getFileInfo = vi
    .fn()
    .mockResolvedValue(
      mock<Resource>({ id: 'file-id', name: 'file.txt', extension: 'txt', permissions: 'RDNVW' })
    )
  vi.mocked(useAppDefaults).mockImplementation(() =>
    useAppDefaultsMock({ currentFileContext, getFileInfo })
  )

  return {
    currentFileContext,
    getFileInfo,
    wrapper: shallowMount(AppWrapper, {
      props: {
        applicationId,
        wrappedComponent
      },
      slots: {
        default: '<div class="wrapped-app" />'
      },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              appsState: { apps: { [applicationId]: { id: applicationId, name: 'Text Editor' } } }
            }
          })
        ],
        mocks,
        provide: mocks
      }
    })
  }
}
