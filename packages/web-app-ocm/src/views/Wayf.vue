<template>
  <main id="wayf" class="oc-flex oc-height-1-1">
    <div class="wayf-wrapper oc-width-expand oc-height-1-1">
    <div class="wayf-content">
        <!-- Header Section -->
        <div class="wayf-header oc-flex oc-flex-middle oc-px-m oc-py-s">
          <oc-icon name="cloud" size="large" class="oc-mr-s" />
          <h1 class="oc-px-s" v-text="$gettext('Where Are You From?')" />
          <oc-contextual-helper class="oc-pl-xs" v-bind="helperContent" />
      </div>

        <!-- No Token State -->
        <no-content-message
          v-if="!hasToken"
          id="wayf-no-token"
          icon="cloud"
          class="oc-text-center oc-p-l"
        >
          <template #message>
            <span v-text="$gettext('Token Required')" />
          </template>
          <template #callToAction>
            <span
              class="oc-text-muted"
              v-text="$gettext('You need a token for this feature to work.')"
            />
          </template>
        </no-content-message>

        <!-- Loading State -->
        <div v-else-if="isLoadingFederations" class="oc-text-center oc-p-l">
          <app-loading-spinner />
          <p class="oc-mt-s" v-text="$gettext('Loading providers...')" />
      </div>

        <!-- Main Content -->
        <div v-else class="wayf-main oc-flex oc-flex-column oc-height-1-1">
          <!-- Self Domain Error (CERNBox enhancement) -->
      <div
        v-if="selfDomainError"
            class="wayf-error oc-background-danger oc-p-m oc-mx-m oc-mt-m oc-border-radius-medium"
      >
        <oc-icon name="error-warning" size="small" />
        <span class="oc-ml-s" v-text="$gettext('Invalid Selection')" />
        <p class="oc-mt-s" v-text="$gettext('You cannot select your own instance.')" />
      </div>

          <!-- Search Section -->
          <div class="wayf-search oc-px-m oc-pb-s">
          <oc-text-input
            v-model="searchQuery"
            :label="$gettext('Search providers')"
              type="search"
              id="wayf-search"
              name="search"
              class="oc-mb-s"
          >
            <template #icon>
              <oc-icon name="search" />
            </template>
          </oc-text-input>
        </div>

          <!-- Empty State (no federations or no matches) -->
          <div v-if="totalFilteredCount === 0" class="wayf-empty-state">
            <no-content-message id="wayf-empty" class="oc-mx-m oc-my-m" icon="search">
              <template #message>
                <span v-text="$gettext('No providers match your search')" />
              </template>
              <template #callToAction>
                <span
                  class="oc-text-muted"
                  v-text="$gettext('Try a different search or enter a domain manually below.')"
                />
              </template>
            </no-content-message>
          </div>

          <!-- Federation Sections -->
          <div v-else class="wayf-federations oc-flex-1">
            <div
              v-for="[federationName, providers] in sortedFederationEntries"
              :key="federationName"
              class="wayf-federation"
            >
              <div class="wayf-federation-header oc-flex oc-flex-middle oc-px-m oc-py-s">
                <oc-icon name="shield-check" :size="16" class="oc-mr-s" />
                <h2 class="oc-text-truncate" :title="federationName">{{ federationName }}</h2>
                <span class="wayf-provider-count oc-ml-s oc-text-muted oc-text-small">
                  {{ providers.length }}
                  {{ providers.length === 1 ? $gettext('provider') : $gettext('providers') }}
                </span>
              </div>
              <div class="wayf-providers">
                <oc-button
                  v-for="provider in providers"
                  :key="provider.fqdn"
                  appearance="raw"
                  class="wayf-provider-button oc-width-1-1 oc-px-s oc-py-s"
                  :disabled="isLoadingFederations"
                  :aria-label="$gettext('Select provider %{name}', { name: provider.name })"
                  @click="handleProviderSelect(provider)"
                >
                  <div class="oc-flex oc-flex-middle oc-flex-center">
                    <div class="oc-flex oc-flex-column oc-width-expand oc-text-center">
                      <div class="wayf-provider-name oc-text-truncate">{{ provider.name }}</div>
                      <div class="wayf-provider-fqdn oc-text-muted oc-text-small">
                        {{ provider.fqdn }}
                      </div>
                    </div>
                  </div>
                </oc-button>
                </div>
              </div>
            </div>

          <!-- Manual Provider Section -->
          <div class="wayf-manual oc-px-m oc-pt-m">
            <div class="oc-flex oc-flex-middle oc-mb-s">
              <oc-icon name="cloud" :size="20" class="oc-mr-s" />
              <h3 v-text="$gettext('Manual Provider Entry')" />
            </div>
            <oc-text-input
              v-model="manualProviderInput"
              :label="$gettext('Enter provider domain manually')"
              type="text"
              id="wayf-manual"
              name="manual"
              class="oc-mb-s"
              :disabled="isDiscovering"
              @keyup.enter="handleManualProvider"
            >
              <template #icon>
                <oc-icon name="cloud" :size="20" />
              </template>
            </oc-text-input>
            <oc-button
              appearance="filled"
              variation="primary"
              class="oc-mt-s oc-px-m oc-py-m wayf-continue-button"
              :disabled="!manualProviderInput.trim() || isDiscovering"
              @click="handleManualProvider"
            >
              <oc-icon v-if="isDiscovering" name="refresh" class="oc-mr-s" />
              <span v-text="$gettext('Continue')" />
            </oc-button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, unref } from 'vue'
