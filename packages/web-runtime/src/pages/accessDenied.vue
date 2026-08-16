<template>
  <div class="oc-height-viewport oc-flex oc-flex-column oc-flex-center oc-flex-middle">
    <div class="oc-login-card">
      <router-link to="/" aria-label="Home">
        <img class="oc-login-logo" :src="logoImg" alt="" :aria-hidden="true" />
      </router-link>
      <div class="oc-login-card-body oc-width-medium">
        <h2 class="oc-login-card-title" v-text="cardTitle" />
        <p v-text="cardHint" />
        <oc-button
          v-if="accessDeniedHelpUrl"
          type="a"
          appearance="raw"
          :href="accessDeniedHelpUrl"
          target="_blank"
          ><span v-text="$gettext('Read more')"
        /></oc-button>
      </div>
      <div class="oc-login-card-footer oc-pt-rm">
        <p>
          {{ footerSlogan }}
        </p>
      </div>
    </div>
    <oc-button
      id="exitAnchor"
      class="oc-mt-m oc-width-medium"
      size="large"
      appearance="filled"
      variation="primary"
      v-bind="logoutButtonsAttrs"
    >
      {{ navigateToLoginText }}
    </oc-button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { storeToRefs } from 'pinia'
import {
  queryItemAsString,
  useConfigStore,
  useRouteQuery,
  useThemeStore
} from '@ownclouders/web-pkg'

export default defineComponent({
  name: 'AccessDeniedPage',
  setup() {
    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)
    const configStore = useConfigStore()
    const redirectUrlQuery = useRouteQuery('redirectUrl')
    const reasonQuery = useRouteQuery('reason')

    const { $gettext } = useGettext()

    const isLoginError = computed(() => queryItemAsString(unref(reasonQuery)) === 'loginError')

    const accessDeniedHelpUrl = computed(() => currentTheme.value.common.urls.accessDeniedHelp)
    const footerSlogan = computed(() => currentTheme.value.common.slogan)
    const logoImg = computed(() => currentTheme.value.logo.login)

    const cardTitle = computed(() => {
      if (unref(isLoginError)) {
        return $gettext('Error signing in')
      }
      return $gettext('Not logged in')
    })
    const cardHint = computed(() => {
      if (unref(isLoginError)) {
        return $gettext(
          'There was an error while trying to sign you in. Please try again or contact your administrator if the problem persists.'
        )
      }
      return $gettext(
        'This could be because of a routine safety log out, or because your account is either inactive or not yet authorized for use. Please try logging in after a while or seek help from your Administrator.'
      )
    })
    const navigateToLoginText = computed(() => $gettext('Log in again'))
    const logoutButtonsAttrs = computed(() => {
      const redirectUrl = queryItemAsString(unref(redirectUrlQuery))
      if (configStore.options.loginUrl) {
        const configLoginURL = new URL(encodeURI(configStore.options.loginUrl))
        if (redirectUrl) {
          configLoginURL.searchParams.append('redirectUrl', redirectUrl)
        }
        return { type: 'a', href: configLoginURL.toString() }
      }
      return {
        type: 'router-link',
        to: { name: 'login', query: { ...(redirectUrl && { redirectUrl }) } }
      }
    })

    return {
      logoImg,
      cardTitle,
      cardHint,
      footerSlogan,
      navigateToLoginText,
      accessDeniedHelpUrl,
      logoutButtonsAttrs
    }
  }
})
</script>
