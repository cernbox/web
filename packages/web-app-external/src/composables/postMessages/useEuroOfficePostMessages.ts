import { ref, unref } from 'vue'
import { useShareDialog } from '../useShareDialog'
import { postMessageToIframe } from './postMessageToIframe'
import { useOfficeFileOperations } from '../useOfficeFileOperations'
import type {
  OfficePostMessage,
  OfficePostMessageContext,
  OfficePostMessageRegistration
} from './types'

export function useEuroOfficePostMessages(
  ctx: OfficePostMessageContext
): OfficePostMessageRegistration {
  const { space, resource, appIframeRef } = ctx
  const { openShareDialog } = useShareDialog()
  const { insertGraphic } = useOfficeFileOperations(ctx)

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
      // case 'File_Rename':
      // case 'UI_Close':
      // case 'UI_Edit':
      // case 'Edit_Notification':
      // case 'UI_FileVersions':
    }
  }

  return { handlePostMessage, isLoaded }
}
