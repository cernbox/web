import { ref } from 'vue'
import { useClientService } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import {
  WayfFederation,
  WayfProvider,
  FederationsApiResponse,
  DiscoverResponse
} from '../types/wayf'

// the WAYF page renders in the plain layout, which has no message bar, so errors are
// returned to the page to show inline instead of being dispatched as messages
export const useWayf = () => {
  const clientService = useClientService()
  const { $gettext } = useGettext()

  const federations = ref<WayfFederation>({})
  const isLoadingFederations = ref(false)
  const loadFederationsFailed = ref(false)
  const isDiscovering = ref(false)

  const getCurrentHostname = (): string => {
    return window.location.hostname
  }

  const stripProtocolAndPort = (domain: string): string => {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
      return url.hostname
    } catch {
      return domain.replace(/^https?:\/\//, '').split(':')[0]
    }
  }

  const isSelfDomain = (domain: string): boolean => {
    const currentHost = stripProtocolAndPort(getCurrentHostname())
    const checkHost = stripProtocolAndPort(domain)
    return currentHost === checkHost
  }

  const loadFederations = async () => {
    isLoadingFederations.value = true
    loadFederationsFailed.value = false
    try {
      const { data } = await clientService.httpUnAuthenticated.get<FederationsApiResponse>(
        '/sciencemesh/federations'
      )

      const federationMap: WayfFederation = {}

      data.forEach((federation) => {
        const providers = federation.servers
          .filter((server) => !isSelfDomain(server.url))
          .map((server) => ({
            name: server.displayName,
            fqdn: stripProtocolAndPort(server.url),
            inviteAcceptDialog: server.inviteAcceptDialog || ''
          }))

        if (providers.length > 0) {
          federationMap[federation.federation] = providers
        }
      })

      federations.value = federationMap
    } catch (error) {
      console.error('Failed to load federations:', error)
      loadFederationsFailed.value = true
    } finally {
      isLoadingFederations.value = false
    }
  }

  const discoverProvider = async (domain: string): Promise<DiscoverResponse | null> => {
    isDiscovering.value = true
    try {
      const { data } = await clientService.httpUnAuthenticated.post<DiscoverResponse>(
        '/sciencemesh/discover',
        { domain }
      )
      return data
    } catch (error) {
      console.error('Failed to discover provider:', error)
      return null
    } finally {
      isDiscovering.value = false
    }
  }

  // the provider's invite accept dialog with the invitation attached, empty if it can't be built
  const buildProviderInviteUrl = (
    provider: WayfProvider,
    token: string,
    providerDomain: string
  ): string => {
    // relative paths are resolved against the provider, absolute urls are kept as they are
    const inviteDialogPath = provider.inviteAcceptDialog || '/open-cloud-mesh/accept-invite'
    try {
      const url = new URL(inviteDialogPath, `https://${provider.fqdn}`)
      // the dialog comes from the directory or the remote server, so anything that isn't a
      // web url (e.g. javascript:) is rejected rather than linked to or navigated to
      if (!['https:', 'http:'].includes(url.protocol)) {
        return ''
      }
      url.searchParams.set('token', token)
      url.searchParams.set('providerDomain', providerDomain)
      return url.toString()
    } catch {
      return ''
    }
  }

  // navigates to the provider's invite accept dialog, or resolves to an error message
  const navigateToManualProvider = async (
    input: string,
    token: string,
    providerDomain: string
  ): Promise<string | undefined> => {
    const domain = stripProtocolAndPort(input)

    if (isSelfDomain(domain)) {
      return $gettext(
        'This is the server the invitation came from. Enter the server where you have your account.'
      )
    }

    const discoveryResult = await discoverProvider(domain)
    const inviteUrl =
      discoveryResult &&
      buildProviderInviteUrl(
        {
          name: domain,
          fqdn: domain,
          inviteAcceptDialog: discoveryResult.inviteAcceptDialog || ''
        },
        token,
        providerDomain
      )
    if (!inviteUrl) {
      return $gettext(
        'Could not find a server that accepts invitations at %{domain}. Check the address and try again.',
        { domain }
      )
    }

    window.location.href = inviteUrl
  }

  const filterProviders = (providers: WayfProvider[], query: string): WayfProvider[] => {
    if (!query) {
      return providers
    }

    const lowerQuery = query.toLowerCase()
    return providers.filter(
      (provider) =>
        provider.name.toLowerCase().includes(lowerQuery) ||
        provider.fqdn.toLowerCase().includes(lowerQuery)
    )
  }

  return {
    federations,
    isLoadingFederations,
    loadFederationsFailed,
    isDiscovering,
    loadFederations,
    buildProviderInviteUrl,
    navigateToManualProvider,
    filterProviders,
    getCurrentHostname
  }
}
