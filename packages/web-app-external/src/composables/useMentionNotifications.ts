import { computed, ref, unref } from 'vue'
import { call, GraphSharePermission, isShareSpaceResource, urlJoin } from '@ownclouders/web-client'
import type { User } from '@ownclouders/web-client/graph/generated'
import {
  useClientService,
  useCapabilityStore,
  useConfigStore,
  useMessages,
  useRequest,
  useSharesStore,
  useSpacesStore,
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
 * The same search results in the shape EuroOffice wants for
 * setUsers. They key mentions on the email address rather than on an opaque id - the editor
 * literally writes "+<email>" into the comment text and parses the addresses back out of it
 * (see Comments.js' pickEMail in Euro-Office/web-apps) - so a user without a mail address
 * can't be mentioned there at all, unlike in Collabora.
 */
export interface MentionUser {
  id: string
  name: string
  email: string
  // users who can already open the file are listed above a separator in the editor's dropdown
  hasAccess: boolean
}

export interface MentionNotificationDetails {
  // the comment the mention was written in, when the editor exposes it
  commentText?: string
  // deep link to the mention, when the editor can produce one; defaults to resource.privateLink
  documentUrl?: string
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
  const spacesStore = useSpacesStore()
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
  // Every user seen in a search this session, keyed by lowercased email: EuroOffice reports
  // its mentions as email addresses, and only once the comment is submitted, so unlike
  // lastSearchResults this has to survive the searches that happened in between.
  const userIdsByEmail = ref(new Map<string, string>())

  const defaultShareRoleId = ref<string>()
  const defaultShareRoleFetched = ref(false)

  /**
   * The drive that actually owns the permissions. For a resource shared with us the space is
   * a share-jail entry whose id is not a real drive id, so listPermissions has to be pointed
   * at the mount point's remote root instead - the same resolution FileSideBar.vue does
   * before its own listPermissions call. Without it, mentioning someone in a document that
   * was shared with you finds no roles and silently grants nothing.
   */
  const resolveDriveId = async (): Promise<string> => {
    const currentSpace = unref(space)
    if (!isShareSpaceResource(currentSpace)) {
      return currentSpace.id
    }

    const mountPoint = await spacesStore.getMountPointForSpace({
      graphClient: graphAuthenticated,
      space: currentSpace
    })
    return mountPoint?.root?.remoteItem?.rootId || currentSpace.id
  }

  const loadDefaultShareRoleId = async (): Promise<string | undefined> => {
    if (unref(defaultShareRoleFetched)) {
      return unref(defaultShareRoleId)
    }

    const currentResource = unref(resource)
    const { allowedRoles } = await graphAuthenticated.permissions.listPermissions(
      await resolveDriveId(),
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
   * Searches every user, not just existing collaborators, so a mention can invite someone
   * new. Deliberately scoped to individual users only (no groups): a @mention notifies one
   * specific person, unlike a group share.
   *
   * CERN: `userType eq 'all'` covers primary, secondary and service accounts in one call.
   * The invite dialog instead issues one call per type, because the graph $filter has no
   * "or" - unnecessary here. Note this needs a reva new enough to know the 'all' user type;
   * older ones reject the request with `unknown usertype: all`.
   */
  const findUsers = (searchText: string, signal?: AbortSignal): Promise<User[]> =>
    graphAuthenticated.users.listUsers(
      { orderBy: ['displayName'], search: `"${searchText}"`, filter: `userType eq 'all'` },
      { signal }
    )

  // restartable: Collabora fires a fresh autocomplete search on every keystroke, so an
  // in-flight request from an earlier (now-stale) keystroke must be cancelled rather than
  // left to race a newer one and potentially overwrite it - same signal-cancellation pattern
  // as InviteCollaboratorForm.vue's fetchRecipientsTask.
  const searchUsersTask = useTask(function* (signal, searchText: string) {
    const users = yield* call(findUsers(searchText, signal))
    return (users || []).filter((user) => user.id !== userStore.user.id)
  }).restartable()

  /**
   * Returns null - not an empty list - when no search actually ran, so callers can tell
   * "nobody matched" from "we never asked" and leave their remembered results alone.
   */
  const searchUsers = async (searchText: string): Promise<User[] | null> => {
    if (searchText.length < capabilityStore.sharingSearchMinLength) {
      return null
    }

    try {
      return (await searchUsersTask.perform(searchText)) || []
    } catch {
      // a newer keystroke restarted the task and cancelled this one - its result is stale,
      // the newer perform() call (already in flight) will produce the real answer
      return null
    }
  }

  const toMentionCandidate = (user: User): MentionCandidate => ({
    username: user.id,
    // office apps expect a profile URL; we don't have a dedicated one, so link to the document
    profile: unref(resource).privateLink,
    label: buildMentionLabel(user)
  })

  const rememberSearchResults = (users: User[]): void => {
    lastSearchResults.value = new Map(users.map((user) => [user.id, toMentionCandidate(user)]))
    // accumulated across searches, unlike lastSearchResults: EuroOffice only reports which
    // users were mentioned once the comment is submitted, by which point the search that
    // produced them can be many keystrokes old
    users.forEach((user) => {
      if (user.mail) {
        unref(userIdsByEmail).set(user.mail.toLowerCase(), user.id)
      }
    })
  }

  /** Mention candidates in the shape Collabora's Action_Mention wants. */
  const resolveMentionCandidates = async (searchText: string): Promise<MentionCandidate[]> => {
    const users = await searchUsers(searchText)
    if (!users) {
      return []
    }

    rememberSearchResults(users)
    return users.map(toMentionCandidate)
  }

  /**
   * Whether the user can already open the document. Broader than the check in
   * grantAccessIfNeeded, which deliberately ignores indirect shares because it decides
   * whether to create a *direct* one; here it only drives where the editor draws the
   * separator in its mention dropdown, and inherited access counts just as well.
   */
  const hasAccessToResource = (userId: string): boolean =>
    unref(collaboratorShares).some((share) => share.sharedWith?.id === userId)

  /**
   * Same search as resolveMentionCandidates, in the shape EuroOffice's setUsers wants.
   * Users without a mail address are dropped: the editor writes "+<email>" into the comment
   * and parses the addresses back out, so it has no way to refer to them.
   */
  const resolveMentionUsers = async (searchText: string): Promise<MentionUser[]> => {
    const users = await searchUsers(searchText)
    if (!users) {
      return []
    }

    rememberSearchResults(users)
    return users
      .filter((user): user is User & { mail: string } => !!user.mail)
      .map((user) => ({
        id: user.id,
        name: buildMentionLabel(user),
        email: user.mail,
        hasAccess: hasAccessToResource(user.id)
      }))
  }

  /**
   * Maps the email addresses EuroOffice reports back to user ids for notifyMentionedUsers.
   * Addresses picked from the autocomplete are already known; one typed by hand never went
   * through a search, hence the lookup fallback.
   */
  const resolveUserIdsForEmails = async (emails: string[]): Promise<string[]> => {
    const userIds: string[] = []

    for (const email of emails) {
      const normalizedEmail = email.toLowerCase()
      const knownUserId = unref(userIdsByEmail).get(normalizedEmail)
      if (knownUserId) {
        userIds.push(knownUserId)
        continue
      }

      try {
        // deliberately not searchUsersTask: it is restartable, so this lookup and an
        // autocomplete search running at the same time would cancel each other
        const users = await findUsers(email)
        const match = (users || []).find((user) => user.mail?.toLowerCase() === normalizedEmail)
        if (match) {
          unref(userIdsByEmail).set(normalizedEmail, match.id)
          userIds.push(match.id)
        }
      } catch (e) {
        console.error(`Error resolving mentioned user "${email}"`, e)
      }
    }

    return userIds
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
   *     "comment_text": string,                              // details.commentText - not
   *                                                          // exposed by Collabora's
   *     "anchor_text": string,                               // UI_Mention postMessage today
   *     "document_url": string,                              // details.documentUrl, else
   *                                                          // resource.privateLink
   *     "app_name": "office"
   *   }
   *
   * Response: 202 Accepted, { accepted: [...], rejected: [...] } per-mention results.
   */
  const notifyMentionedUsers = async (details: MentionNotificationDetails = {}): Promise<void> => {
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
          comment_text: details.commentText || '',
          anchor_text: '',
          document_url: details.documentUrl || currentResource.privateLink || '',
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
    userIdsByEmail.value = new Map()
    defaultShareRoleId.value = undefined
    defaultShareRoleFetched.value = false
  }

  return {
    resolveMentionCandidates,
    resolveMentionUsers,
    resolveUserIdsForEmails,
    queueMention,
    notifyMentionedUsers,
    resetMentionState,
    hasPendingMentions
  }
}
