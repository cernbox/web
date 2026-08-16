<template>
  <div v-if="isEmbedMode" class="embed-login">
    <p v-text="$gettext('Click below to log in.')" />
    <p
      v-if="clicked"
      class="embed-login-hint"
      v-text="
        $gettext(
          'If no window appeared, your browser blocked the popup. Allow popups for this page and try again.'
        )
      "
    />
    <oc-button class="oc-mt-s" appearance="filled" variation="primary" @click="login">
      {{ $gettext('Log in') }}
    </oc-button>
  </div>
  <div v-else class="login">
    <div v-if="hasFailed" class="oc-login-card error-msg">
      <div class="oc-login-card-body">
        <h2 class="oc-login-card-title oc-mb-m">
          {{
            $pgettext(
              'The error message title displayed on login page when login fails due to any kind of error.',
              'Something went wrong'
            )
          }}
        </h2>
        <p class="oc-m-rm">
          {{
            $pgettext(
              'The error message displayed on login page when login fails due to any kind of error.',
              "We're having trouble connecting to the login service. If the problem continues, please contact support."
            )
          }}
        </p>
        <oc-button variation="primary" class="oc-mt-l" @click="login">
          {{
            $pgettext(
              'The action to retry the login on login page when login fails due to any kind of error.',
              'Try again'
            )
          }}
        </oc-button>
      </div>
    </div>
    <app-loading-spinner v-else />
  </div>
</template>

<script lang="ts">
import { authService } from '../services/auth'
import { loginWithPopupCoopFallback } from '../helpers/loginWithPopupCoopFallback'
import {
  AppLoadingSpinner,
  queryItemAsString,
  useEmbedMode,
  useRouter,
  useRouteQuery
} from '@ownclouders/web-pkg'
import { defineComponent, ref, unref } from 'vue'
import { captureException } from '@sentry/vue'

export default defineComponent({
  name: 'LoginPage',
  components: { AppLoadingSpinner },
  setup() {
    const { isEnabled: isEmbedModeEnabled } = useEmbedMode()
    const redirectUrl = useRouteQuery('redirectUrl')
    const isEmbedMode = unref(isEmbedModeEnabled)
    const clicked = ref(false)
    const hasFailed = ref(false)
    const router = useRouter()

    const login = async () => {
      if (isEmbedMode) {
        clicked.value = true

        try {
          await loginWithPopupCoopFallback(() =>
            authService.loginUser(queryItemAsString(unref(redirectUrl)))
          )
          router.replace(queryItemAsString(unref(redirectUrl)) || '/')
        } catch {
          // popup was blocked or dismissed — hint is already visible via clicked.value
        }
      } else {
        hasFailed.value = false
        try {
          await authService.loginUser(queryItemAsString(unref(redirectUrl)))
        } catch (e) {
          console.error(e)
          captureException(e)
          hasFailed.value = true
        }
      }
    }

    if (!isEmbedMode) {
      login()
    }

    return { isEmbedMode, clicked, hasFailed, login }
  }
})
</script>

<style lang="scss" scoped>
.login {
  align-content: center;
  min-height: 100dvh;
  width: 100%;
}

.error-msg {
  margin-inline: auto;
  width: min(100%, $width-xlarge-width);
}

.embed-login {
  position: fixed;
  bottom: 0;
  right: 0;
  margin: 1rem;
  background: var(--oc-color-background-default);
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  .embed-login-hint {
    font-size: 0.85rem;
    color: var(--oc-color-text-muted);
  }
}
</style>
