import { ref, unref } from 'vue'
import { useShareDialog } from '../useShareDialog'
import { postMessageToIframe } from './postMessageToIframe'
import { useMentionNotifications } from '../useMentionNotifications'
import { useOfficeFileOperations } from '../useOfficeFileOperations'
import type {
  OfficePostMessage,
  OfficePostMessageContext,
  OfficePostMessageRegistration
} from './types'

/**
 * EuroOffice's actionLink: an anchor into the document - a comment id or a bookmark name.
 * The editor produces one for every mention notification and for "copy link", and consumes
 * one via editorConfig.actionLink when the document is opened, which is how a link of ours
 * scrolls to the right comment. editor-wopi.ejs reads it off the `actionlink` query param.
 */
interface ActionLink {
  action?: { type?: string; data?: string }
}

const buildActionLinkUrl = (documentUrl: string, actionLink: ActionLink): string => {
  if (!documentUrl || !actionLink) {
    return documentUrl
  }

  try {
    const url = new URL(documentUrl)
    url.searchParams.set('actionLink', JSON.stringify(actionLink))
    return url.toString()
  } catch {
    // privateLink isn't guaranteed to be absolute; a plain document link still opens the
    // right file, it just won't scroll to the anchor
    return documentUrl
  }
}

export function useEuroOfficePostMessages(
  ctx: OfficePostMessageContext
): OfficePostMessageRegistration {
  const { space, resource, appIframeRef } = ctx
  const { openShareDialog } = useShareDialog()
  const { insertGraphic } = useOfficeFileOperations(ctx)
  const {
    resolveMentionUsers,
    resolveUserIdsForEmails,
    queueMention,
    notifyMentionedUsers,
    resetMentionState,
    hasPendingMentions
  } = useMentionNotifications(ctx)

  const isLoaded = ref(false)

  const handleAppLoadingStatus = (): void => {
    isLoaded.value = true
    postMessageToIframe(appIframeRef, 'Host_PostmessageReady')
  }

  const handleUiSharing = (): void => {
    openShareDialog(unref(space), unref(resource))
  }

  const handleUiInsertGraphic = async (): Promise<void> => {
    await insertGraphic({
      onPicked: (url) => {
        postMessageToIframe(appIframeRef, 'Action_InsertGraphic', { url })
      }
    })
  }

  /**
   * The mention autocomplete asking who could be mentioned, filtered by `search`.
   *
   * Everything except `c: 'info'` takes an in-flight lock in Common.UI.ExternalUsers, which
   * drops any further request until it's released - so those MUST be answered, an empty list
   * included, or the mention dropdown stays wedged for the rest of the session.
   */
  const handleRequestUsers = async (message: OfficePostMessage): Promise<void> => {
    const operation = (message.Values?.c as string) || 'mention'
    const respond = (users: unknown[], values: Record<string, unknown> = {}) => {
      postMessageToIframe(appIframeRef, 'Action_SetUsers', { c: operation, users, ...values })
    }

    // 'info' asks who the ids already in the document belong to, so the comments panel can
    // show author avatars. We have none, and it takes no lock, so leaving it unanswered is
    // safe - the editor falls back to the names stored in the document.
    if (operation === 'info') {
      return
    }

    // 'protect' (spreadsheet protected ranges) - nothing to offer, but the lock needs releasing
    if (operation !== 'mention') {
      return respond([], { isPaginated: true })
    }

    // `isPaginated` is what keeps the editor in server-side-search mode: leave it off and it
    // caches the first list it gets and filters that locally forever, which for a directory the
    // size of CERN's would mean shipping a useless prefix of it once and never searching again.
    // `from`/`count` come back when the dropdown is scrolled to the bottom, and have to be
    // honoured - the editor appends what it gets rather than replacing, so returning the whole
    // result set again would show every match twice.
    const from = (message.Values?.from as number) || 0
    const count = (message.Values?.count as number) || 100
    const users = await resolveMentionUsers((message.Values?.search as string) || '')
    respond(users.slice(from, from + count), { isPaginated: true })
  }

  /**
   * A comment containing mentions was submitted. Unlike Collabora, which reports a pick the
   * moment it happens, EuroOffice only tells us once the comment is actually saved - so
   * there is nothing to defer here and the queue is flushed straight away.
   */
  const handleSendNotify = async (message: OfficePostMessage): Promise<void> => {
    const emails = message.Values?.emails
    if (!Array.isArray(emails) || !emails.length) {
      return
    }

    const userIds = await resolveUserIdsForEmails(emails as string[])
    userIds.forEach(queueMention)

    await notifyMentionedUsers({
      commentText: (message.Values?.message as string) || '',
      documentUrl: buildActionLinkUrl(
        unref(resource).privateLink || '',
        message.Values?.actionLink as ActionLink
      )
    })
  }

  /**
   * "Copy link to this comment/bookmark". The editor blocks on the reply - the link button
   * shows nothing until Action_SetActionLink arrives - so this always answers, falling back
   * to the plain document link if the anchor can't be attached.
   */
  const handleMakeActionLink = (message: OfficePostMessage): void => {
    const url = buildActionLinkUrl(
      unref(resource).privateLink || '',
      message.Values?.config as ActionLink
    )
    postMessageToIframe(appIframeRef, 'Action_SetActionLink', { url })
  }

  const handlePostMessage = async (event: MessageEvent): Promise<void> => {
    let message: OfficePostMessage
    try {
      message = JSON.parse(event.data || '{}')
    } catch (e) {
      console.debug('Error parsing EuroOffice PostMessage', e)
      return
    }

    switch (message.MessageId) {
      case 'App_LoadingStatus':
        return handleAppLoadingStatus()
      case 'UI_Sharing':
        return handleUiSharing()
      case 'UI_InsertGraphic':
        return handleUiInsertGraphic()
      case 'UI_RequestUsers':
        return handleRequestUsers(message)
      case 'UI_SendNotify':
        return handleSendNotify(message)
      case 'UI_MakeActionLink':
        return handleMakeActionLink(message)
      // case 'File_Rename':
      // case 'UI_Close':
      // case 'UI_Edit':
      // case 'Edit_Notification':
      // case 'UI_FileVersions':
    }
  }

  return {
    handlePostMessage,
    isLoaded,
    onResourceChanged: resetMentionState,
    hasPendingMentions
  }
}