import { useRoute } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage, AppLoadingSpinner } from '@ownclouders/web-pkg'
import { useWayf } from '../composables/useWayf'
import { WayfProvider, WayfFederation } from '../types/wayf'

export default defineComponent({
  name: 'Wayf',
  components: {
    NoContentMessage,
    AppLoadingSpinner
  },
  setup() {
    const route = useRoute()
    const { $gettext } = useGettext()
    const {
      federations,
      isLoadingFederations,
      isDiscovering,
      loadFederations,
      navigateToProvider,
      navigateToManualProvider,
      isSelfDomain,
      filterProviders,
      getCurrentHostname
    } = useWayf()

    // Local state
    const searchQuery = ref('')
    const manualProviderInput = ref('')
    const selfDomainError = ref(false)

    // Computed properties
    const token = computed(() => {
      return (route.query.token as string) || ''
    })

    const hasToken = computed(() => {
      return !!unref(token).trim()
    })

    const providerDomain = computed(() => {
      return getCurrentHostname()
    })

    const helperContent = computed(() => {
      return {
        text: $gettext(
          'Select your cloud provider to continue with the invitation process. You can search for providers or enter a domain manually.'
        ),
        title: $gettext('Where Are You From?')
      }
    })

    const filteredFederations = computed(() => {
      if (!unref(searchQuery)) {
        return unref(federations)
      }

      const filtered: WayfFederation = {}
      Object.entries(unref(federations)).forEach(([federationName, providers]) => {
        const filteredProviders = filterProviders(providers, unref(searchQuery))
        if (filteredProviders.length > 0) {
          filtered[federationName] = filteredProviders
        }
      })

      return filtered
    })

    const totalFilteredCount = computed(() => {
      return Object.values(unref(filteredFederations)).reduce(
        (sum, arr) => sum + arr.length,
        0
      )
    })

    const sortedFederationEntries = computed(() => {
      return Object.entries(unref(filteredFederations)).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    })

    // Methods
    const showSelfDomainError = () => {
      selfDomainError.value = true
      setTimeout(() => {
        selfDomainError.value = false
      }, 5000)
    }

    const handleProviderSelect = (provider: WayfProvider) => {
      if (isSelfDomain(provider.fqdn)) {
        showSelfDomainError()
        return
      }

      navigateToProvider(provider, unref(token), unref(providerDomain))
    }

    const handleManualProvider = async () => {
      const input = unref(manualProviderInput).trim()
      if (!input) {
        return
      }

      if (isSelfDomain(input)) {
        showSelfDomainError()
        return
      }

      await navigateToManualProvider(input, unref(token), unref(providerDomain))
    }

    // Lifecycle
    onMounted(async () => {
      if (unref(hasToken)) {
        await loadFederations()
      }
    })

    return {
      // State
      federations,
      isLoadingFederations,
      isDiscovering,
      searchQuery,
      manualProviderInput,
      selfDomainError,
      // Computed
      hasToken,
      helperContent,
      filteredFederations,
      totalFilteredCount,
      sortedFederationEntries,
      // Methods
      handleProviderSelect,
      handleManualProvider
    }
  }
})
</script>

