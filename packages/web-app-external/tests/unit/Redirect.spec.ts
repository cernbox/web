import { mock } from 'vitest-mock-extended'
import { ref } from 'vue'
import {
  defaultComponentMocks,
  defaultPlugins,
  flushPromises,
  shallowMount
} from '@ownclouders/web-test-helpers'
import {
  AppProviderService,
  queryItemAsString,
  useRouteMeta,
  useRouteQuery
} from '@ownclouders/web-pkg'
import { Resource } from '@ownclouders/web-client'
import Redirect from '../../src/Redirect.vue'
import { useApplicationReadyStore } from '../../src/piniaStores'

vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useRouteQuery: vi.fn(),
  useRouteMeta: vi.fn(),
  queryItemAsString: vi.fn()
}))

const { mockRouterReplace, mockCurrentRoutePath } = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockCurrentRoutePath: { value: '/' }
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<any>()
  const { computed } = await import('vue')
  return {
    ...actual,
    useRouter: () => ({
      replace: mockRouterReplace,
      currentRoute: computed(() => ({ query: {}, path: mockCurrentRoutePath.value }))
    })
  }
})

const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('Redirect.vue', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockRouterReplace.mockClear()
  })

  it('does not redirect while the application is not ready', async () => {
    const { wrapper } = getWrapper({ query: { app: 'Collabora' }, ready: false })
    await flushPromises()
    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('You are being redirected.')
  })

  it('redirects to the app given via the "app" query', async () => {
    getWrapper({ query: { app: 'Collabora' } })
    await flushPromises()
    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'external-collabora-apps' })
    )
  })

  it('redirects to the app given via the "appName" query', async () => {
    getWrapper({ query: { appName: 'OnlyOffice' } })
    await flushPromises()
    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'external-onlyoffice-apps' })
    )
  })

  it('resolves the app from the file mime type when no app query is given', async () => {
    const { appProviderService } = getWrapper({
      query: { fileId: 'file-id' },
      mimeType: docxMimeType,
      resolvedApp: 'ByCS-Office'
    })
    await flushPromises()
    expect(appProviderService.getDefaultAppNameForMimeType).toHaveBeenCalledWith(docxMimeType)
    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'external-bycs-office-apps' })
    )
  })

  it('shows an error and does not redirect when no app is configured for the mime type', async () => {
    const { wrapper } = getWrapper({
      query: { fileId: 'file-id' },
      mimeType: 'application/x-unknown',
      resolvedApp: undefined
    })
    await flushPromises()
    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('We could not open this file')
  })

  it('shows an error and does not redirect when the file cannot be statted', async () => {
    const { wrapper } = getWrapper({ query: { fileId: 'file-id' }, statThrows: true })
    await flushPromises()
    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('We could not open this file')
  })

  it('shows an error and does not redirect when neither app nor fileId is given', async () => {
    const { wrapper } = getWrapper({ query: {} })
    await flushPromises()
    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('We could not open this file')
  })

  describe('path-based routing', () => {
    it('resolves the app from the file extension in the route path', async () => {
      const { appProviderService } = getWrapper({
        query: {},
        idBased: false,
        path: '/external/eos/user/j/jdoe/report.docx',
        mimeTypes: [{ ext: 'docx', mime_type: docxMimeType }],
        resolvedApp: 'Collabora'
      })
      await flushPromises()
      expect(appProviderService.getDefaultAppNameForMimeType).toHaveBeenCalledWith(docxMimeType)
    })

    it('redirects by path, carrying the file path over and dropping fileId', async () => {
      getWrapper({
        query: {},
        idBased: false,
        path: '/external/eos/user/j/jdoe/report.docx',
        mimeTypes: [{ ext: 'docx', mime_type: docxMimeType }],
        resolvedApp: 'Collabora'
      })
      await flushPromises()
      expect(mockRouterReplace).toHaveBeenCalledWith({
        path: '/external-collabora/eos/user/j/jdoe/report.docx',
        query: {}
      })
    })

    it('shows an error when no app handles the extension', async () => {
      const { wrapper } = getWrapper({
        query: {},
        idBased: false,
        path: '/external/eos/user/j/jdoe/report.xyz',
        mimeTypes: [{ ext: 'docx', mime_type: docxMimeType }]
      })
      await flushPromises()
      expect(mockRouterReplace).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('We could not open this file')
    })

    it('still honours an explicit app query, redirecting by path', async () => {
      getWrapper({
        query: { app: 'Collabora' },
        idBased: false,
        path: '/external/eos/user/j/jdoe/report.docx'
      })
      await flushPromises()
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/external-collabora/eos/user/j/jdoe/report.docx' })
      )
    })
  })
})

function getWrapper({
  query = {},
  mimeType = '',
  resolvedApp = undefined,
  statThrows = false,
  ready = true,
  idBased = true,
  path = '/',
  mimeTypes = []
}: {
  query?: { app?: string; appName?: string; fileId?: string }
  mimeType?: string
  resolvedApp?: string
  statThrows?: boolean
  ready?: boolean
  idBased?: boolean
  path?: string
  mimeTypes?: { ext: string; mime_type: string }[]
} = {}) {
  vi.mocked(useRouteQuery).mockImplementation(
    (name: string) => ref((query as Record<string, string>)[name] ?? '') as never
  )
  vi.mocked(useRouteMeta).mockReturnValue(ref('Redirecting to external app') as never)
  vi.mocked(queryItemAsString).mockImplementation((value) => (value ?? '').toString())
  mockCurrentRoutePath.value = path

  const appProviderService = mock<AppProviderService>()
  appProviderService.getDefaultAppNameForMimeType.mockReturnValue(resolvedApp)
  Object.defineProperty(appProviderService, 'mimeTypes', { value: mimeTypes })

  const mocks = {
    ...defaultComponentMocks(),
    $appProviderService: appProviderService
  }

  if (statThrows) {
    mocks.$clientService.webdav.getFileInfo.mockRejectedValue(new Error('stat failed'))
  } else {
    mocks.$clientService.webdav.getFileInfo.mockResolvedValue(mock<Resource>({ mimeType }))
  }

  const wrapper = shallowMount(Redirect, {
    global: {
      plugins: [
        ...defaultPlugins({
          piniaOptions: { configState: { options: { routing: { idBased } } } as any }
        })
      ],
      provide: mocks,
      mocks
    }
  })

  useApplicationReadyStore().isReady = ready

  return { wrapper, mocks, appProviderService }
}
