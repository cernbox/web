import { useRouteParam } from '../router'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  MountPointSpaceResource,
  extractStorageId,
  isFallbackSpaceResource,
  isMountPointSpaceResource,
  isSegmentPrefix,
  ShareTypes,
  OCM_PROVIDER_ID,
  isShareResource
} from '@ownclouders/web-client'
import { computed, Ref, unref } from 'vue'
import { basename } from 'path'
import { useSpacesStore, useUserStore, useConfigStore } from '../piniaStores'

type GetMatchingSpaceOptions = {
  space?: Ref<SpaceResource>
}

export const useGetMatchingSpace = (options?: GetMatchingSpaceOptions) => {
  const userStore = useUserStore()
  const spacesStore = useSpacesStore()
  const configStore = useConfigStore()
  const spaces = computed(() => spacesStore.spaces)
  const driveAliasAndItem = useRouteParam('driveAliasAndItem')

  const getInternalSpace = (storageId: string): SpaceResource => {
    return unref(options?.space) || unref(spaces).find((space) => space.id === storageId)
  }

  /**
   * The fallback space is synthetic: resources reached through it report their *real* storage id
   * (which never matches the fallback's own, made-up id), while their `path` is relative to the
   * fallback's webdav root. Resolving them by storage id would therefore produce a path relative
   * to the wrong root (`/spaces/<projectId>/project/c/foo/bar.txt`). Detect them by their webdav
   * path rather than by the ambient `currentSpace`, so that resources which merely happen to be
   * resolved while a fallback route is open - clipboard entries, file-picker results, search hits
   * - still resolve to the space they actually came from.
   */
  const getListingFallbackSpace = (resource: Resource): SpaceResource => {
    const fallbackSpace = unref(spaces).find(isFallbackSpaceResource)
    return fallbackSpace && isSegmentPrefix(resource?.webDavPath, fallbackSpace.webDavPath)
      ? fallbackSpace
      : null
  }

  const getMatchingSpace = (resource: Resource): SpaceResource => {
    const fallbackSpace = getListingFallbackSpace(resource)
    if (!unref(options?.space) && fallbackSpace) {
      return fallbackSpace
    }

    let storageId = resource.spaceId || resource.storageId

    if (
      unref(driveAliasAndItem)?.startsWith('public/') ||
      unref(driveAliasAndItem)?.startsWith('ocm/')
    ) {
      storageId = unref(driveAliasAndItem).split('/')[1]
    }

    const space = getInternalSpace(storageId)

    if (space && !isMountPointSpaceResource(space)) {
      return space
    }

    const driveAliasPrefix =
      (isShareResource(resource) && resource.shareTypes.includes(ShareTypes.remote.value)) ||
      resource?.id?.toString().startsWith(OCM_PROVIDER_ID)
        ? 'ocm-share'
        : 'share'

    let shareName: string
    if (resource.remoteItemPath) {
      shareName = basename(resource.remoteItemPath)
    } else if (
      unref(driveAliasAndItem)?.startsWith('share/') ||
      unref(driveAliasAndItem)?.startsWith('ocm-share/')
    ) {
      shareName = unref(driveAliasAndItem).split('/')[1]
    } else {
      shareName = resource.name
    }

    return (
      spacesStore.getSpace(resource.remoteItemId) ||
      spacesStore.createShareSpace({
        driveAliasPrefix,
        id: resource.remoteItemId,
        shareName
      })
    )
  }

  const getMatchingMountPoints = (space: SpaceResource): MountPointSpaceResource[] =>
    unref(spaces).filter(
      (s) => isMountPointSpaceResource(s) && extractStorageId(s.root.remoteItem.rootId) === space.id
    )

  const isPersonalSpaceRoot = (resource: Resource) => {
    return (
      resource?.storageId &&
      resource?.storageId === spacesStore.personalSpace?.storageId &&
      resource?.path === '/'
    )
  }

  const isResourceAccessible = ({ space, path }: { space: SpaceResource; path: string }) => {
    return true
    // if (!configStore.options.routing.fullShareOwnerPaths) {
    //   return true
    // }

    // const projectSpace = unref(spaces).find((s) => isProjectSpaceResource(s) && s.id === space.id)
    // const fullyAccessibleSpace =
    //   space.isOwner(userStore.user) || projectSpace?.isMember(userStore.user)

    // return (
    //   fullyAccessibleSpace ||
    //   getMatchingMountPoints(space).some((m) => path.startsWith(m.root.remoteItem.path))
    // )
  }

  return {
    getInternalSpace,
    getMatchingSpace,
    isPersonalSpaceRoot,
    isResourceAccessible
  }
}
