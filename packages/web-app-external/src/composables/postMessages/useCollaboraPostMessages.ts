import { unref } from 'vue'
import { queryItemAsString, useClientService, useRoute, useRouter } from '@ownclouders/web-pkg'
import { postMessageToIframe } from './postMessageToIframe'
import { useMentionNotifications } from '../useMentionNotifications'
import { useOfficeFileOperations } from '../useOfficeFileOperations'
import type {
  OfficePostMessage,
  OfficePostMessageContext,
  OfficePostMessageRegistration
} from './types'

/**
 * Collabora Online's WOPI postMessage protocol.
 * https://sdk.collaboraonline.com/docs/postmessage_api.html
 */
export function useCollaboraPostMessages(
  ctx: OfficePostMessageContext
): OfficePostMessageRegistration {
  const { space, resource, appIframeRef } = ctx
  const route = useRoute()
  const router = useRouter()
  const { webdav } = useClientService()
  const {
    resolveMentionCandidates,
    queueMention,
    notifyMentionedUsers,
    resetMentionState,
    hasPendingMentions
  } = useMentionNotifications(ctx)
  const { saveAs, insertGraphic, insertFile, insertLink } = useOfficeFileOperations(ctx)

  const handleAppLoadingStatus = (message: OfficePostMessage): void => {
    postMessageToIframe(appIframeRef, 'Hide_Button', { id: 'toggledarktheme' })
    if (message.Values?.Status === 'Frame_Ready') {
      postMessageToIframe(appIframeRef, 'Host_PostmessageReady')
    }
  }

  const handleDocModifiedStatus = async (message: OfficePostMessage): Promise<void> => {
    if (message.Values?.Modified === false) {
      await notifyMentionedUsers()
    }
  }

  const handleUiClose = async (): Promise<void> => {
    await notifyMentionedUsers()
  }

  const handleUiSaveAs = async (message: OfficePostMessage): Promise<void> => {
    await saveAs({
      fileExtension: message.Values?.format as string,
      onConfirm: (newFileName) => {
        postMessageToIframe(appIframeRef, 'Action_SaveAs', { Filename: newFileName, Notify: true })
      }
    })
  }

  const handleActionSaveResp = async (message: OfficePostMessage): Promise<void> => {
    if (!message.Values?.fileName) {
      return
    }

    const currentResource = unref(resource)
    const newFile = await webdav.getFileInfo(unref(space), {
      path:
        currentResource.path.substring(
          0,
          currentResource.path.length - currentResource.name.length
        ) + (message.Values.fileName as string),
      fileId: undefined
    })

    await router.push({
      name: unref(route).name,
      params: {
        ...unref(route).params,
        driveAliasAndItem: queryItemAsString(unref(route).params.driveAliasAndItem).replace(
          currentResource.name,
          newFile.name
        )
      },
      query: {
        ...unref(route).query,
        fileId: newFile.fileId
      }
    })
  }

  const handleUiInsertGraphic = async (): Promise<void> => {
    await insertGraphic({
      onPicked: (url) => {
        postMessageToIframe(appIframeRef, 'Action_InsertGraphic', { url })
      }
    })
  }

  const handleUiInsertFile = async (message: OfficePostMessage): Promise<void> => {
    const callback = message.Values?.callback
    if (typeof callback !== 'string') {
      return
    }

    await insertFile({
      mimeTypeFilter: message.Values?.mimeTypeFilter as string[],
      onPicked: (url, filename) => {
        const values: Record<string, unknown> = { url }
        if (callback === 'Action_CompareDocuments') {
          values.filename = filename
        }
        postMessageToIframe(appIframeRef, callback, values)
      }
    })
  }

  const handleUiMention = async (message: OfficePostMessage): Promise<void> => {
    if (message.Values?.type === 'autocomplete') {
      const list = await resolveMentionCandidates((message.Values.text as string) || '')
      postMessageToIframe(appIframeRef, 'Action_Mention', { list })
      return
    }
    if (message.Values?.type === 'selected' && typeof message.Values.username === 'string') {
      await queueMention(message.Values.username)
    }
  }

  const handleUiPickLink = async (): Promise<void> => {
    await insertLink({
      onPicked: (url, text) => {
        postMessageToIframe(appIframeRef, 'Action_InsertLink', { url, text })
      }
    })
  }

  const handlePostMessage = async (event: MessageEvent): Promise<void> => {
    let message: OfficePostMessage
    try {
      message = JSON.parse(event.data || '{}')
    } catch (e) {
      console.debug('Error parsing Collabora PostMessage', e)
      return
    }

    switch (message.MessageId) {
      case 'App_LoadingStatus':
        return handleAppLoadingStatus(message)
      case 'Doc_ModifiedStatus':
        return handleDocModifiedStatus(message)
      case 'UI_Close':
        return handleUiClose()
      case 'UI_SaveAs':
        return handleUiSaveAs(message)
      case 'Action_Save_Resp':
        return handleActionSaveResp(message)
      case 'UI_InsertGraphic':
        return handleUiInsertGraphic()
      case 'UI_InsertFile':
        return handleUiInsertFile(message)
      case 'UI_Mention':
        return handleUiMention(message)
      case 'UI_PickLink':
        return handleUiPickLink()
    }
  }

  return {
    handlePostMessage,
    onResourceChanged: resetMentionState,
    hasPendingMentions
  }
}
