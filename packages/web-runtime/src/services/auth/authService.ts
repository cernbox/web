import { ErrorResponse } from 'oidc-client-ts'
import { UserManager } from './userManager'
import { PublicLinkManager } from './publicLinkManager'
import {
  AuthStore,
  ClientService,
  UserStore,
  CapabilityStore,
  ConfigStore,
  useTokenTimerWorker,
  useMfaExpiryWorker,
  useModals,
  AuthServiceInterface,
  useEmbedMode
} from '@ownclouders/web-pkg'
import { RouteLocation, Router } from 'vue-router'
import {
  extractPublicLinkToken,
  isAnonymousContext,
  isIdpContextRequired,
  isPublicLinkContextRequired
} from '../../router'
import { unref } from 'vue'
import { Ability, urlJoin } from '@ownclouders/web-client'
import { Language } from 'vue3-gettext'
import { PublicLinkType } from '@ownclouders/web-client'
import { WebWorkersStore } from '@ownclouders/web-pkg'
import { isSilentRedirectRoute, isPopupCallbackRoute } from '../../helpers/silentRedirect'

export class AuthService implements AuthServiceInterface {
  private clientService: ClientService
  private configStore: ConfigStore
  private router: Router
  private userManager: UserManager
  private publicLinkManager: PublicLinkManager
  private ability: Ability
  private language: Language
  private userStore: UserStore
  private authStore: AuthStore
  private capabilityStore: CapabilityStore
  private webWorkersStore: WebWorkersStore

  private tokenTimerWorker: ReturnType<typeof useTokenTimerWorker>
  private tokenTimerInitialized = false

  private mfaExpiryWorker: ReturnType<typeof useMfaExpiryWorker>
  private mfaExpiryModalDismissed = false
  private mfaExpiryModalId: string | null = null
  private mfaExpiryBroadcastChannel: BroadcastChannel

  // number of seconds before an access token is to expire to raise the accessTokenExpiring event
  private accessTokenExpiryThreshold = 10

  public lowAssuranceError: boolean

  public initialize(
    configStore: ConfigStore,
    clientService: ClientService,
    router: Router,
    ability: Ability,
    language: Language,
    userStore: UserStore,
    authStore: AuthStore,
    capabilityStore: CapabilityStore,
    webWorkersStore: WebWorkersStore
  ): void {
    this.configStore = configStore
    this.clientService = clientService
    this.router = router
    this.lowAssuranceError = false
    this.ability = ability
    this.language = language
    this.userStore = userStore
    this.authStore = authStore
    this.capabilityStore = capabilityStore
    this.webWorkersStore = webWorkersStore
  }

