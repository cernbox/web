<template>
  <main id="wayf" class="wayf">
    <div class="wayf-container">
      <img v-if="logoImg" class="wayf-logo" :src="logoImg" alt="" :aria-hidden="true" />
      <div class="wayf-card">
        <h2 class="wayf-title" v-text="$gettext('Select your server')" />

        <p
          v-if="!hasToken"
          class="wayf-text-secondary oc-mb-rm"
          v-text="$gettext('You need an invite link for this feature to work.')"
        />

        <template v-else>
          <p
            class="wayf-intro wayf-text-secondary"
            v-text="
              $gettext(
                'To accept the invitation from %{provider}, choose the server where you have your account.',
                { provider: providerDomain }
              )
            "
          />

          <div v-if="isLoadingFederations" class="oc-flex oc-flex-center oc-my-m">
            <oc-spinner :aria-label="$gettext('Loading servers')" />
          </div>

          <template v-else>
            <oc-text-input
              v-if="hasFederations"
              id="wayf-search"
              v-model="searchQuery"
              class="oc-mb-m"
              :label="$gettext('Type to search')"
              :clear-button-enabled="true"
            />

            <section
              v-for="[federationName, providers] in sortedFederationEntries"
              :key="federationName"
              class="wayf-federation"
            >
              <h3 class="wayf-federation-name" v-text="federationName" />
              <ul class="wayf-provider-list">
                <li v-for="provider in providers" :key="provider.fqdn">
                  <a class="wayf-provider" :href="provider.inviteUrl">
                    <span class="wayf-provider-text">
                      <span class="wayf-provider-name" v-text="provider.name" />
                      <span class="wayf-provider-fqdn wayf-text-secondary" v-text="provider.fqdn" />
                    </span>
                    <oc-icon name="arrow-right-s" fill-type="line" />
                  </a>
                </li>
              </ul>
            </section>

            <p v-if="emptyMessage" class="wayf-empty wayf-text-secondary" v-text="emptyMessage" />
          </template>

          <form class="wayf-manual" @submit.prevent="handleManualProvider">
            <oc-text-input
              id="wayf-manual"
              v-model="manualProviderInput"
              :label="$gettext('Your server not listed? Enter its address.')"
              :error-message="manualProviderError"
              :disabled="isDiscovering"
              @update:model-value="manualProviderError = ''"
            />
            <div class="oc-flex oc-flex-right oc-mt-s">
              <oc-button
                submit="submit"
                appearance="filled"
                variation="primary"
                :disabled="!manualProviderInput.trim() || isDiscovering"
                :show-spinner="isDiscovering"
              >
                <span v-text="$gettext('Continue')" />
              </oc-button>
            </div>
          </form>
        </template>

        <p v-if="footerSlogan" class="wayf-footer wayf-text-secondary" v-text="footerSlogan" />
      </div>
    </div>
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { queryItemAsString, useRoute, useThemeStore } from '@ownclouders/web-pkg'
import { useWayf } from '../composables/useWayf'
import { WayfProvider } from '../types/wayf'

type WayfProviderWithInviteUrl = WayfProvider & { inviteUrl: string }

