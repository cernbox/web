<template>
  <!-- Popup window: bare page, no chrome, just status text -->
  <div v-if="isPopupCallback" class="popup-callback">
    <span v-if="error" v-translate>Authentication failed. Please close this window and try again.</span>
    <span v-else v-translate>Logging you in…</span>
  </div>

  <!-- Normal / silent redirect: existing login card -->
  <div v-else class="oc-login-card oc-position-center">
    <router-link to="/" aria-label="Home">
      <img class="oc-login-logo" :src="logoImg" alt="" :aria-hidden="true" />
    </router-link>
    <div v-show="error" class="oc-login-card-body">
      <h2 v-translate class="oc-login-card-title">Authentication failed</h2>
      <p v-translate>Please contact the administrator if this error persists.</p>
    </div>
    <div v-show="!error" class="oc-login-card-body">
      <h3 v-translate class="oc-login-card-title">Logging you in</h3>
      <p v-translate>Please wait, you are being redirected.</p>
    </div>
    <div class="oc-login-card-footer oc-pt-rm">
      <p>{{ footerSlogan }}</p>
    </div>
  </div>
  <!-- v-if, not v-show: the target must not exist while logging in, or the OTG mounts on every login -->
  <div v-if="!isPopupCallback && error" class="snackbars">
    <portal-target name="app.runtime.errorPages" />
    <message-bar />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, unref } from 'vue'
import { useEmbedMode, useRoute, useThemeStore } from '@ownclouders/web-pkg'
import { authService } from '../services/auth'
import MessageBar from '../components/MessageBar.vue'
import { storeToRefs } from 'pinia'

export default defineComponent({
  name: 'OidcCallbackPage',
  components: {
    MessageBar
  },
  setup() {
    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)

    const { isDelegatingAuthentication, postMessage, verifyDelegatedAuthenticationOrigin } =
      useEmbedMode()

    const error = ref(false)

    const footerSlogan = computed(() => unref(currentTheme)?.common.slogan)
    const logoImg = computed(() => unref(currentTheme)?.logo.login)

    const route = useRoute()

    const handleRequestedTokenEvent = (event: MessageEvent): void => {
      if (verifyDelegatedAuthenticationOrigin(event.origin) === false) {
        return
      }

      if (event.data?.name !== 'owncloud-embed:update-token') {
        return
      }

      console.debug(
        '[page:oidcCallback:handleRequestedTokenEvent] - received delegated access_token'
      )
      authService.signInCallback(event.data.data.access_token)
    }

    onMounted(() => {
      if (unref(route).query.error) {
        error.value = true
        console.warn(
          `OAuth error: ${unref(route).query.error} - ${unref(route).query.error_description}`
        )
        return
      }

      if (unref(isDelegatingAuthentication)) {
        console.debug('[page:oidcCallback:hook:mounted] - adding update-token event listener')
        window.addEventListener('message', handleRequestedTokenEvent)
        console.debug('[page:oidcCallback:hook:mounted] - requesting delegated access_token')
        postMessage<void>('owncloud-embed:request-token')

        return
      }

      if (unref(route).path === '/web-oidc-silent-redirect') {
        authService.signInSilentCallback()
      } else if (unref(route).path === '/web-oidc-popup-callback') {
        authService.signInPopupCallback().catch((e) => {
          if (e?.message?.includes('window.opener')) {
            // COOP: window.opener severed by SSO headers — fall back to BroadcastChannel
            authService
              .signInCallbackForCOOPFallback()
              .then(() => window.close())
              .catch((e2) => {
                console.error('Popup COOP fallback failed:', e2)
                error.value = true
              })
          } else {
            console.error('Popup callback failed:', e)
            error.value = true
          }
        })
      } else {
        authService.signInCallback()
      }
    })

    onBeforeUnmount(() => {
      if (!unref(isDelegatingAuthentication)) {
        return
      }

      console.debug('[page:oidcCallback:hook:beforeUnmount] - removing update-token event listener')
      window.removeEventListener('message', handleRequestedTokenEvent)
    })

    const isPopupCallback = unref(route).path === '/web-oidc-popup-callback'

    return {
      error,
      isPopupCallback,
      logoImg,
      footerSlogan
    }
  }
})
</script>

<style lang="scss" scoped>
.popup-callback {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--oc-color-background-default);
  color: var(--oc-color-text-default);
  font-size: var(--oc-font-size-medium);
}

.snackbars {
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: calc(var(--oc-z-index-modal) + 1);

  @media (max-width: 640px) {
    left: 0;
    right: 0;
    margin: 0 auto;
    width: 100%;
    max-width: 500px;
  }
}
</style>