  /**
   * Initialize publicLinkContext and userContext (whichever is available, respectively).
   *
   * FIXME: at the moment the order "publicLink first, user second" is important, because we trigger the `ready` hook of all applications
   * as soon as any context is ready. This works well for user context pages, because they can't have a public link context at the same time.
   * Public links on the other hand could have a logged in user as well, thus we need to make sure that the public link context is loaded first.
   * For the moment this is fine. In the future we might want to wait triggering the `ready` hook of applications until all available contexts
   * are loaded.
   *
   * @param to {Route}
   */
  public async initializeContext(to: RouteLocation) {
    if (!this.publicLinkManager) {
      this.publicLinkManager = new PublicLinkManager({
        clientService: this.clientService,
        authStore: this.authStore,
        capabilityStore: this.capabilityStore
      })
    }

    if (isPublicLinkContextRequired(this.router, to)) {
      const publicLinkToken = extractPublicLinkToken(to)
      if (publicLinkToken) {
        await this.publicLinkManager.updateContext(publicLinkToken)
      }
    } else if (to.name !== 'resolvePublicLink') {
      // no need to clear public context if we're routing the to public link resolving page
      this.publicLinkManager.clearContext()
    }

    if (!this.userManager) {
      this.userManager = new UserManager({
        clientService: this.clientService,
        configStore: this.configStore,
        ability: this.ability,
        language: this.language,
        userStore: this.userStore,
        authStore: this.authStore,
        capabilityStore: this.capabilityStore,
        webWorkersStore: this.webWorkersStore,
        accessTokenExpiryThreshold: this.accessTokenExpiryThreshold
      })

      // don't load worker in the silent redirect iframe or popup callback window
      const isSilentRedirect = isSilentRedirectRoute()
      if (!this.tokenTimerWorker && !isSilentRedirect && !isPopupCallbackRoute()) {
        const { options } = this.configStore

        if (!options.embed?.enabled || !options.embed?.delegateAuthentication) {
          this.tokenTimerWorker = useTokenTimerWorker({ authService: this })
          this.tokenTimerWorker.startWorker()
        }
      }
    }

    if (to.params.scope === 'vault') {
      // Capabilities carry the required MFA level name. Fetch them directly (without
      // establishing the user context) so we can enforce the ACR before any vault data
      // is loaded. Establishing the user context here would flip `userContextReady`,
      // triggering the bootstrap watcher to load spaces against the vault endpoint with
      // a non-MFA token, which fails and crashes the app.
      if (!this.capabilityStore.isInitialized) {
        this.capabilityStore.setCapabilities(await this.clientService.ocs.getCapabilities())
      }

      const requiredAcr = this.capabilityStore.authMfaRequiredLevelname
      const user = await this.userManager.getUser()
      if (!user || user.expired || user.profile.acr !== requiredAcr) {
        this.userManager.setPostLoginRedirectUrl(to.fullPath)
        await this.userManager.signinRedirect({ acr_values: requiredAcr })
        // redirecting to the IdP, don't establish the user context below
        return
      }
    }

    if (isPublicLinkContextRequired(this.router, to)) {
      const user = await this.userManager.getUser()

      if (user?.expired) {
        try {
          await this.userManager.signinSilent()
        } catch {
          await this.userManager.removeUser()
        }
      }
    }

    if (!isAnonymousContext(this.router, to)) {
      const fetchUserData = !isIdpContextRequired(this.router, to)

      if (!this.userManager.areEventHandlersRegistered) {
        this.userManager.events.addAccessTokenExpired((...args): void => {
          const handleExpirationError = () => {
            console.error('AccessToken Expired：', ...args)
            this.handleAuthError(unref(this.router.currentRoute))
          }

          // retry silent signin once, force logout if it fails
          this.userManager.signinSilent().catch(handleExpirationError)
        })

        this.userManager.events.addAccessTokenExpiring((...args) => {
          console.debug('AccessToken Expiring：', ...args)
        })

        this.userManager.events.addUserLoaded(async (user) => {
          this.tokenTimerWorker?.setTokenTimer({
            expiry: user.expires_in,
            expiryThreshold: this.accessTokenExpiryThreshold
          })

          console.debug(
            `New User Loaded. access_token： ${user.access_token}, refresh_token: ${user.refresh_token}`
          )
          try {
            await this.userManager.updateContext(user.access_token, fetchUserData)
            this.updateMfaExpiryTimer()
          } catch (e) {
            if (this.isLowAssuranceLevelError(e)) {
              this.lowAssuranceError = true
              return
            }
            console.error(e)
            await this.handleAuthError(unref(this.router.currentRoute))
          }
        })

        this.userManager.events.addUserUnloaded(() => {
          console.log('user unloaded…')
          this.tokenTimerWorker?.resetTokenTimer()
          this.mfaExpiryWorker?.resetMfaTimer()
          this.resetStateAfterUserLogout()

          if (this.userManager.unloadReason === 'authError') {
            this.authStore.setSessionExpired(true)
            return
          }

          // handle redirect after logout
          if (this.configStore.isOAuth2) {
            const oAuth2 = this.configStore.oAuth2
            if (oAuth2.logoutUrl) {
              return (window.location = oAuth2.logoutUrl as any)
            }
          }
        })
        this.userManager.events.addSilentRenewError(async (error) => {
          console.error('Silent Renew Error：', error)
          await this.handleAuthError(unref(this.router.currentRoute))
        })

        this.userManager.areEventHandlersRegistered = true
      }

      // This is to prevent issues in embed mode when the expired token is still saved but already expired
      // If the following code gets executed, it would toggle errorOccurred var which would then lead to redirect to the access denied screen
      if (
        this.configStore.options.embed?.enabled &&
        this.configStore.options.embed.delegateAuthentication
      ) {
        return
      }

      // relevant for page reload: token is already in userStore
      // no userLoaded event and no signInCallback gets triggered
      const accessToken = await this.userManager.getAccessToken()
      if (accessToken) {
        console.debug('[authService:initializeContext] - updating context with saved access_token')

        try {
          await this.userManager.updateContext(accessToken, fetchUserData)

          if (!this.tokenTimerInitialized) {
            const user = await this.userManager.getUser()
            this.tokenTimerWorker?.setTokenTimer({
              expiry: user.expires_in,
              expiryThreshold: this.accessTokenExpiryThreshold
            })

            this.updateMfaExpiryTimer()

            this.tokenTimerInitialized = true
          }
        } catch (e) {
          if (this.isLowAssuranceLevelError(e)) {
            this.lowAssuranceError = true
            return
          }
          console.error(e)
          await this.handleAuthError(unref(this.router.currentRoute))
        }
      }
    }
  }