export default defineComponent({
  name: 'Wayf',
  setup() {
    const route = useRoute()
    const { $gettext } = useGettext()
    const themeStore = useThemeStore()
    const {
      federations,
      isLoadingFederations,
      loadFederationsFailed,
      isDiscovering,
      loadFederations,
      buildProviderInviteUrl,
      navigateToManualProvider,
      filterProviders,
      getCurrentHostname
    } = useWayf()

    const searchQuery = ref('')
    const manualProviderInput = ref('')
    const manualProviderError = ref('')

    const logoImg = computed(() => themeStore.currentTheme?.logo?.login)
    const footerSlogan = computed(() => themeStore.currentTheme?.common?.slogan)

    const token = computed(() => queryItemAsString(unref(route).query.token)?.trim() || '')
    const hasToken = computed(() => !!unref(token))

    // the invitation was created on this server, so this server is the inviting provider
    const providerDomain = computed(() => getCurrentHostname())

    const hasFederations = computed(() => Object.keys(unref(federations)).length > 0)

    // federations sorted by name, with the providers matching the search and a link to
    // their invite accept dialog. federations without matches are left out
    const sortedFederationEntries = computed((): [string, WayfProviderWithInviteUrl[]][] => {
      return Object.entries(unref(federations))
        .map(([federationName, providers]): [string, WayfProviderWithInviteUrl[]] => [
          federationName,
          filterProviders(providers, unref(searchQuery))
            .map((provider) => ({
              ...provider,
              inviteUrl: buildProviderInviteUrl(provider, unref(token), unref(providerDomain))
            }))
            .filter(({ inviteUrl }) => !!inviteUrl)
        ])
        .filter(([, providers]) => providers.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
    })

    const emptyMessage = computed(() => {
      if (unref(loadFederationsFailed)) {
        return $gettext(
          'The list of servers could not be loaded. You can still enter your server below.'
        )
      }
      if (!unref(hasFederations)) {
        return $gettext('No servers are currently available.')
      }
      if (!unref(sortedFederationEntries).length) {
        return $gettext('No servers match your search.')
      }
      return ''
    })

    const handleManualProvider = async () => {
      const input = unref(manualProviderInput).trim()
      if (!input || unref(isDiscovering)) {
        return
      }

      manualProviderError.value =
        (await navigateToManualProvider(input, unref(token), unref(providerDomain))) || ''
    }

    onMounted(async () => {
      if (unref(hasToken)) {
        await loadFederations()
      }
    })

    return {
      logoImg,
      footerSlogan,
      hasToken,
      providerDomain,
      isLoadingFederations,
      isDiscovering,
      hasFederations,
      searchQuery,
      sortedFederationEntries,
      emptyMessage,
      manualProviderInput,
      manualProviderError,
      handleManualProvider
    }
  }
})
</script>

<style lang="scss" scoped>
// the plain layout doesn't scroll, so the page has to
.wayf {
  height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--oc-space-xlarge) var(--oc-space-medium);
}

.wayf-container {
  max-width: 560px;
  margin: 0 auto;
}

.wayf-logo {
  display: block;
  max-height: 120px;
  max-width: 200px;
  margin: 0 auto var(--oc-space-large);
}

.wayf-card {
  background-color: var(--oc-color-background-default);
  color: var(--oc-color-text-default);
  border-radius: 15px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  padding: var(--oc-space-large);
}

// text-muted is too close to the backgrounds in some dark themes (in the CERNBox one it
// equals background-muted), so secondary text is the default text color, toned down
.wayf-text-secondary {
  color: var(--oc-color-text-default);
  opacity: 0.75;
}

.wayf-title {
  margin: 0 0 var(--oc-space-small);
  font-size: 1.5rem;
}

.wayf-intro {
  margin: 0 0 var(--oc-space-medium);
}

.wayf-federation + .wayf-federation {
  margin-top: var(--oc-space-medium);
}

.wayf-federation-name {
  margin: 0 0 var(--oc-space-xsmall);
  font-size: 1rem;
}

.wayf-provider-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.wayf-provider {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-small);
  margin: var(--oc-space-xsmall) 0;
  padding: var(--oc-space-small) var(--oc-space-medium);
  border: 1px solid var(--oc-color-border);
  border-radius: 10px;
  background-color: var(--oc-color-background-hover);
  color: var(--oc-color-text-default);
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover,
  &:focus-visible {
    background-color: var(--oc-color-background-highlight);
    border-color: var(--oc-color-swatch-primary-default);
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid var(--oc-color-swatch-primary-default);
    outline-offset: 2px;
  }

  &:active {
    background-color: var(--oc-color-swatch-primary-default);
    color: var(--oc-color-swatch-primary-contrast);

    .wayf-provider-fqdn {
      color: inherit;
    }
  }
}

.wayf-provider-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.wayf-provider-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wayf-provider-fqdn {
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wayf-empty {
  margin: var(--oc-space-small) 0 0;
}

.wayf-manual {
  margin-top: var(--oc-space-large);
}

.wayf-footer {
  margin: var(--oc-space-large) 0 0;
  text-align: center;
  font-size: 0.875rem;
}
</style>
