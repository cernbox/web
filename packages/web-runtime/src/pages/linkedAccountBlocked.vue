<template>
  <div class="oc-height-viewport oc-flex oc-flex-column oc-flex-center oc-flex-middle">
    <div class="oc-login-card">
      <img class="oc-login-logo" :src="logoImg" alt="" :aria-hidden="true" />
      <div class="oc-login-card-body oc-width-medium">
        <h2 class="oc-login-card-title" v-text="cardTitle" />
        <p v-text="cardHint" />
        <div v-if="linkedAccountDocUrl || linkedAccountPortalUrl" class="oc-mt-m">
          <oc-button
            v-if="linkedAccountDocUrl"
            data-testid="linked-account-doc-link"
            type="a"
            appearance="raw"
            :href="linkedAccountDocUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span v-text="$gettext('Read documentation')" />
          </oc-button>
          <oc-button
            v-if="linkedAccountPortalUrl"
            data-testid="linked-account-portal-link"
            type="a"
            appearance="raw"
            class="oc-mt-s"
            :href="linkedAccountPortalUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span v-text="$gettext('Open user portal to unlink')" />
          </oc-button>
        </div>
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
      @click="logout"
    >
      {{ logoutButtonText }}
    </oc-button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { useGettext } from 'vue3-gettext'
import { storeToRefs } from 'pinia'
import { useConfigStore, useThemeStore } from '@ownclouders/web-pkg'
import { authService } from '../services/auth'

const DEFAULT_LINKED_ACCOUNT_DOC_URL =
  'https://auth.docs.cern.ch/user-documentation/verified-guest/'
const DEFAULT_LINKED_ACCOUNT_PORTAL_URL = 'https://account.cern.ch/account/'

export default defineComponent({
  name: 'LinkedAccountBlockedPage',
  setup() {
    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)
    const configStore = useConfigStore()

    const { $gettext } = useGettext()

    const footerSlogan = computed(() => currentTheme.value.common.slogan)
    const logoImg = computed(() => currentTheme.value.logo.login)

    const linkedAccountDocUrl = computed(
      () => configStore.options.linkedAccount?.docUrl || DEFAULT_LINKED_ACCOUNT_DOC_URL
    )
    const linkedAccountPortalUrl = computed(() => {
      const explicit = configStore.options.linkedAccount?.userPortalUrl
      if (explicit) {
        return explicit
      }
      return configStore.options.accountEditLink?.href || DEFAULT_LINKED_ACCOUNT_PORTAL_URL
    })

    const cardTitle = computed(() => {
      return $gettext('Sign-in blocked')
    })
    const cardHint = computed(() => {
      return $gettext(
        'You signed in with an identity that is linked as a primary account elsewhere. This application cannot be used with that account until it is unlinked.'
      )
    })
    const logoutButtonText = computed(() => {
      return $gettext('Log out')
    })

    const logout = () => {
      return authService.logoutUser()
    }

    return {
      logoImg,
      cardTitle,
      cardHint,
      footerSlogan,
      logoutButtonText,
      linkedAccountDocUrl,
      linkedAccountPortalUrl,
      logout
    }
  }
})
</script>
