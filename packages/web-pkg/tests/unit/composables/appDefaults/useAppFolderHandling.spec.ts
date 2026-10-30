import { AxiosError, AxiosHeaders } from 'axios'
import { ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { flushPromises } from '@vue/test-utils'
import {
  defaultComponentMocks,
  getComposableWrapper,
  RouteLocation
} from '@ownclouders/web-test-helpers'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  useAppFolderHandling,
  AppFolderHandlingResult
} from '../../../../src/composables/appDefaults/useAppFolderHandling'
import { FileContext } from '../../../../src/composables/appDefaults/types'
import { useAuthService } from '../../../../src/composables/authContext/useAuthService'
import { useResourcesStore } from '../../../../src/composables/piniaStores'

const getFileInfoMock = vi.fn()
const replaceInvalidFileRouteMock = vi.fn()

vi.mock('../../../../src/composables/appDefaults/useAppFileHandling', () => ({
  useAppFileHandling: () => ({
    getFileInfo: getFileInfoMock
  })
}))

vi.mock('../../../../src/composables/router/useFileRouteReplace', () => ({
  useFileRouteReplace: () => ({
    replaceInvalidFileRoute: replaceInvalidFileRouteMock
  })
}))

vi.mock('../../../../src/composables/authContext/useAuthService')

describe('useAppFolderHandling', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let handleAuthErrorMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    handleAuthErrorMock = vi.fn()
    vi.mocked(useAuthService).mockReturnValue({
      handleAuthError: handleAuthErrorMock,
      signinSilent: vi.fn(),
      logoutUser: vi.fn(),
      getRefreshToken: vi.fn(),
      showSessionExpiredModal: vi.fn(),
      loginUserPopup: vi.fn(),
      reloadUserFromStorage: vi.fn()
    })
    getFileInfoMock.mockReset()
    replaceInvalidFileRouteMock.mockReset()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  const createContext = (): FileContext => {
    const space = mock<SpaceResource>({ id: 'space-id' })
    return {
      routeName: ref('files-spaces-generic'),
      space: ref(space),
      item: ref('/folder/file.txt'),
      itemId: ref('file-id'),
      path: ref('/folder/file.txt'),
      driveAliasAndItem: ref('personal/folder/file.txt'),
      fileName: ref('file.txt'),
      routeParams: ref({}),
      routeQuery: ref({})
    }
  }

  const setupComposable = (
    currentRoute: RouteLocation = mock<RouteLocation>({
      name: 'files-spaces-generic',
      path: '/files'
    })
  ) => {
    const mocks = defaultComponentMocks({ currentRoute })
    let composable: AppFolderHandlingResult | undefined
    let resourcesStore: ReturnType<typeof useResourcesStore>

    getComposableWrapper(
      () => {
        composable = useAppFolderHandling({
          currentRoute: mocks.$router.currentRoute,
          clientService: mocks.$clientService
        })
        resourcesStore = useResourcesStore()
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: { piniaOptions: { stubActions: false } }
      }
    )

    return {
      composable: composable!,
      mocks,
      currentRoute: mocks.$route,
      resourcesStore: resourcesStore!
    }
  }

  it('loads a folder listing for a file context', async () => {
    const pathResource = mock<Resource>({ path: '/folder/file.txt', id: 'file-id', type: 'file' })
    getFileInfoMock.mockResolvedValue(pathResource)

    const folderResource = mock<Resource>({ type: 'folder', path: '/folder' })
    const child = mock<Resource>({ name: 'file.txt' })

    const { composable, mocks, resourcesStore } = setupComposable()
    vi.mocked(mocks.$clientService.webdav.listFiles).mockResolvedValue({
      resource: folderResource,
      children: [child]
    })

    const initSpy = vi.spyOn(resourcesStore, 'initResourceList')

    await composable.loadFolderForFileContext(createContext())
    await flushPromises()

    expect(initSpy).toHaveBeenCalledWith({ currentFolder: folderResource, resources: [child] })
    expect(composable.isFolderLoading.value).toBe(false)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('logs a redacted message and clears the folder on a generic error', async () => {
    const sensitiveError = Object.assign(new Error('leaked'), {
      url: 'https://example.test/?token=secret'
    })
    getFileInfoMock.mockRejectedValue(sensitiveError)

    const { composable, resourcesStore } = setupComposable()
    const setCurrentFolderSpy = vi.spyOn(resourcesStore, 'setCurrentFolder')

    await composable.loadFolderForFileContext(createContext())
    await flushPromises()

    expect(setCurrentFolderSpy).toHaveBeenCalledWith(null)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app folder', {
      message: 'leaked'
    })
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(sensitiveError)
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('secret')
    expect(handleAuthErrorMock).not.toHaveBeenCalled()
    expect(composable.isFolderLoading.value).toBe(false)
  })

  it('does not log axios authorization headers on failure', async () => {
    const axiosError = new AxiosError(
      'Request failed with status code 500',
      AxiosError.ERR_BAD_RESPONSE,
      { headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }) },
      {},
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new AxiosHeaders(),
        data: {},
        config: { headers: new AxiosHeaders() }
      }
    )
    getFileInfoMock.mockRejectedValue(axiosError)

    const { composable } = setupComposable()
    await composable.loadFolderForFileContext(createContext())
    await flushPromises()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app folder', {
      message: 'Request failed with status code 500',
      statusCode: 500
    })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('secret-token')
    expect(handleAuthErrorMock).not.toHaveBeenCalled()
  })

  it('handles a 401 with statusCode via the auth service', async () => {
    const authError = { statusCode: 401, message: 'unauthorized' }
    getFileInfoMock.mockRejectedValue(authError)

    const { composable, currentRoute, resourcesStore } = setupComposable(
      mock<RouteLocation>({ name: 'files-spaces-generic', path: '/files' })
    )
    const setCurrentFolderSpy = vi.spyOn(resourcesStore, 'setCurrentFolder')

    await composable.loadFolderForFileContext(createContext())
    await flushPromises()

    expect(setCurrentFolderSpy).toHaveBeenCalledWith(null)
    expect(handleAuthErrorMock).toHaveBeenCalledWith(currentRoute)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app folder', {
      message: 'unauthorized',
      statusCode: 401
    })
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(authError)
    expect(composable.isFolderLoading.value).toBe(false)
  })

  it('handles a 401 with response.status via the auth service', async () => {
    const authError = { response: { status: 401 }, config: { url: 'https://secret.test' } }
    getFileInfoMock.mockRejectedValue(authError)

    const { composable, currentRoute, resourcesStore } = setupComposable(
      mock<RouteLocation>({ name: 'files-spaces-generic', path: '/files' })
    )
    const setCurrentFolderSpy = vi.spyOn(resourcesStore, 'setCurrentFolder')

    await composable.loadFolderForFileContext(createContext())
    await flushPromises()

    expect(setCurrentFolderSpy).toHaveBeenCalledWith(null)
    expect(handleAuthErrorMock).toHaveBeenCalledWith(currentRoute)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load app folder', {
      statusCode: 401
    })
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(authError)
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('secret.test')
    expect(composable.isFolderLoading.value).toBe(false)
  })
})
