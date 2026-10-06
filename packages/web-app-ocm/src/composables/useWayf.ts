import { ref } from 'vue'
import { useClientService, useMessages } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import {
  WayfFederation,
  WayfProvider,
  FederationsApiResponse,
  DiscoverResponse
} from '../types/wayf'

export const useWayf = () => {
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const { $gettext } = useGettext()

  const federations = ref<WayfFederation>({})
  const isLoadingFederations = ref(false)
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
      showErrorMessage({
        title: $gettext('Error'),
        desc: $gettext('Failed to load federations'),
        errors: [error]
      })
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
      showErrorMessage({
        title: $gettext('Error'),
        desc: $gettext('Failed to discover provider'),
        errors: [error]
      })
      return null
    } finally {
      isDiscovering.value = false
    }
  }

  const navigateToProvider = (
    provider: WayfProvider,
    token: string,
    providerDomain: string
  ): void => {
    if (isSelfDomain(provider.fqdn)) {
      showErrorMessage({
        title: $gettext('Error'),
        desc: $gettext('You cannot select your own instance')
      })
      return
    }

    let targetUrl: string
    const inviteDialogPath = provider.inviteAcceptDialog || '/open-cloud-mesh/accept-invite'

    if (inviteDialogPath.startsWith('http://') || inviteDialogPath.startsWith('https://')) {
      // Absolute URL
      targetUrl = inviteDialogPath
    } else {
      // Relative path
      const cleanPath = inviteDialogPath.startsWith('/') ? inviteDialogPath : `/${inviteDialogPath}`
      targetUrl = `https://${provider.fqdn}${cleanPath}`
    }

    const url = new URL(targetUrl)
    url.searchParams.set('token', token)
    url.searchParams.set('providerDomain', providerDomain)

    window.location.href = url.toString()
  }

  const navigateToManualProvider = async (
    input: string,
    token: string,
    providerDomain: string
  ): Promise<void> => {
    const domain = stripProtocolAndPort(input)

    if (isSelfDomain(domain)) {
      showErrorMessage({
        title: $gettext('Error'),
        desc: $gettext('You cannot select your own instance')
      })
      return
    }

    const discoveryResult = await discoverProvider(domain)
    if (!discoveryResult) {
      return
    }

    const provider: WayfProvider = {
      name: domain,
      fqdn: domain,
      inviteAcceptDialog: discoveryResult.inviteAcceptDialog || ''
    }

    navigateToProvider(provider, token, providerDomain)
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
    isDiscovering,
    loadFederations,
    discoverProvider,
    navigateToProvider,
    navigateToManualProvider,
    isSelfDomain,
    filterProviders,
    getCurrentHostname
  }
}
