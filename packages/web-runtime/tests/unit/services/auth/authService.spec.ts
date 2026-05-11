import {
  ConfigStore,
  markLinkedPrimaryAuthHandled,
  useAuthStore,
  useConfigStore
} from '@ownclouders/web-pkg'
import { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { mock } from 'vitest-mock-extended'
import { Router } from 'vue-router'
import { AuthService } from '../../../../src/services/auth/authService'
import { UserManager } from '../../../../src/services/auth/userManager'
import * as routerHelpers from '../../../../src/router'
import { RouteLocation, createRouter, createTestingPinia } from '@ownclouders/web-test-helpers'

const mockUpdateContext = vi.fn()
console.debug = vi.fn()

vi.mock('../../../../src/services/auth/userManager')

function linkedPrimaryCause(): AxiosError {
  return new AxiosError(
    'conflict',
    'ERR_BAD_REQUEST',
    {
      url: '/graph/v1.0/me',
      baseURL: 'https://example.com/',
      headers: {}
    } as InternalAxiosRequestConfig,
    {},
    {
      status: 409,
      statusText: 'Conflict',
      data: { error: { code: 'linkedPrimaryAccount', message: 'x' } },
      headers: {},
      config: {} as AxiosError['config']
    }
  )
}

const initAuthService = ({
  authService,
  configStore = null,
  router = null
}: {
  authService: AuthService
  configStore?: ConfigStore
  router?: Router
}) => {
  createTestingPinia()
  const authStore = useAuthStore()
  configStore = configStore || useConfigStore()

  authService.initialize(configStore, null, router, null, null, null, authStore, null, null)
}

describe('AuthService', () => {
  describe('signInCallback', () => {
    it.each([
      ['/', '/', {}],
      ['/?details=sharing', '/', { details: 'sharing' }],
      [
        '/external?contextRouteName=files-spaces-personal&fileId=0f897576',
        '/external',
        {
          contextRouteName: 'files-spaces-personal',
          fileId: '0f897576'
        }
      ]
    ])(
      'parses query params and passes them explicitly to router.replace: %s => %s %s',
      async (url, path, query: Record<string, string>) => {
        const authService = new AuthService()

        Object.defineProperty(authService, 'userManager', {
          value: {
            signinRedirectCallback: vi.fn(),
            getAndClearPostLoginRedirectUrl: () => url
          }
        })

        const router = createRouter()
        const replaceSpy = vi.spyOn(router, 'replace')

        initAuthService({ authService, router })
        await authService.signInCallback()

        expect(replaceSpy).toHaveBeenCalledWith({
          path,
          query
        })
      }
    )
  })

  describe('initializeContext', () => {
    it('when embed mode is disabled and access_token is present, should call updateContext', async () => {
      const authService = new AuthService()

      Object.defineProperty(authService, 'userManager', {
        value: mock<UserManager>({
          getAccessToken: vi.fn().mockResolvedValue('access-token'),
          updateContext: mockUpdateContext
        })
      })

      initAuthService({ authService })

      await authService.initializeContext(mock<RouteLocation>({}))

      expect(mockUpdateContext).toHaveBeenCalledWith('access-token', true)
    })

    it('when embed mode is disabled and access_token is not present, should not call updateContext', async () => {
      const authService = new AuthService()

      Object.defineProperty(authService, 'userManager', {
        value: mock<UserManager>({
          getAccessToken: vi.fn().mockResolvedValue(null),
          updateContext: mockUpdateContext
        })
      })

      initAuthService({ authService })

      await authService.initializeContext(mock<RouteLocation>({}))

      expect(mockUpdateContext).not.toHaveBeenCalled()
    })

    it('when embed mode is enabled, access_token is present but auth is not delegated, should call updateContext', async () => {
      const authService = new AuthService()

      Object.defineProperty(authService, 'userManager', {
        value: mock<UserManager>({
          getAccessToken: vi.fn().mockResolvedValue('access-token'),
          updateContext: mockUpdateContext
        })
      })

      initAuthService({ authService })

      await authService.initializeContext(mock<RouteLocation>({}))

      expect(mockUpdateContext).toHaveBeenCalledWith('access-token', true)
    })

    it('when embed mode is enabled, access_token is present and auth is delegated, should not call updateContext', async () => {
      const authService = new AuthService()

      Object.defineProperty(authService, 'userManager', {
        value: mock<UserManager>({
          getAccessToken: vi.fn().mockResolvedValue('access-token'),
          updateContext: mockUpdateContext
        })
      })

      const configStore = useConfigStore()
      configStore.options = { embed: { enabled: true, delegateAuthentication: true } }
      initAuthService({ authService, configStore })

      await authService.initializeContext(mock<RouteLocation>({}))

      expect(mockUpdateContext).not.toHaveBeenCalled()
    })

    it('when embed mode is disabled, access_token is present and auth is delegated, should call updateContext', async () => {
      const authService = new AuthService()

      Object.defineProperty(authService, 'userManager', {
        value: mock<UserManager>({
          getAccessToken: vi.fn().mockResolvedValue('access-token'),
          updateContext: mockUpdateContext
        })
      })

      initAuthService({ authService })

      await authService.initializeContext(mock<RouteLocation>({}))

      expect(mockUpdateContext).toHaveBeenCalledWith('access-token', true)
    })
  })

  describe('handleAuthError', () => {
    describe('linked-primary cause routing', () => {
      beforeEach(() => {
        vi.spyOn(routerHelpers, 'isPublicLinkContextRequired').mockReturnValue(false)
        vi.spyOn(routerHelpers, 'isUserContextRequired').mockReturnValue(true)
        vi.spyOn(routerHelpers, 'isIdpContextRequired').mockReturnValue(false)
      })

      afterEach(() => {
        vi.restoreAllMocks()
      })

      it('sets authBlockRouteName to linkedAccountBlocked when cause matches linked primary', async () => {
        const authService = new AuthService()
        const removeUser = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(authService, 'userManager', {
          value: mock<UserManager>({
            getUser: vi.fn().mockResolvedValue({ expires_in: 3600 }),
            removeUser
          })
        })

        const router = createRouter()
        initAuthService({ authService, router })

        await authService.handleAuthError(mock<RouteLocation>({}), {
          cause: linkedPrimaryCause()
        })

        expect(authService.authBlockRouteName).toBe('linkedAccountBlocked')
        expect(removeUser).toHaveBeenCalledWith('authError')
      })

      it('sets authBlockRouteName to accessDenied for generic errors', async () => {
        const authService = new AuthService()
        const removeUser = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(authService, 'userManager', {
          value: mock<UserManager>({
            getUser: vi.fn().mockResolvedValue({ expires_in: 3600 }),
            removeUser
          })
        })

        const router = createRouter()
        initAuthService({ authService, router })

        await authService.handleAuthError(mock<RouteLocation>({}), {
          cause: new Error('generic')
        })

        expect(authService.authBlockRouteName).toBe('accessDenied')
        expect(removeUser).toHaveBeenCalledWith('authError')
      })

      it('does not call removeUser twice when cause already marked handled by interceptor', async () => {
        const authService = new AuthService()
        const removeUser = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(authService, 'userManager', {
          value: mock<UserManager>({
            getUser: vi.fn().mockResolvedValue({ expires_in: 3600 }),
            removeUser
          })
        })

        const router = createRouter()
        initAuthService({ authService, router })

        const cause = linkedPrimaryCause()
        await authService.handleAuthError(mock<RouteLocation>({}), { cause })
        markLinkedPrimaryAuthHandled(cause)
        await authService.handleAuthError(mock<RouteLocation>({}), { cause })

        expect(removeUser).toHaveBeenCalledTimes(1)
      })
    })
  })
})
