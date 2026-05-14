<template>
  <div v-if="sessionExpired" class="session-expired-overlay">
    <div class="oc-login-card session-expired-card">
      <router-link to="/" aria-label="Home">
        <img class="oc-login-logo" :src="logoImg" alt="" :aria-hidden="true" />
      </router-link>
      <div class="oc-login-card-body oc-width-medium">
        <h2 class="oc-login-card-title" v-text="$gettext('Session expired')" />
        <p
          v-if="popupBlocked"
          v-text="$gettext('Popup was blocked. Please allow popups for this page in your browser and try again.')"
        />
        <p
          v-else
          v-text="
            $gettext(
              'Your session has expired. If you are logged in on another tab, this page will resume automatically. Otherwise, click Reconnect to log in again.'
            )
          "
        />
      </div>
      <div class="oc-login-card-footer oc-pt-rm">
        <p>{{ footerSlogan }}</p>
      </div>
    </div>
    <oc-button
      class="oc-mt-m oc-width-medium"
      size="large"
      appearance="filled"
      variation="primary"
      :disabled="reconnecting"
      @click="reconnect"
    >
      {{ reconnecting ? $gettext('Opening login…') : $gettext('Reconnect') }}
    </oc-button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref } from 'vue'
import { useAuthService, useAuthStore, useRouter, useThemeStore } from '@ownclouders/web-pkg'
import { storeToRefs } from 'pinia'

export default defineComponent({
  name: 'SessionExpiredModal',
  setup() {
    const authService = useAuthService()
    const authStore = useAuthStore()
    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)
    const { sessionExpired } = storeToRefs(authStore)

    const reconnecting = ref(false)
    const popupBlocked = ref(false)
    const logoImg = computed(() => currentTheme.value?.logo?.login)
    const footerSlogan = computed(() => currentTheme.value?.common?.slogan)

    const router = useRouter()

    const authRoutes = new Set([
      'login', 'logout', 'oidcCallback', 'oidcSilentRedirect', 'oidcPopupCallback', 'accessDenied'
    ])

    const dismiss = () => {
      reconnecting.value = false
      popupBlocked.value = false
      authStore.setSessionExpired(false)
      // If reconnect succeeded while on a transient auth page, go home
      const currentName = router.currentRoute.value?.name as string
      if (authRoutes.has(currentName)) {
        router.replace('/')
      }
    }

    const handleStorageEvent = (event: StorageEvent) => {
      if (!event.key?.startsWith('oc_oAuth.') || !event.newValue) {
        return
      }
      // Only attempt cross-tab reconnect when the session is actually expired
      if (!authStore.sessionExpired) {
        return
      }
      authService.signinSilent().then(dismiss).catch(() => {})
    }

    onMounted(() => window.addEventListener('storage', handleStorageEvent))
    onUnmounted(() => window.removeEventListener('storage', handleStorageEvent))

    const reconnect = async () => {
      reconnecting.value = true
      popupBlocked.value = false

      // BroadcastChannel handles the COOP fallback where window.opener is null
      const bc = new BroadcastChannel('oc_oidc_popup_complete')
      const coopFallback = new Promise<void>((resolve) => {
        bc.addEventListener('message', async (e) => {
          if (e.data?.type === 'complete') {
            bc.close()
            await authService.reloadUserFromStorage()
            resolve()
          }
        })
      })

      try {
        await Promise.race([authService.loginUserPopup(), coopFallback])
        bc.close()
        dismiss()
      } catch {
        bc.close()
        reconnecting.value = false
        popupBlocked.value = true
      }
    }

    return { sessionExpired, logoImg, footerSlogan, reconnecting, popupBlocked, reconnect }
  }
})
</script>

<style lang="scss" scoped>
.session-expired-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.session-expired-card {
  text-align: center;
}
</style>
