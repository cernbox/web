import { computed, Ref, ref, unref, watch } from 'vue'
import {
  isFallbackSpaceResource,
  isPersonalSpaceResource,
  isProjectSpaceResource,
  isSegmentPrefix,
  SHARE_JAIL_ID,
  SpaceResource
} from '@ownclouders/web-client'
import { useRouteQuery } from '../router'
import { useSpacesLoading } from './useSpacesLoading'
import { queryItemAsString } from '../appDefaults'
import { urlJoin } from '@ownclouders/web-client'
import { useClientService } from '../clientService'
import { useSpacesStore, useConfigStore } from '../piniaStores'
import { onUnmounted } from 'vue'

interface DriveResolverOptions {
  driveAliasAndItem?: Ref<string>
}

interface DriveResolverResult {
  space: Ref<SpaceResource>
  item: Ref<string>
  itemId: Ref<string>
  loading: Ref<boolean>
}

export const useDriveResolver = (options: DriveResolverOptions = {}): DriveResolverResult => {
  const spacesStore = useSpacesStore()
  const { areSpacesLoading } = useSpacesLoading()
  const shareId = useRouteQuery('shareId')
  const fileIdQueryItem = useRouteQuery('fileId')
  const fileId = computed(() => {
    return queryItemAsString(unref(fileIdQueryItem))
  })
  const configStore = useConfigStore()

  const clientService = useClientService()
  const spaces = computed(() => spacesStore.spaces)
  const space = ref<SpaceResource>(null)
  const item: Ref<string> = ref(null)
  const loading = ref(false)

  const getSpaceByDriveAliasAndItem = (
    driveAliasAndItem: string,
    { includeFallback = true }: { includeFallback?: boolean } = {}
  ): SpaceResource => {
    return unref(spaces).reduce<SpaceResource>((mostSpecific, space) => {
      if (!includeFallback && isFallbackSpaceResource(space)) {
        return mostSpecific
      }
      if (!isSegmentPrefix(driveAliasAndItem, space.driveAlias)) {
        return mostSpecific
      }
      // all matching aliases are segment prefixes of the same string and are therefore totally
      // ordered by length: the longest one is the most specific. This is what makes a real space
      // (`eos/project/c/cernbox`) win over the catch-all fallback (`eos`), independent of the
      // order spaces happen to have been loaded in. `>=` keeps the first of two identical
      // aliases, preserving the previous `.find()` semantics for duplicates.
      if (mostSpecific && mostSpecific.driveAlias.length >= space.driveAlias.length) {
        return mostSpecific
      }
      return space
    }, null)
  }

  // clean up global state as the watchers aren't triggered anymore when navigating away.
  // keep it set for personal/project spaces so leaving to e.g. an editor app and back
  // doesn't transiently drop currentSpace (driveAlias may not be 'personal/'/'project/'
  // prefixed, e.g. eos-backed spaces use 'eos/user/...' / 'eos/project/...')
  onUnmounted(() => {
    const currentSpace = unref(space)
    if (
      !isPersonalSpaceResource(currentSpace) &&
      !isProjectSpaceResource(currentSpace) &&
      !isFallbackSpaceResource(currentSpace)
    ) {
      spacesStore.setCurrentSpace(null)
    }
  })

  watch(
    [options.driveAliasAndItem, areSpacesLoading],
    async ([driveAliasAndItem, areSpacesLoading], [driveAliasAndItemOld, areSpacesLoadingOld]) => {
      if (driveAliasAndItem === driveAliasAndItemOld && areSpacesLoading === areSpacesLoadingOld) {
        return
      }

      if (!driveAliasAndItem || driveAliasAndItem.startsWith('virtual/')) {
        space.value = null
        item.value = null
        return
      }

      const resolvedSpace = unref(space)
      // never latch onto the fallback: a deeper path may be covered by a real space that we
      // either already hold or can still lazily load, so always re-resolve. For real spaces the
      // shortcut is kept, but segment-aware: `eos/project/c/cern` must not swallow
      // `eos/project/c/cernbox/x` (which would yield item `box/x` on the wrong space).
      const isOnlyItemPathChanged =
        !!resolvedSpace &&
        !isFallbackSpaceResource(resolvedSpace) &&
        isSegmentPrefix(driveAliasAndItem, resolvedSpace.driveAlias)
      if (isOnlyItemPathChanged) {
        item.value = urlJoin(driveAliasAndItem.slice(resolvedSpace.driveAlias.length), {
          leadingSlash: true
        })
        return
      }

      let matchingSpace = null
      let path = null
      if (driveAliasAndItem.startsWith('public/') || driveAliasAndItem.startsWith('ocm/')) {
        const [publicLinkToken, ...item] = driveAliasAndItem.split('/').slice(1)
        matchingSpace = unref(spaces).find((s) => s.id === publicLinkToken)
        path = item.join('/')
      } else if (
        driveAliasAndItem.startsWith('share/') ||
        driveAliasAndItem.startsWith('ocm-share/')
      ) {
        const [shareName, ...item] = driveAliasAndItem.split('/').slice(1)
        const driveAliasPrefix = driveAliasAndItem.startsWith('ocm-share/') ? 'ocm-share' : 'share'

        let shareIdStr = queryItemAsString(unref(shareId))
        // keep compatibility with old share jail ids pre sharing NG
        if (shareIdStr?.includes(':')) {
          shareIdStr = [SHARE_JAIL_ID, shareIdStr].join('!')
        }

        matchingSpace =
          spacesStore.getSpace(shareIdStr) ||
          spacesStore.createShareSpace({
            driveAliasPrefix,
            id: shareIdStr,
            shareName: unref(shareName)
          })

        path = item.join('/')
      } else {
        if (unref(fileId)) {
          matchingSpace = unref(spaces).find((s) => {
            return unref(fileId).startsWith(`${s.fileId}`)
          })
        }

        // 1. real spaces we already know about
        if (!matchingSpace) {
          matchingSpace = getSpaceByDriveAliasAndItem(driveAliasAndItem, { includeFallback: false })
        }

        // 2. the location may live in a received share whose owner-path root space hasn't been
        //    fetched yet. Fetching mount points is expensive, so only once per session and only
        //    when it can actually produce a matching driveAlias.
        if (
          !matchingSpace &&
          !spacesStore.mountPointsInitialized &&
          configStore.options.routing.fullShareOwnerPaths
        ) {
          loading.value = true
          await spacesStore.loadMountPoints({ graphClient: clientService.graphAuthenticated })
          matchingSpace = getSpaceByDriveAliasAndItem(driveAliasAndItem, { includeFallback: false })
        }

        // 3. last resort: the synthetic catch-all space, if this deployment has one
        if (!matchingSpace) {
          matchingSpace = getSpaceByDriveAliasAndItem(driveAliasAndItem)
        }

        if (matchingSpace) {
          path = driveAliasAndItem.slice(matchingSpace.driveAlias.length)
        }
      }
      space.value = matchingSpace
      item.value = urlJoin(path, {
        leadingSlash: true
      })
      loading.value = false
    },
    { immediate: true, deep: true }
  )
  watch(
    space,
    (s: SpaceResource) => {
      spacesStore.setCurrentSpace(s)
    },
    { immediate: true }
  )
  return {
    space,
    item,
    itemId: fileId,
    loading
  }
}
