import { computed, Ref, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import {
  CollaboratorShare,
  isProjectSpaceResource,
  isShareSpaceResource,
  isSharingHierarchyConflictUserAbortError,
  Resource,
  ShareTypes,
  SpaceResource
} from '@ownclouders/web-client'
import {
  getSharedAncestorRoute,
  isLocationSharesActive,
  useClientService,
  useGetMatchingSpace,
  useMessages,
  useResourcesStore,
  useRouter,
  useSharesStore,
  useSharingHierarchyConflictConfirm,
  useSharingHierarchyConflictInform,
  useUserStore
} from '@ownclouders/web-pkg'
import { textUtils } from '../../helpers/textUtils'

/**
 * The people a resource is shared with, and what the user can do with each share.
 */
export const useCollaboratorShares = ({
  resource,
  space
}: {
  resource: Ref<Resource>
  space: Ref<SpaceResource>
}) => {
  const { $gettext } = useGettext()
  const router = useRouter()
  const clientService = useClientService()
  const { showMessage, showErrorMessage } = useMessages()
  const { getMatchingSpace } = useGetMatchingSpace()
  const { user } = storeToRefs(useUserStore())
  const { removeResources, getAncestorById } = useResourcesStore()
  const sharesStore = useSharesStore()
  const confirmSharingHierarchyConflict = useSharingHierarchyConflictConfirm()
  const informSharingHierarchyConflict = useSharingHierarchyConflictInform()

  const collaboratorShares = computed(() => {
    if (isProjectSpaceResource(unref(space))) {
      // filter out project space members, they are listed separately
      return sharesStore.collaboratorShares.filter((c) => c.resourceId !== unref(space).id)
    }
    return sharesStore.collaboratorShares
  })

  const collaborators = computed(() => {
    const collaboratorsComparator = (c1: CollaboratorShare, c2: CollaboratorShare) => {
      // Sorted by: type, direct, display name, creation date
      const name1 = c1.sharedWith.displayName.toLowerCase().trim()
      const name2 = c2.sharedWith.displayName.toLowerCase().trim()
      const c1UserShare = ShareTypes.containsAnyValue(ShareTypes.individuals, [c1.shareType])
      const c2UserShare = ShareTypes.containsAnyValue(ShareTypes.individuals, [c2.shareType])
      const c1DirectShare = !c1.indirect
      const c2DirectShare = !c2.indirect

      if (c1UserShare === c2UserShare) {
        if (c1DirectShare === c2DirectShare) {
          return textUtils.naturalSortCompare(name1, name2)
        }

        return c1DirectShare ? -1 : 1
      }

      return c1UserShare ? -1 : 1
    }

    return unref(collaboratorShares).sort(collaboratorsComparator)
  })

  const isShareModifiable = (collaborator: CollaboratorShare) => {
    if (collaborator.indirect) {
      return false
    }

    // users should not be able to add/edit themselves
    if (collaborator.sharedWith.id === unref(user).id) {
      return false
    }

    if (isProjectSpaceResource(unref(space)) || isShareSpaceResource(unref(space))) {
      return unref(space).canShare({ user: unref(user) })
    }

    return true
  }

  const getSharedParentRoute = (collaborator: CollaboratorShare) => {
    if (!collaborator.indirect) {
      return null
    }
    const sharedAncestor = getAncestorById(collaborator.resourceId)
    if (!sharedAncestor) {
      return null
    }

    return getSharedAncestorRoute({
      sharedAncestor,
      matchingSpace: unref(space) || getMatchingSpace(unref(resource))
    })
  }

  // the share dialog asks for confirmation in the row, before it calls this
  const removeShare = async (collaboratorShare: CollaboratorShare) => {
    const lastShareId = unref(collaborators).length === 1 ? unref(collaborators)[0].id : undefined
    const loadIndicators = unref(collaborators).filter((c) => !c.indirect).length === 1

    try {
      await sharesStore.deleteShare({
        clientService,
        space: unref(space),
        resource: unref(resource),
        collaboratorShare,
        loadIndicators,
        confirmSharingHierarchyConflict,
        informSharingHierarchyConflict
      })

      showMessage({
        title: $gettext('Share was removed successfully')
      })
      if (lastShareId && isLocationSharesActive(router, 'files-shares-with-others')) {
        removeResources([{ id: lastShareId }] as Resource[])
      }
    } catch (error) {
      if (isSharingHierarchyConflictUserAbortError(error)) {
        return
      }
      console.error(error)
      showErrorMessage({
        title: $gettext('Failed to remove share'),
        errors: [error]
      })
    }
  }

  return { collaborators, isShareModifiable, getSharedParentRoute, removeShare }
}