  public showSessionExpiredModal() {
    this.tokenTimerWorker?.resetTokenTimer()
    this.authStore.setSessionExpired(true)
  }

  public loginUserPopup() {
    return this.userManager.signinPopup({
      redirect_uri: urlJoin(unref(this.configStore.serverUrl), 'web-oidc-popup-callback')
    })
  }

  public loginUser(redirectUrl?: string) {
    const { isEnabled: isEmbedModeEnable } = useEmbedMode()
    // if embed mode is enabled, use popup login instead of a redirect
    if (unref(isEmbedModeEnable)) {
      return this.userManager.signinPopup({
        redirect_uri: urlJoin(unref(this.configStore.serverUrl), 'web-oidc-popup-callback')
      })
    }
    this.userManager.setPostLoginRedirectUrl(redirectUrl)
    return this.userManager.signinRedirect()
  }

  public signinSilent() {
    return this.userManager.signinSilent()
  }

  /**
   * Sign in callback gets called from the IDP after initial login.
   */
  public async signInCallback(accessToken?: string) {
    try {
      if (
        this.configStore.options.embed.enabled &&
        this.configStore.options.embed.delegateAuthentication &&
        accessToken
      ) {
        console.debug('[authService:signInCallback] - setting access_token and fetching user')
        await this.userManager.updateContext(accessToken, true)

        // Setup a listener to handle token refresh
        console.debug('[authService:signInCallback] - adding listener to update-token event')
        window.addEventListener('message', this.handleDelegatedTokenUpdate)
      } else {
        await this.userManager.signinRedirectCallback(this.buildSignInCallbackUrl())
      }

      const user = await this.userManager.getUser()
      if (user) {
        this.updateMfaExpiryTimer()
      }

      const redirectRoute = this.router.resolve(this.userManager.getAndClearPostLoginRedirectUrl())
      return this.router.replace({
        path: redirectRoute.path,
        ...(redirectRoute.query && { query: redirectRoute.query })
      })
    } catch (e) {
      if (this.isLowAssuranceLevelError(e)) {
        this.lowAssuranceError = true
        return this.router.push({ name: 'accessDenied', query: { reason: 'lowAssuranceLevel' } })
      }
      console.warn('error during authentication:', e)
      return this.handleAuthError(unref(this.router.currentRoute))
    }
  }

  /**
   * Sign in silent callback gets called with OIDC during access token renewal when no `refresh_token`
   * is present (`refresh_token` exists when `offline_access` is present in scopes).
   *
   * The oidc-client lib emits a userLoaded event internally, which already handles the token update
   * in web.
   */
  public async signInSilentCallback() {
    await this.userManager.signinSilentCallback(this.buildSignInCallbackUrl())
  }

