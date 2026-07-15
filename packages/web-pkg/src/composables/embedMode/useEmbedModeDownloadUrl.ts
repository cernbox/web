import { useClientService } from '../clientService'
import { useCapabilityStore, useUserStore } from '../piniaStores'
import { Resource, SpaceResource } from '@ownclouders/web-client'

export const useEmbedModeDownloadUrl = () => {
  const clientService = useClientService()
  const capabilityStore = useCapabilityStore()
  const userStore = useUserStore()

  // Mutates and returns the same resource - if the server already provided downloadURL,
  // it comes back completely untouched; otherwise only that one field gets filled in.
  const withDownloadUrl = async (space: SpaceResource, resource: Resource): Promise<Resource> => {
    if (resource.downloadURL || resource.isFolder || !space || !capabilityStore.supportUrlSigning) {
      return resource
    }
    try {
      resource.downloadURL = await clientService.webdav.getFileUrl(space, resource, {
        isUrlSigningEnabled: true,
        username: userStore.user?.onPremisesSamAccountName
      })
    } catch {
      // best-effort, matches EmbedActions.vue's withSignedUrls: leave downloadURL unset
      // rather than block the pick
    }
    return resource
  }

  return { withDownloadUrl }
}
