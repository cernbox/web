import { computed, ref, Ref, unref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import { DateTime, Duration } from 'luxon'
import { isSpaceResource, LinkShare, Resource, SpaceResource } from '@ownclouders/web-client'
import { SharingLinkType } from '@ownclouders/web-client/graph/generated'
import {
  FileAction,
  isLocationSharesActive,
  UpdateLinkOptions,
  useAbility,
  useCanShare,
  useCapabilityStore,
  useClientService,
  useConfigStore,
  useFileActionsCreateLink,
  useLinkTypes,
  useMessages,
  useResourcesStore,
  useRouter,
  useSharesStore
} from '@ownclouders/web-pkg'

/**
 * The public links of a resource, and what the user can do with them.
 */
export const useLinkShares = ({
  resource,
  space
}: {
  resource: Ref<Resource>
  space: Ref<SpaceResource>
}) => {
  const { sharingPublicExpireDateDefaultRWFolders, sharingPublicExpireDateMaxRWFolders } =
    useCapabilityStore()
  const { showMessage, showErrorMessage } = useMessages()
  const language = useGettext()
  const { $gettext } = language
  const router = useRouter()
  const ability = useAbility()
  const { can } = ability
  const clientService = useClientService()
  const { removeResources } = useResourcesStore()
  const { isPasswordEnforcedForLinkType } = useLinkTypes()
  const { canShare } = useCanShare()
  const { options: configOptions } = storeToRefs(useConfigStore())
  const sharesStore = useSharesStore()
  const { updateLink, deleteLink } = sharesStore
  const { linkShares } = storeToRefs(sharesStore)

  const { actions: createLinkActions } = useFileActionsCreateLink()
  const createLinkAction = computed<FileAction>(() =>
    unref(createLinkActions).find(({ name }) => name === 'create-links')
  )

  // the CERN warning about writable folder links (the alertRwFolders option), shown for a while
  const rwFolderWarning = ref<string>()

  const canCreateLinks = computed(() => {
    if (!ability.can('create-all', 'PublicLink')) {
      return false
    }
    return canShare({ space: unref(space), resource: unref(resource) })
  })

  const directLinks = computed(() =>
    unref(linkShares)
      .filter((l) => !l.indirect)
      .sort((a, b) => b.createdDateTime.localeCompare(a.createdDateTime))
      .map((share) => {
        return { ...share, key: 'direct-link-' + share.id }
      })
  )
  const indirectLinks = computed(() =>
    unref(linkShares)
      .filter((l) => l.indirect)
      .sort((a, b) => b.createdDateTime.localeCompare(a.createdDateTime))
      .map((share) => {
        return { ...share, key: 'indirect-link-' + share.id }
      })
  )

  const canDeleteReadOnlyPublicLinkPassword = computed(() =>
    can('delete-all', 'ReadOnlyPublicLinkPassword')
  )

  const canEditLink = (linkShare: LinkShare) => {
    return (
      unref(canCreateLinks) &&
      (can('create-all', 'PublicLink') || linkShare.type === SharingLinkType.Internal)
    )
  }

  const addNewLink = () => {
    const handlerArgs = { space: unref(space), resources: [unref(resource)] }
    return unref(createLinkAction)?.handler(handlerArgs)
  }

  const canDeletePublicLinkPassword = (linkShare: LinkShare) => {
    const isPasswordEnforced = isPasswordEnforcedForLinkType(linkShare.type)

    if (!isPasswordEnforced) {
      return true
    }

    return linkShare.type === SharingLinkType.View && unref(canDeleteReadOnlyPublicLinkPassword)
  }

  const handleLinkUpdate = async ({
    linkShare,
    options
  }: {
    linkShare: LinkShare
    options: UpdateLinkOptions['options']
  }) => {
    try {
      if (
        unref(resource).isFolder &&
        options.type === SharingLinkType.Edit &&
        !linkShare.expirationDateTime &&
        sharingPublicExpireDateDefaultRWFolders
      ) {
        Object.assign(options, {
          ...options,
          expirationDateTime: DateTime.now()
            .plus(sharingPublicExpireDateDefaultRWFolders)
            .endOf('day')
            .toISO()
        })
      }
      if (
        unref(resource).isFolder &&
        options.type === SharingLinkType.Edit &&
        linkShare.expirationDateTime &&
        sharingPublicExpireDateMaxRWFolders
      ) {
        if (
          DateTime.fromISO(linkShare.expirationDateTime).diff(DateTime.now(), 'days').as('days') >
          Duration.fromObject(sharingPublicExpireDateMaxRWFolders).as('days')
        ) {
          Object.assign(options, {
            ...options,
            expirationDateTime: DateTime.now()
              .plus(sharingPublicExpireDateMaxRWFolders)
              .endOf('day')
              .toISO()
          })
        }
      }
      await updateLink({
        clientService,
        space: unref(space),
        resource: unref(resource),
        linkShare,
        options
      }).then(() => {
        showMessage({ title: $gettext('Link was updated successfully') })
      })
      // the default of alertRwFolders is an empty object, so check for the message itself
      const { alertRwFolders } = unref(configOptions)
      const rwFolderMessage =
        alertRwFolders?.[language.current] ?? Object.values(alertRwFolders ?? {})[0]
      if (options.type === SharingLinkType.Edit && unref(resource).isFolder && rwFolderMessage) {
        rwFolderWarning.value = rwFolderMessage
        setTimeout(() => {
          rwFolderWarning.value = undefined
        }, 10000)
      }
    } catch (e) {
      console.error(e)
      showErrorMessage({
        title: $gettext('Failed to update link'),
        errors: [e]
      })
    }
  }

  // the share dialog asks for confirmation in the row, before it calls this
  const removeLink = async (link: LinkShare) => {
    let lastLinkId = unref(linkShares).length === 1 ? unref(linkShares)[0].id : undefined
    const loadIndicators = unref(linkShares).filter((l) => !l.indirect).length === 1

    try {
      await deleteLink({
        clientService,
        space: unref(space),
        resource: unref(resource),
        linkShare: link,
        loadIndicators
      })

      showMessage({ title: $gettext('Link was deleted successfully') })

      if (lastLinkId && isLocationSharesActive(router, 'files-shares-via-link')) {
        if (isSpaceResource(unref(resource))) {
          // spaces need their actual id instead of their share id to be removed from the file list
          lastLinkId = unref(resource).id.toString()
        }
        removeResources([{ id: lastLinkId }] as Resource[])
      }
    } catch (e) {
      console.error(e)
      showErrorMessage({
        title: $gettext('Failed to delete link'),
        errors: [e]
      })
    }
  }

  const noLinksLabel = computed(() => {
    if (isSpaceResource(unref(resource))) {
      return $gettext('This space has no public links.')
    }
    if (unref(resource).isFolder) {
      return $gettext('This folder has no public link.')
    }
    return $gettext('This file has no public link.')
  })

  return {
    linkShares,
    rwFolderWarning,
    directLinks,
    indirectLinks,
    canCreateLinks,
    canEditLink,
    addNewLink,
    canDeletePublicLinkPassword,
    isPasswordEnforcedForLinkType,
    handleLinkUpdate,
    removeLink,
    noLinksLabel
  }
}