  public async signInPopupCallback() {
    // Use window.location.href directly — more reliable than the router-reconstructed URL,
    // and avoids issues when window.opener is null (e.g. COOP headers from cross-origin SSO).
    await this.userManager.signinPopupCallback(window.location.href)
  }

  /**
   * COOP fallback for popup callback when window.opener is null.
   * Processes the auth code via the redirect flow, then signals the opener
   * via BroadcastChannel (same-origin, not affected by COOP).
   */
  public async signInCallbackForCOOPFallback() {
    await this.userManager.signinRedirectCallback(window.location.href)
    const bc = new BroadcastChannel('oc_oidc_popup_complete')
    bc.postMessage({ type: 'complete' })
    bc.close()
  }

  /**
   * Called by the opener after BroadcastChannel signals popup completed.
   * Re-reads the user from storage and updates the auth context.
   */
  public async reloadUserFromStorage() {
    const user = await this.userManager.getUser()
    if (user?.access_token) {
      await this.userManager.updateContext(user.access_token, true)
    }
  }

  /**
   * craft a url that the parser in oidc-client-ts can handle…
   */
  private buildSignInCallbackUrl() {
    const currentQuery = unref(this.router.currentRoute).query
    return '/?' + new URLSearchParams(currentQuery as Record<string, string>).toString()
  }

  public async handleAuthError(route: RouteLocation) {
    // guard against re-entrant calls while already showing session expired modal
    if (this.authStore.sessionExpired) {
      return
    }

    if (isPublicLinkContextRequired(this.router, route)) {
      const token = extractPublicLinkToken(route)
      this.publicLinkManager.clear(token)
      return this.router.push({
        name: 'resolvePublicLink',
        params: { token },
        query: { redirectUrl: route.fullPath }
      })
    }

    // If the user context was never established (startup or login failure),
    // navigate to the access denied page with an appropriate message rather
    // than showing the "session expired" modal which implies a prior session.
    if (!this.authStore.userContextReady) {
      this.tokenTimerWorker?.resetTokenTimer()
      return this.router.push({ name: 'accessDenied', query: { reason: 'loginError' } })
    }

    // User WAS logged in — this is a mid-session auth failure.
    this.tokenTimerWorker?.resetTokenTimer()
    this.authStore.setSessionExpired(true)
  }

  private isLowAssuranceLevelError(e: unknown): boolean {
    return e instanceof ErrorResponse && e.error === 'low_assurance_level'
  }

  public async resolvePublicLink(
    token: string,
    passwordRequired: boolean,
    password: string,
    type: PublicLinkType
  ) {
    this.publicLinkManager.setPasswordRequired(token, passwordRequired)
    this.publicLinkManager.setPassword(token, password)
    this.publicLinkManager.setResolved(token, true)
    this.publicLinkManager.setType(token, type)

    await this.publicLinkManager.updateContext(token)
  }

  public async logoutUser() {
    const endSessionEndpoint = await this.userManager.metadataService?.getEndSessionEndpoint()
    if (!endSessionEndpoint) {
      await this.userManager.removeUser()
      return this.router.push({ name: 'logout' })
    }

    const u = await this.userManager.getUser()
    if (u && u.id_token) {
      return this.userManager.signoutRedirect({ id_token_hint: u.id_token })
    }

    return await this.userManager.removeUser()
  }

  private resetStateAfterUserLogout() {
    // TODO: create UserUnloadTask interface and allow registering unload-tasks in the authService
    this.userStore.reset()
    this.authStore.clearUserContext()
  }

  public async getRefreshToken() {
    const user = await this.userManager.getUser()
    return user?.refresh_token
  }

  private handleDelegatedTokenUpdate(event: MessageEvent) {
    if (
      this.configStore.options.embed?.delegateAuthenticationOrigin &&
      event.origin !== this.configStore.options.embed.delegateAuthenticationOrigin
    ) {
      return
    }

    if (event.data?.name !== 'owncloud-embed:update-token') {
      return
    }

    console.debug('[authService:handleDelegatedTokenUpdate] - going to update the access_token')
    return this.userManager.updateContext(event.data, false)
  }

