<template>
  <div v-if="isEmbedMode" class="embed-login">
    <p v-text="$gettext('Click below to log in.')" />
    <p
      v-if="clicked"
      class="embed-login-hint"
      v-text="$gettext('If no window appeared, your browser blocked the popup. Allow popups for this page and try again.')"
    />
    <oc-button class="oc-mt-s" appearance="filled" variation="primary" @click="login">
      {{ $gettext('Log in') }}
    </oc-button>
  </div>
  <div v-else class="oc-width-1-1 oc-height-1-1">
    <app-loading-spinner />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, unref } from 'vue'
import { authService } from '../services/auth'
import {
  AppLoadingSpinner,
  queryItemAsString,
  useEmbedMode,
  useRouter,
  useRouteQuery
} from '@ownclouders/web-pkg'

export default defineComponent({
  name: 'LoginPage',
  components: { AppLoadingSpinner },
  setup() {
    const { isEnabled: isEmbedModeEnabled } = useEmbedMode()
    const redirectUrl = useRouteQuery('redirectUrl')
    const isEmbedMode = unref(isEmbedModeEnabled)
    const clicked = ref(false)
    const router = useRouter()

    if (!isEmbedMode) {
      authService.loginUser(queryItemAsString(unref(redirectUrl)))
    }

    const login = async () => {
      clicked.value = true
      try {
        await authService.loginUser(queryItemAsString(unref(redirectUrl)))
        // Popup flow doesn't redirect automatically — navigate to the original target
        router.replace(queryItemAsString(unref(redirectUrl)) || '/')
      } catch {
        // popup was blocked or dismissed — hint is already visible via clicked.value
      }
    }

    return { isEmbedMode, clicked, login }
  }
})
</script>

<style lang="scss" scoped>
.embed-login {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-small);
  background: var(--oc-color-background-default);
  color: var(--oc-color-text-default);
  padding: var(--oc-space-medium);
  text-align: center;
}

.embed-login-hint {
  color: var(--oc-color-text-muted);
  font-size: var(--oc-font-size-small);
  max-width: 320px;
}
</style>
