import {
  Log,
  WebStorageStateStore,
  UserManager as OidcUserManager,
  UserManagerSettings,
  User,
  ErrorResponse,
  SigninResponse
} from 'oidc-client-ts'
import { buildUrl, useAppsStore } from '@ownclouders/web-pkg'
import { getAbilities } from './abilities'
import { AuthStore, UserStore, CapabilityStore, ConfigStore } from '@ownclouders/web-pkg'
import { ClientService } from '@ownclouders/web-pkg'
import { Ability } from '@ownclouders/web-client'
import { Language } from 'vue3-gettext'
import { loadAppTranslations, setCurrentLanguage } from '../../helpers/language'
import { router } from '../../router'
import { SSEAdapter } from '@ownclouders/web-client/sse'
import { User as OcUser } from '@ownclouders/web-client/graph/generated'
import { SettingsBundle } from '../../helpers/settings'
import { WebWorkersStore } from '@ownclouders/web-pkg'

const postLoginRedirectUrlKey = 'oc.postLoginRedirectUrl'
type UnloadReason = 'authError' | 'logout'

export interface UserManagerOptions {
  clientService: ClientService
  configStore: ConfigStore
  ability: Ability
  language: Language
  userStore: UserStore
  authStore: AuthStore
  capabilityStore: CapabilityStore
  webWorkersStore: WebWorkersStore

  // number of seconds before an access token is to expire to raise the accessTokenExpiring event
  accessTokenExpiryThreshold: number
}

export class UserManager extends OidcUserManager {
  private clientService: ClientService
  private configStore: ConfigStore
  private userStore: UserStore
  private authStore: AuthStore
  private webWorkersStore: WebWorkersStore
  private capabilityStore: CapabilityStore
  private updateAccessTokenPromise: Promise<void> | null
  private _unloadReason: UnloadReason
  private ability: Ability
  private language: Language
  private browserStorage: Storage
  public areEventHandlersRegistered: boolean

  constructor(options: UserManagerOptions) {
    const browserStorage = options.configStore.options.tokenStorageLocal
      ? localStorage
      : sessionStorage
    const storePrefix = 'oc_oAuth.'
    const userStore = new WebStorageStateStore({
      prefix: storePrefix,
      store: browserStorage
    })
    // Always use localStorage for stateStore so popup windows (same-origin)
    // can access the PKCE state even when window.opener is severed by COOP headers.
    const stateStore = new WebStorageStateStore({
      prefix: storePrefix,
      store: localStorage
    })
    const openIdConfig: UserManagerSettings = {
      userStore,
      stateStore,
      redirect_uri: buildUrl(router, '/oidc-callback.html'),
      silent_redirect_uri: buildUrl(router, '/oidc-silent-redirect.html'),

      response_mode: 'query',
      response_type: 'code', // "code" triggers auth code grant flow

      post_logout_redirect_uri: buildUrl(router, '/'),
      accessTokenExpiringNotificationTimeInSeconds: options.accessTokenExpiryThreshold,
      authority: '',
      client_id: '',

      // we trigger the token renewal manually via a timer running in a web worker
      automaticSilentRenew: false
    }

    if (options.configStore.isOIDC) {
      Object.assign(openIdConfig, {
        scope: 'openid profile',
        loadUserInfo: false,
        ...options.configStore.openIdConnect,
        ...(options.configStore.openIdConnect.metadata_url && {
          metadataUrl: options.configStore.openIdConnect.metadata_url
        })
      })
    } else if (options.configStore.isOAuth2) {
      const oAuth2 = options.configStore.oAuth2
      Object.assign(openIdConfig, {
        authority: oAuth2.url,
        client_id: oAuth2.clientId,
        ...(oAuth2.clientSecret && {
          client_authentication: 'client_secret_basic',
          client_secret: oAuth2.clientSecret
        }),

        scope: 'profile',
        loadUserInfo: false,
        metadata: {
          issuer: oAuth2.url,
          authorization_endpoint: oAuth2.authUrl,
          token_endpoint: oAuth2.url,
          userinfo_endpoint: ''
        }
      })
    }

    Log.setLogger(console)
    Log.setLevel(Log.WARN)

    super(openIdConfig)
    this.browserStorage = browserStorage
    this.clientService = options.clientService
    this.configStore = options.configStore
    this.ability = options.ability
    this.language = options.language
    this.userStore = options.userStore
    this.authStore = options.authStore
    this.capabilityStore = options.capabilityStore
    this.webWorkersStore = options.webWorkersStore
  }

