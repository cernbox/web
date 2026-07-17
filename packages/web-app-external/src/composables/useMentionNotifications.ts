import { computed, ref, unref } from 'vue'
import { call, GraphSharePermission, urlJoin } from '@ownclouders/web-client'
import type { User } from '@ownclouders/web-client/graph/generated'
import {
  useClientService,
  useCapabilityStore,
  useConfigStore,
  useMessages,
  useRequest,
  useSharesStore,
  useUserStore
} from '@ownclouders/web-pkg'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import { useTask } from 'vue-concurrency'
import { v4 as uuidV4 } from 'uuid'
import type { OfficePostMessageContext } from './postMessages/types'

export interface MentionCandidate {
  username: string
  profile: string
  label: string
}

/**
 * Shared, app-agnostic "notify a mentioned user" behavior - implemented once here,
 * translated to/from each app's own postMessage protocol by its dedicated composable.
 */
export function useMentionNotifications(ctx: OfficePostMessageContext) {
  const { space, resource } = ctx
  const clientService = useClientService()
  const { graphAuthenticated } = clientService
  const configStore = useConfigStore()
  const capabilityStore = useCapabilityStore()
  const userStore = useUserStore()
  const sharesStore = useSharesStore()
  const { collaboratorShares } = storeToRefs(sharesStore)
  const { makeRequest } = useRequest({ clientService })
  const { showMessage } = useMessages()
  const { $gettext } = useGettext()

  const userIdsToMention = ref<string[]>([])
  const hasPendingMentions = computed(() => unref(userIdsToMention).length > 0)
  // Last search results, keyed by id: Collabora only echoes back the username (our
  // candidate id) when a mention is selected, not the full candidate, so this is
  // needed to recover the display name for error messages when granting access below.
  const lastSearchResults = ref(new Map<string, MentionCandidate>())

  const defaultShareRoleId = ref<string>()
  const defaultShareRoleFetched = ref(false)

  const loadDefaultShareRoleId = async (): Promise<string | undefined> => {
    if (unref(defaultShareRoleFetched)) {
      return unref(defaultShareRoleId)
    }

    const currentSpace = unref(space)
    const currentResource = unref(resource)
    const { allowedRoles } = await graphAuthenticated.permissions.listPermissions(
      currentSpace.id,
      currentResource.fileId,
      sharesStore.graphRoles,
      {},
      {}
    )

    // prefer a role that can actually edit the file (GraphSharePermission.createUpload is
    // present on every "Can edit" role variant and no "Can view" one - see
    // packages/web-client/src/helpers/share/functions.ts for the same permission-membership
    // idiom) - a mentioned user should be able to act on what they were mentioned about.
    // Falls back to allowedRoles[0] (the invite dialog's own weakest-first convention, see
    // InviteCollaboratorForm.vue's setInitialSelectedRole) if no editor-capable role exists.
    const editorRole = allowedRoles?.find(
      (role) =>
        Array.isArray(role.rolePermissions) &&
        role.rolePermissions.some((permission) =>
          permission.allowedResourceActions?.includes(GraphSharePermission.createUpload)
        )
    )
    defaultShareRoleId.value = editorRole?.id || allowedRoles?.[0]?.id
    defaultShareRoleFetched.value = true
    return unref(defaultShareRoleId)
  }

  /**
   * "Name Surname (username)" rather than just the display name - office apps (e.g.
   * Collabora) re-match the typed query against the label they were given, so if someone
   * searches by login/username, a label containing only the display name won't contain
   * what was typed and the entry won't show up as a match.
   */
  const buildMentionLabel = (user: User): string => {
    const name = user.displayName || user.id
    return user.onPremisesSamAccountName ? `${name} (${user.onPremisesSamAccountName})` : name
  }

  /**
   * Searches all users, the same call the "invite people" dialog makes
   * (InviteCollaboratorForm.vue's fetchRecipientsTask) - not just existing collaborators,
   * so a mention can invite someone new. Deliberately scoped to individual users only
   * (no groups): a @mention notifies one specific person, unlike a group share.
   *
   * CERN: the default search only covers primary (personal) accounts - service and
   * secondary accounts aren't included unless explicitly filtered for, same as
   * InviteCollaboratorForm.vue's per-role-type filters. The graph API's $filter doesn't
   * support "or", so those two account types need separate calls; only issued when the
   * default search comes up empty, to avoid the extra round-trips on the common case.
   */
  // restartable: Collabora fires a fresh autocomplete search on every keystroke, so an
  // in-flight request from an earlier (now-stale) keystroke must be cancelled rather than
  // left to race a newer one and potentially overwrite it - same signal-cancellation pattern
  // as InviteCollaboratorForm.vue's fetchRecipientsTask.
  const resolveMentionCandidatesTask = useTask(function* (signal, searchText: string) {
    const currentResource = unref(resource)
    const users = yield* call(
      graphAuthenticated.users.listUsers(
        { orderBy: ['displayName'], search: `"${searchText}"`, filter: `userType eq 'all'` },
        { signal }
      )
    )

    const candidates = (users || [])
      .filter((user) => user.id !== userStore.user.id)
      .map((user) => ({
        username: user.id,
        // office apps expect a profile URL; we don't have a dedicated one, so link to the document
        profile: currentResource.privateLink,
        label: buildMentionLabel(user)
      }))

    lastSearchResults.value = new Map(
      candidates.map((candidate) => [candidate.username, candidate])
    )
    return candidates
  }).restartable()

  const resolveMentionCandidates = async (searchText: string): Promise<MentionCandidate[]> => {
    if (searchText.length < capabilityStore.sharingSearchMinLength) {
      return []
    }

    try {
      return (await resolveMentionCandidatesTask.perform(searchText)) || []
    } catch {
      // a newer keystroke restarted the task and cancelled this one - its result is stale,
      // the newer perform() call (already in flight) will produce the real answer
      return []
    }
  }

  /**
   * Called when the user picks a candidate from the mention autocomplete (not for every
   * candidate merely shown - only the one actually selected). Just records the pick -
   * access is only granted once the comment is actually finished, see grantAccessIfNeeded
   * below, since picking someone from the list while still typing shouldn't share the
   * document with them if the comment never gets posted.
   */
  const queueMention = (userId: string): void => {
    if (!unref(userIdsToMention).includes(userId)) {
      userIdsToMention.value.push(userId)
    }
  }

  /**
   * Grants a mentioned user access if they don't already have it, since a mention without
   * access would notify someone who can't open the document. Defaults to the weakest role
   * the backend allows for this resource (allowedRoles[0], same convention
   * InviteCollaboratorForm.vue's setInitialSelectedRole relies on: allowedRoles is returned
   * weakest-first). Only called from notifyMentionedUsers, i.e. once the comment is
   * finished - not on every autocomplete pick. Best-effort: mentioning someone should not
   * fail if sharing does - errors are logged and swallowed.
   */
  const grantAccessIfNeeded = async (userId: string): Promise<void> => {
    const alreadyHasAccess = unref(collaboratorShares).some(
      (share) => !share.indirect && share.sharedWith?.id === userId
    )
    if (alreadyHasAccess) {
      return
    }

    const label = unref(lastSearchResults).get(userId)?.label || userId
    try {
      const roleId = await loadDefaultShareRoleId()
      if (!roleId) {
        return
      }

      await sharesStore.addShare({
        clientService,
        space: unref(space),
        resource: unref(resource),
        options: {
          roles: [roleId],
          recipients: [{ objectId: userId, '@libre.graph.recipient.type': 'user' }]
        }
      })

      showMessage({ title: $gettext('Document shared with %{name}', { name: label }) })
    } catch (e) {
      console.error(`Error granting access to mentioned user "${label}"`, e)
    }
  }

  /**
   * POST {configStore.serverUrl}/app/mentions
   *
   * Notifies users that they were @-mentioned in a document, once the comment mentioning
   * them is actually finished (see the Doc_ModifiedStatus/UI_Close call sites in
   * useCollaboraPostMessages.ts) - not on every autocomplete pick. Also grants each
   * mentioned user access at this point, via grantAccessIfNeeded, for the same reason:
   * a comment that never gets saved shouldn't have shared the document.
   *
   * Request body (JSON):
   *   {
   *     "file_id": string,                                  // resource.fileId
   *     "mentions": { type: 'user', username: string }[],    // only user mentions - a
   *                                                           // Collabora @mention always
   *                                                           // targets one specific person
   *     "event_id": string,                                  // unique id for this flush
   *     "comment_text": string,                               // not exposed by Collabora's
   *     "anchor_text": string,                                // UI_Mention postMessage today
   *     "document_url": string,                              // resource.privateLink
   *     "app_name": "office"
   *   }
   *
   * Response: 202 Accepted, { accepted: [...], rejected: [...] } per-mention results.
   */
  const notifyMentionedUsers = async (): Promise<void> => {
    if (!unref(userIdsToMention).length) {
      return
    }

    const currentResource = unref(resource)
    const userIDs = unref(userIdsToMention).splice(0)
    await Promise.all(userIDs.map(grantAccessIfNeeded))

    try {
      const response = await makeRequest('POST', urlJoin(configStore.serverUrl, 'app/mentions'), {
        data: {
          file_id: currentResource.fileId,
          mentions: userIDs.map((username) => ({ type: 'user' as const, username })),
          event_id: uuidV4(),
          comment_text: '',
          anchor_text: '',
          document_url: currentResource.privateLink || '',
          app_name: 'office'
        }
      })
      const rejected = response?.data?.rejected
      if (rejected?.length) {
        console.warn('Some @mentions were rejected by the collaboration service', rejected)
      }
    } catch (e) {
      console.error('Error notifying mentioned users', e)
    }
  }

  const resetMentionState = (): void => {
    lastSearchResults.value = new Map()
    defaultShareRoleId.value = undefined
    defaultShareRoleFetched.value = false
  }

  return {
    resolveMentionCandidates,
    queueMention,
    notifyMentionedUsers,
    resetMentionState,
    hasPendingMentions
  }
}
