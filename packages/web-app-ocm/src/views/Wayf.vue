<template>
  <div class="wayf-container">
    <div class="wayf-content">
      <!-- Header -->
      <div class="oc-text-center oc-mb-l">
        <h1 v-text="$gettext('Where Are You From?')" />
        <p class="oc-mt-s" v-text="$gettext('Select your institution to accept the invitation')" />
      </div>

      <!-- Error Messages -->
      <div v-if="!hasToken" class="oc-background-warning oc-p-m oc-mb-m oc-border-radius-medium">
        <oc-icon name="information" size="small" />
        <span class="oc-ml-s" v-text="$gettext('Token Required')" />
        <p class="oc-mt-s" v-text="$gettext('An invitation token is required to use this page.')" />
      </div>

      <div
        v-if="selfDomainError"
        class="oc-background-danger oc-p-m oc-mb-m oc-border-radius-medium"
      >
        <oc-icon name="error-warning" size="small" />
        <span class="oc-ml-s" v-text="$gettext('Invalid Selection')" />
        <p class="oc-mt-s" v-text="$gettext('You cannot select your own instance.')" />
      </div>

      <template v-if="hasToken">
        <!-- Manual Provider Entry -->
        <div class="manual-entry oc-mb-l">
          <h2 class="oc-mb-s" v-text="$gettext('Enter Your Provider Domain')" />
          <div class="oc-flex oc-flex-middle">
            <oc-text-input
              v-model="manualProviderInput"
              :label="$gettext('Provider domain (e.g., cernbox.cern.ch)')"
              :disabled="isDiscovering"
              class="oc-flex-1 oc-mr-s"
              @keyup.enter="handleManualProvider"
            />
            <oc-button
              :disabled="!manualProviderInput || isDiscovering"
              @click="handleManualProvider"
            >
              <oc-icon v-if="isDiscovering" name="refresh" />
              <span v-text="$gettext('Continue')" />
            </oc-button>
          </div>
        </div>

        <!-- Divider -->
        <div class="oc-flex oc-flex-middle oc-mb-l">
          <hr class="oc-flex-1" />
          <span class="oc-px-m oc-text-muted" v-text="$gettext('or')" />
          <hr class="oc-flex-1" />
        </div>

        <!-- Search -->
        <div class="oc-mb-m">
          <oc-text-input
            v-model="searchQuery"
            :label="$gettext('Search providers')"
            :clear-button-enabled="true"
            class="search-input"
          >
            <template #icon>
              <oc-icon name="search" />
            </template>
          </oc-text-input>
        </div>

        <!-- Loading State -->
        <app-loading-spinner v-if="isLoadingFederations" />

        <!-- Federations List -->
        <template v-else>
          <div v-if="Object.keys(federations).length === 0" class="oc-text-center oc-py-xl">
            <oc-icon name="cloud-off" size="xxlarge" />
            <p class="oc-mt-m" v-text="$gettext('No federations available')" />
          </div>

          <div v-else class="federations-list">
            <div
              v-for="(providers, federationName) in filteredFederations"
              :key="federationName"
              class="federation-section oc-mb-l"
            >
              <h3 class="oc-mb-s" v-text="federationName" />
              <div class="providers-grid">
                <div
                  v-for="provider in providers"
                  :key="provider.fqdn"
                  class="provider-card oc-p-m oc-border-radius-medium"
                  @click="handleProviderSelect(provider)"
                >
                  <div class="provider-info">
                    <h4 class="provider-name" v-text="provider.name" />
                    <p class="provider-domain oc-text-muted" v-text="provider.fqdn" />
                  </div>
                  <oc-icon name="arrow-right" />
                </div>
              </div>
            </div>

            <div
              v-if="searchQuery && Object.keys(filteredFederations).length === 0"
              class="oc-text-center oc-py-xl"
            >
              <oc-icon name="search" size="xlarge" />
              <p class="oc-mt-m" v-text="$gettext('No providers found matching your search')" />
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, unref } from 'vue'
import { useRoute } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import { AppLoadingSpinner } from '@ownclouders/web-pkg'
import { useWayf } from '../composables/useWayf'
import { WayfProvider, WayfFederation } from '../types/wayf'

export default defineComponent({
  name: 'Wayf',
  components: {
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

    const searchQuery = ref('')
    const manualProviderInput = ref('')
    const selfDomainError = ref(false)

    const token = computed(() => {
      return (route.query.token as string) || ''
    })

    const hasToken = computed(() => {
      return !!unref(token)
    })

    const providerDomain = computed(() => {
      // Always use current hostname for security
      return getCurrentHostname()
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

    const handleProviderSelect = (provider: WayfProvider) => {
      if (isSelfDomain(provider.fqdn)) {
        selfDomainError.value = true
        setTimeout(() => {
          selfDomainError.value = false
        }, 5000)
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
        selfDomainError.value = true
        setTimeout(() => {
          selfDomainError.value = false
        }, 5000)
        return
      }

      await navigateToManualProvider(input, unref(token), unref(providerDomain))
    }

    onMounted(async () => {
      if (unref(hasToken)) {
        await loadFederations()
      }
    })

    return {
      federations,
      isLoadingFederations,
      isDiscovering,
      searchQuery,
      manualProviderInput,
      hasToken,
      selfDomainError,
      filteredFederations,
      handleProviderSelect,
      handleManualProvider
    }
  }
})
</script>

<style lang="scss" scoped>
.wayf-container {
  min-height: 100vh;
  background-color: var(--oc-color-background-hover);
  padding: var(--oc-space-large);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
}

.wayf-content {
  max-width: 1200px;
  width: 100%;
  background-color: var(--oc-color-background-default);
  border-radius: 15px;
  padding: var(--oc-space-xlarge);
  margin-top: var(--oc-space-large);

  @media (max-width: $oc-breakpoint-medium-default) {
    padding: var(--oc-space-medium);
    margin-top: 0;
  }
}

.manual-entry {
  .oc-text-input {
    max-width: 100%;
  }
}

.search-input {
  max-width: 600px;
  margin: 0 auto;
}

.federations-list {
  margin-top: var(--oc-space-large);
}

.federation-section {
  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--oc-color-text-default);
    margin-bottom: var(--oc-space-medium);
  }
}

.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--oc-space-medium);

  @media (max-width: $oc-breakpoint-medium-default) {
    grid-template-columns: 1fr;
  }
}

.provider-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--oc-color-background-hover);
  border: 1px solid var(--oc-color-border);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--oc-color-background-highlight);
    border-color: var(--oc-color-swatch-primary-default);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }
}

.provider-info {
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--oc-color-text-default);
  margin: 0 0 var(--oc-space-xsmall) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-domain {
  font-size: 0.875rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

hr {
  border: none;
  border-top: 1px solid var(--oc-color-border);
  margin: 0;
}
</style>
