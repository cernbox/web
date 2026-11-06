import { Resource, getFavoritesFileIds } from '@ownclouders/web-client'
import { ClientService, SpacesStore } from '@ownclouders/web-pkg'

/**
 * The graph APIs that list shares don't return any favorite attribute, so it has to be set again.
 */
export function* markFavorites(
  resources: Resource[],
  clientService: ClientService,
  spacesStore: SpacesStore,
  signal?: AbortSignal
) {
  try {
    const favorites = yield clientService.webdav.listFavoriteFiles({
      spaceID: spacesStore.personalSpace.id,
      signal
    })
    const favoriteIds = getFavoritesFileIds(favorites.results)
    resources.forEach((resource) => {
      resource.starred = favoriteIds.has(resource.fileId)
    })
  } catch (e) {
    console.error('failed to load favorites', e)
  }
}