<style lang="scss" scoped>
#wayf {
  background-color: var(--oc-color-background-hover);
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.wayf-wrapper {
  width: 100%;
  height: 100%;
  background-color: var(--oc-color-background-default);
  border-radius: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wayf-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.wayf-header {
  background-color: var(--oc-color-background-hover);
  border-bottom: 1px solid var(--oc-color-border);
  flex-shrink: 0;
  min-height: 60px;

  h1 {
    color: var(--oc-color-text-default);
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }
}

.wayf-error {
  flex-shrink: 0;
}

.wayf-main {
  background-color: var(--oc-color-background-default);
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.wayf-search {
  background-color: var(--oc-color-background-hover);
  border-bottom: 1px solid var(--oc-color-border);
  flex-shrink: 0;
  overflow: hidden;
  min-height: 80px;
}

.wayf-federations {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  padding: var(--oc-space-small);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  grid-gap: var(--oc-space-small);
  align-content: start;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--oc-color-border);
    border-radius: 3px;

    &:hover {
      background: var(--oc-color-text-muted);
    }
  }
}

.wayf-federation {
  border: 1px solid var(--oc-color-border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 280px;
  height: 280px;
}

.wayf-federation-header {
  background-color: var(--oc-color-background-hover);
  border-bottom: 1px solid var(--oc-color-border);
  min-height: 42px;

  h2 {
    color: var(--oc-color-text-default);
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    min-width: 0;
    flex: 1 1 auto;
  }

  .wayf-provider-count {
    background-color: var(--oc-color-background-default);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    margin-left: auto;
    min-width: fit-content;
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
}

.wayf-providers {
  background-color: var(--oc-color-background-default);
  overflow-y: auto;
  flex: 1;
  min-height: 0;

  &::-webkit-scrollbar {
    width: 6px;
}

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--oc-color-border);
    border-radius: 3px;

    &:hover {
      background: var(--oc-color-text-muted);
    }
  }
}

.wayf-provider-button {
  border: none;
  border-bottom: 1px solid var(--oc-color-border);
  border-radius: 0;
  text-align: left;
  transition: background-color 0.15s ease;
  font-size: 0.9rem;
  padding-top: var(--oc-space-2xsmall);
  padding-bottom: var(--oc-space-2xsmall);

  &:hover:not(:disabled) {
    background-color: var(--oc-color-background-hover);
  }

  &:last-child {
    border-bottom: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.wayf-provider-name {
  font-weight: 600;
  color: var(--oc-color-text-default);
  margin-bottom: 2px;
  font-size: 1rem;
}

.wayf-provider-fqdn {
  color: var(--oc-color-text-muted);
  font-family: monospace;
  font-size: 0.8rem;
}

.wayf-manual {
  background-color: var(--oc-color-background-hover);
  border-top: 1px solid var(--oc-color-border);
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  padding-bottom: var(--oc-space-medium);
  display: flex;
  flex-direction: column;

  h3 {
    color: var(--oc-color-text-default);
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }
}

.wayf-continue-button {
  width: 100%;
}

.wayf-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  flex: 1;
}

@media (max-width: $oc-breakpoint-large-default) {
  .wayf-federations {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: $oc-breakpoint-medium-default) {
  .wayf-header {
    h1 {
      font-size: 1.25rem;
    }
  }

  .wayf-federation-header {
    h2 {
      font-size: 1rem;
    }
  }

  .wayf-federations {
    grid-template-columns: 1fr;
  }

  .wayf-federation {
    max-height: 240px;
    height: 240px;
  }
}

@media (max-height: 600px) {
  .wayf-federation {
    max-height: 200px;
    height: 200px;
  }
}
</style>