  /**
   * Looks up the access token of an already loaded user without enforcing a signin if no user exists.
   *
   * @return (string|null)
   */
  async getAccessToken(): Promise<string | null> {
    const user = await this.getUser()
    return user?.access_token
  }

  async removeUser(unloadReason: UnloadReason = 'logout') {
    this._unloadReason = unloadReason
    await super.removeUser()
  }

  get unloadReason(): UnloadReason {
    return this._unloadReason
  }

  getAndClearPostLoginRedirectUrl(): string {
    const url = this.browserStorage.getItem(postLoginRedirectUrlKey) || '/'
    this.browserStorage.removeItem(postLoginRedirectUrlKey)
    return url
  }

  setPostLoginRedirectUrl(url?: string): void {
    if (url) {
      this.browserStorage.setItem(postLoginRedirectUrlKey, url)
    } else {
      this.browserStorage.removeItem(postLoginRedirectUrlKey)
    }
  }

  updateContext(accessToken: string, fetchUserData: boolean) {
    const userKnown = !!this.userStore.user
    const accessTokenChanged = this.authStore.accessToken !== accessToken
    if (!accessTokenChanged) {
      return this.updateAccessTokenPromise
    }

    this.authStore.setAccessToken(accessToken)

    this.updateAccessTokenPromise = (async () => {
      if (!fetchUserData) {
        this.authStore.setIdpContextReady(true)
        return
      }

      if (this.capabilityStore.supportSSE) {
        ;(this.clientService.sseAuthenticated as SSEAdapter).updateAccessToken(accessToken)
      }

      this.webWorkersStore.updateAccessTokens(accessToken)

      if (!userKnown) {
        await this.fetchUserInfo()
        await this.updateUserAbilities(this.userStore.user)
        this.authStore.setUserContextReady(true)
      }
    })()
    return this.updateAccessTokenPromise
  }

  private async fetchUserInfo() {
    const graphClient = this.clientService.graphAuthenticated
    let graphUser: Awaited<ReturnType<typeof graphClient.users.getMe>>, roles: SettingsBundle[]
    try {
      ;[graphUser, roles] = await Promise.all([graphClient.users.getMe(), this.fetchRoles()])
    } catch (e) {
      if (e?.response?.status === 409) {
        throw new ErrorResponse({ error: 'low_assurance_level' } as any)
      }
      throw e
    }
    const role = await this.fetchRole({ graphUser, roles })

    this.userStore.setUser({
      id: graphUser.id,
      onPremisesSamAccountName: graphUser.onPremisesSamAccountName,
      displayName: graphUser.displayName,
      mail: graphUser.mail,
      memberOf: graphUser.memberOf,
      appRoleAssignments: role ? [role as any] : [], // FIXME
      preferredLanguage: graphUser.preferredLanguage || ''
    })

    if (graphUser.preferredLanguage) {
      const appsStore = useAppsStore()

      loadAppTranslations({
        apps: appsStore.apps,
        gettext: this.language,
        lang: graphUser.preferredLanguage
      })

      setCurrentLanguage({
        language: this.language,
        languageSetting: graphUser.preferredLanguage
      })
    }

    await this.fetchCapabilities()
  }

  private async fetchRoles() {
    const httpClient = this.clientService.httpAuthenticated
    try {
      const {
        data: { bundles: roles }
      } = await httpClient.post<{ bundles: SettingsBundle[] }>('/api/v0/settings/roles-list', {})
      return roles
    } catch (e) {
      console.error(e)
      return []
    }
  }

