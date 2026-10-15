import { flushPromises } from '@vue/test-utils'
import FilesDrop from '../../../src/views/FilesDrop.vue'
import {
  defaultPlugins,
  mount,
  defaultComponentMocks,
  defaultStubs,
  RouteLocation
} from '@ownclouders/web-test-helpers'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ClientService } from '@ownclouders/web-pkg'
import { SpaceResource } from '@ownclouders/web-client'
import { ListFilesResult } from '@ownclouders/web-client/webdav'

describe('FilesDrop view', () => {
  describe('error logging', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('logs a redacted message when resolving the public link fails', async () => {
      const publicLinkToken = 'drop-link-token'
      const sensitiveError = Object.assign(new Error('leaked'), {
        statusCode: 500,
        url: 'https://example.test/?token=secret'
      })
      const space = mock<SpaceResource>({ driveAlias: `public/${publicLinkToken}` })
      const $clientService = mockDeep<ClientService>()
      $clientService.webdav.listFiles.mockRejectedValue(sensitiveError)

      const { wrapper } = getMountedWrapper({
        $clientService,
        piniaOptions: {
          authState: { publicLinkToken, userContextReady: false },
          spacesState: { spaces: [space] }
        }
      })

      await flushPromises()

      expect(wrapper.vm.loading).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load public link')
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(sensitiveError)
    })
  })

  describe('different files view states', () => {
    it('shows the loading spinner during loading', () => {
      const { wrapper } = getMountedWrapper()
      expect(wrapper.find('app-loading-spinner').exists()).toBeTruthy()
    })
    it('shows the "resource-upload"-component after loading', async () => {
      const { wrapper } = getMountedWrapper()
      wrapper.vm.loading = false
      await wrapper.vm.$nextTick()
      expect(wrapper.find('app-loading-spinner').exists()).toBeFalsy()
      expect(wrapper.find('resource-upload-stub').exists()).toBeTruthy()
    })
  })
})

type GetMountedWrapperOptions = {
  $clientService?: ClientService
  piniaOptions?: Record<string, unknown>
}

function getMountedWrapper(options: GetMountedWrapperOptions = {}) {
  const $clientService = options.$clientService ?? mockDeep<ClientService>()
  if (!options.$clientService) {
    $clientService.webdav.listFiles.mockResolvedValue(mock<ListFilesResult>())
  }
  const defaultMocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ name: 'files-common-favorites' })
    }),
    $clientService: $clientService
  }

  return {
    mocks: defaultMocks,
    wrapper: mount(FilesDrop, {
      global: {
        plugins: [...defaultPlugins({ piniaOptions: options.piniaOptions })],
        mocks: defaultMocks,
        provide: defaultMocks,
        stubs: defaultStubs
      }
    })
  }
}