  /**
   * Redirects to the login page if the user is not authenticated or if the ACR value is not the one required.
   *
   * @param acrValue - The ACR value to require.
   * @param redirectUrl - The URL to redirect to after login.
   *
   * @throws {Error} In cases of wrong authentication.
   */
  public async requireAcr(acrValue: string, redirectUrl: string) {
    const user = await this.userManager.getUser()
    if (!user || user.expired) {
      this.userManager.setPostLoginRedirectUrl(redirectUrl)
      return this.userManager.signinRedirect({ acr_values: acrValue })
    }

    const { acr } = user.profile
    if (acr === acrValue) {
      return
    }

    this.userManager.setPostLoginRedirectUrl(redirectUrl)
    return this.userManager.signinRedirect({ acr_values: acrValue })
  }

  private updateMfaExpiryTimer() {
    if (!this.capabilityStore?.vaultEnabled) {
      return
    }

    const sessionDuration = this.capabilityStore.authMfaSessionDuration
    if (!sessionDuration) {
      return
    }

    if (!this.mfaExpiryWorker) {
      this.mfaExpiryWorker = useMfaExpiryWorker({
        onExpiring: () => this.showMfaExpiryWarning()
      })
      this.mfaExpiryWorker.startWorker()
      this.initMfaExpiryBroadcastChannel()
    }

    const baseTime = this.clientService.lastSuccessfulRequestTime ?? Math.floor(Date.now() / 1000)
    const expiresAt = baseTime + sessionDuration

    this.mfaExpiryWorker.setMfaTimer({ expiresAt })
  }

  private showMfaExpiryWarning() {
    if (this.mfaExpiryModalDismissed) {
      return
    }

    this.mfaExpiryModalDismissed = true
    const { $gettext } = this.language

    const modalStore = useModals()
    const modal = modalStore.dispatchModal({
      title: $gettext('Session expiring'),
      message: $gettext(
        'Your multi-factor authentication session is about to expire. Would you like to extend it?'
      ),
      confirmText: $gettext('Extend session'),
      cancelText: $gettext('Dismiss'),
      onConfirm: () => {
        this.mfaExpiryModalId = null
        this.mfaExpiryBroadcastChannel?.postMessage({ action: 'prolonged' })
        this.prolongMfaSession()
      },
      onCancel: () => {
        this.mfaExpiryModalId = null
        this.mfaExpiryBroadcastChannel?.postMessage({ action: 'dismissed' })
      }
    })
    this.mfaExpiryModalId = modal.id
  }

  private prolongMfaSession() {
    const sessionDuration = this.capabilityStore.authMfaSessionDuration
    if (!sessionDuration) {
      return
    }

    this.mfaExpiryModalDismissed = false
    const expiresAt = Math.floor(Date.now() / 1000) + sessionDuration
    this.mfaExpiryWorker?.setMfaTimer({ expiresAt })
  }

  private initMfaExpiryBroadcastChannel() {
    this.mfaExpiryBroadcastChannel = new BroadcastChannel('oc-mfa-expiry')
    this.mfaExpiryBroadcastChannel.onmessage = (event: MessageEvent) => {
      const { action } = event.data
      if (action === 'prolonged') {
        this.mfaExpiryModalDismissed = true
        if (this.mfaExpiryModalId) {
          const modalStore = useModals()
          modalStore.removeModal(this.mfaExpiryModalId)
          this.mfaExpiryModalId = null
        }
        this.prolongMfaSession()
      } else if (action === 'dismissed') {
        this.mfaExpiryModalDismissed = true
        if (this.mfaExpiryModalId) {
          const modalStore = useModals()
          modalStore.removeModal(this.mfaExpiryModalId)
          this.mfaExpiryModalId = null
        }
      }
    }
  }
}

export const authService = new AuthService()