  private async fetchRole({ graphUser, roles }: { graphUser: OcUser; roles: SettingsBundle[] }) {
    const httpClient = this.clientService.httpAuthenticated
    const userAssignmentResponse = await httpClient.post<{ assignments: SettingsBundle[] }>(
      '/api/v0/settings/assignments-list',
      { account_uuid: graphUser.id }
    )
    const assignments = userAssignmentResponse.data?.assignments
    const roleAssignment = assignments.find((assignment) => 'roleId' in assignment)
    return roleAssignment ? roles.find((role) => role.id === roleAssignment.roleId) : null
  }

  private async fetchCapabilities() {
    if (this.capabilityStore.isInitialized) {
      return
    }

    const capabilities = await this.clientService.ocs.getCapabilities()
    const userCapabilities = await this.clientService.ocs.getUserCapabilities(
      this.userStore.user.id
    )

    this.capabilityStore.setCapabilities({
      ...capabilities,
      capabilities: {
        ...capabilities.capabilities,
        user: userCapabilities
      }
    })
  }

  // copied from upstream oidc-client-ts UserManager with CERN customization
  protected async _buildUser(signinResponse: SigninResponse, verifySub?: string) {
    if (!this.configStore.options.useRevaToken) {
      return (super._buildUser as any)(signinResponse, verifySub)
    }

    const logger = this._logger.create('_buildUser')
    const user = new User(signinResponse)
    if (verifySub) {
      if (verifySub !== user.profile.sub) {
        logger.debug(
          'current user does not match user returned from signin. sub from signin:',
          user.profile.sub
        )
        throw new ErrorResponse({ ...signinResponse, error: 'login_required' })
      }
      logger.debug('current user matches user returned from signin')
    }

    // Check if this user should still be forced to use the SSO token
    if (
      user.profile.hasOwnProperty('cern_roles') &&
      (user.profile.cern_roles as Array<string>).includes('force-sso-token')
    ) {
      console.log('CERNBox: current user has role to force use of SSO token')
      return (super._buildUser as any)(signinResponse, verifySub)
    }

    /* CERNBox customization
     * Do a call to the backend, as this will reply with the internal reva token.
     * Use that longer token in all calls to the backend (so, replace the default store token)
     */
    try {
      console.log('CERNBox: login successful, exchange sso token with reva token')
      // Use the unauthenticated client, as the authenticated one would replace the
      // bearer token, failing the request
      const httpClient = this.clientService.httpUnAuthenticated
      const requestConfig = {
        headers: { Authorization: 'Bearer ' + user.access_token }
      }
      const revaTokenReq = await httpClient.get('/ocs/v1.php/cloud/user', requestConfig)
      const revaToken = revaTokenReq.headers['x-access-token']
      const claims = JSON.parse(atob(revaToken.split('.')[1]))
      user.access_token = revaToken
      user.expires_at = claims.exp
    } catch (e) {
      // We do not want to fail/raise exception here, even on 409.
      // If we get a 409 we still want the user to be persisted, so that
      // we can terminate the session in the SSO as well (on logout).
      // The 409 will be catched later.
      console.error('Failed to get reva token, continue with sso one', e)
    }
    // end

    await this.storeUser(user)
    logger.debug('user stored')
    await this._events.load(user)

    return user
  }

  private async fetchPermissions({ user }: { user: OcUser }) {
    const httpClient = this.clientService.httpAuthenticated
    try {
      const {
        data: { permissions }
      } = await httpClient.post<{ permissions: string[] }>('/api/v0/settings/permissions-list', {
        account_uuid: user.id
      })
      return permissions
    } catch (e) {
      console.error(e)
      return []
    }
  }

  private async updateUserAbilities(user: OcUser) {
    const permissions = await this.fetchPermissions({ user })
    const abilities = getAbilities(permissions)
    this.ability.update(abilities)
  }
}
