import { mock } from 'vitest-mock-extended'
import {
  defaultComponentMocks,
  defaultPlugins,
  nextTicks,
  shallowMount
} from '@ownclouders/web-test-helpers'
import { AppProviderService, useRequest, useRoute } from '@ownclouders/web-pkg'
import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'

import { Resource, SpaceResource } from '@ownclouders/web-client'
import App from '../../src/App.vue'
import { RouteLocation } from 'vue-router'
import { useOfficePostMessageRegistry } from '../../src/composables'
import { WebThemeType } from '@ownclouders/web-pkg'

vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useRequest: vi.fn(),
  useRoute: vi.fn()
}))

vi.mock('../../src/composables', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useOfficePostMessageRegistry: vi.fn()
}))

const appUrl = 'https://example.test/d12ab86/loe009157-MzBw'

const providerSuccessResponsePost = {
  app_url: appUrl,
  method: 'POST',
  form_parameters: {
    access_token: 'asdfsadfsadf',
    access_token_ttl: '123456'
  }
}

const providerSuccessResponseGet = {
  app_url: appUrl,
  method: 'GET'
}

describe('The app provider extension', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(useOfficePostMessageRegistry).mockReturnValue({
      register: vi.fn(),
      unregister: vi.fn(),
      handleMessage: vi.fn(),
      notifyResourceChanged: vi.fn(),
      isAppLoaded: computed(() => false),
      hasPendingMentions: computed(() => false)
    })
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should fail for unauthenticated users', async () => {
    const makeRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 401,
      message: 'Login Required'
    })
    const { wrapper } = createShallowMountWrapper(makeRequest)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toMatchSnapshot()
  })
  it('should be able to load an iFrame via get', async () => {
    const makeRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: providerSuccessResponseGet
    })

    const { wrapper } = createShallowMountWrapper(makeRequest)
    await flushPromises()
    expect(wrapper.html()).toMatchSnapshot()
  })
  it('should be able to load an iFrame via post', async () => {
    const makeRequest = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: providerSuccessResponsePost
    })
    const { wrapper } = createShallowMountWrapper(makeRequest)
    await flushPromises()
    expect(wrapper.html()).toMatchSnapshot()
  })
  describe('office postMessage handling', () => {
    it('registers the handler on mount and unregisters it on unmount', async () => {
      const register = vi.fn()
      const unregister = vi.fn()
      vi.mocked(useOfficePostMessageRegistry).mockReturnValue({
        register,
        unregister,
        handleMessage: vi.fn(),
        notifyResourceChanged: vi.fn(),
        isAppLoaded: computed(() => false),
        hasPendingMentions: computed(() => false)
      })

      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      const { wrapper } = createShallowMountWrapper(makeRequest)
      await flushPromises()

      expect(register).toHaveBeenCalled()

      wrapper.unmount()
      expect(unregister).toHaveBeenCalled()
    })

    it('ignores postMessages from an origin other than the resolved app url', async () => {
      const handleMessage = vi.fn()
      vi.mocked(useOfficePostMessageRegistry).mockReturnValue({
        register: vi.fn(),
        unregister: vi.fn(),
        handleMessage,
        notifyResourceChanged: vi.fn(),
        isAppLoaded: computed(() => false),
        hasPendingMentions: computed(() => false)
      })

      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      const { wrapper } = createShallowMountWrapper(
        makeRequest,
        { appNames: ['example-app'] },
        mock<SpaceResource>()
      )
      await flushPromises()
      await nextTicks(2)

      window.dispatchEvent(new MessageEvent('message', { data: '{}', origin: 'https://evil.test' }))
      expect(handleMessage).not.toHaveBeenCalled()

      window.dispatchEvent(
        new MessageEvent('message', { data: '{}', origin: new URL(appUrl).origin })
      )
      expect(handleMessage).toHaveBeenCalledTimes(1)

      wrapper.unmount()
    })
  })

  describe('warns before unload when mentions are pending', () => {
    it('shows the native confirmation when there are unflushed mentions', async () => {
      vi.mocked(useOfficePostMessageRegistry).mockReturnValue({
        register: vi.fn(),
        unregister: vi.fn(),
        handleMessage: vi.fn(),
        notifyResourceChanged: vi.fn(),
        isAppLoaded: computed(() => false),
        hasPendingMentions: computed(() => true)
      })

      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      const { wrapper } = createShallowMountWrapper(makeRequest)
      await flushPromises()

      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)

      wrapper.unmount()
    })

    it('does not show the confirmation when there are no unflushed mentions', async () => {
      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      const { wrapper } = createShallowMountWrapper(makeRequest)
      await flushPromises()

      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)

      wrapper.unmount()
    })

    it('stops warning once unmounted', async () => {
      vi.mocked(useOfficePostMessageRegistry).mockReturnValue({
        register: vi.fn(),
        unregister: vi.fn(),
        handleMessage: vi.fn(),
        notifyResourceChanged: vi.fn(),
        isAppLoaded: computed(() => false),
        hasPendingMentions: computed(() => true)
      })

      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      const { wrapper } = createShallowMountWrapper(makeRequest)
      await flushPromises()
      wrapper.unmount()

      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('theme forwarding', () => {
    it('sends theme=dark on the app/open request when the current theme is dark', async () => {
      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      createShallowMountWrapper(
        makeRequest,
        undefined,
        mock<SpaceResource>(),
        mock<WebThemeType>({ isDark: true })
      )
      await flushPromises()

      expect(makeRequest).toHaveBeenCalledWith(
        'POST',
        expect.stringContaining('theme=dark'),
        expect.anything()
      )
    })

    it('sends theme=light on the app/open request when the current theme is light', async () => {
      const makeRequest = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: providerSuccessResponseGet
      })
      createShallowMountWrapper(
        makeRequest,
        undefined,
        mock<SpaceResource>(),
        mock<WebThemeType>({ isDark: false })
      )
      await flushPromises()

      expect(makeRequest).toHaveBeenCalledWith(
        'POST',
        expect.stringContaining('theme=light'),
        expect.anything()
      )
    })
  })
})

function createShallowMountWrapper(
  makeRequest = vi.fn().mockResolvedValue({ status: 200 }),
  appProviderService: Partial<AppProviderService> = { appNames: ['example-app'] },
  space: SpaceResource = null,
  currentTheme: WebThemeType = mock<WebThemeType>({ isDark: false })
) {
  vi.mocked(useRequest).mockImplementation(() => ({
    makeRequest
  }))
  vi.mocked(useRoute).mockImplementation(
    () => ref(mock<RouteLocation>({ name: 'external-example-app-apps' })) as any
  )
  const mocks = {
    ...defaultComponentMocks(),
    $appProviderService: mock<AppProviderService>(appProviderService)
  }

  const capabilities = {
    files: {
      app_providers: [{ apps_url: '/app/list', enabled: true, open_url: '/app/open' }]
    }
  }

  return {
    mocks,
    wrapper: shallowMount(App, {
      props: {
        space,
        resource: mock<Resource>(),
        isReadOnly: false
      },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              capabilityState: { capabilities },
              configState: { options: { editor: { openAsPreview: true } } },
              themeState: { currentTheme }
            }
          })
        ],
        provide: mocks,
        mocks
      }
    })
  }
}
