import { ref, unref } from 'vue'
import { useShareDialog } from '../useShareDialog'
import { postMessageToIframe } from './postMessageToIframe'
import type {
  OfficePostMessage,
  OfficePostMessageContext,
  OfficePostMessageRegistration
} from './types'

/**
 * Microsoft 365 for the web's WOPI PostMessage protocol.
 * https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/scenarios/postmessage
 *
 * Each incoming message is only sent if the backend's WOPI CheckFileInfo response sets the
 * matching boolean property (ClosePostMessage, EditModePostMessage, FileSharingPostMessage,
 * FileVersionPostMessage, EditNotificationPostMessage) - confirmed only for EditModePostMessage
 * so far (UI_Edit already worked before this file existed). The others are wired here as
 * documented stubs pending backend confirmation, same caveat as EuroOffice's dispatch table.
 *
 * MS365 also disables some of its own UI (e.g. the Share button) until it receives
 * Host_PostmessageReady from the host - a handshake this codebase never sent before this file,
 * so UI_Sharing likely didn't fire in practice even if the backend already enabled it.
 */
export function useMS365PostMessages(ctx: OfficePostMessageContext): OfficePostMessageRegistration {
  const { space, resource, appIframeRef, switchToWriteMode } = ctx
  const { openShareDialog } = useShareDialog()

  const isLoaded = ref(false)

  const handleAppLoadingStatus = (): void => {
    isLoaded.value = true
    // We have no earlier point to send this from (the iframe doesn't exist until now),
    // so reply as soon as we know MS365 itself has finished loading.
    postMessageToIframe(appIframeRef, 'Host_PostmessageReady')
  }

  const handleUiEdit = (): void => {
    switchToWriteMode?.()
  }

  const handleUiSharing = (): void => {
    openShareDialog(unref(space), unref(resource))
  }

  const handleUiClose = (): void => {
    // TODO: verify whether MS365 needs any cleanup here beyond its own CloseUrl/
    // CloseButtonClosesWindow handling
  }

  const handleUiFileVersions = (): void => {
    // TODO: verify payload/feasibility of a custom version history panel
  }

  const handleFileRename = (message: OfficePostMessage): void => {
    // TODO: Values.NewName - unlike Collabora's Action_Save_Resp this is a passive
    // notification (MS365 renames in place via its own WOPI call, no host-driven prompt) -
    // verify whether any route/UI update is actually needed
  }

  const handleEditNotification = (): void => {
    // TODO: potential hook for "user is actively editing" telemetry, mirroring Collabora's
    // Doc_ModifiedStatus - no current use since MS365 has no mentions feature
  }

  const handlePostMessage = (event: MessageEvent): void => {
    let message: OfficePostMessage
    try {
      message = JSON.parse(event.data || '{}')
    } catch (e) {
      console.debug('Error parsing MS365 PostMessage', e)
      return
    }

    switch (message.MessageId) {
      case 'App_LoadingStatus':
        return handleAppLoadingStatus()
      case 'UI_Edit':
        return handleUiEdit()
      case 'UI_Sharing':
        return handleUiSharing()
      case 'UI_Close':
        return handleUiClose()
      case 'UI_FileVersions':
        return handleUiFileVersions()
      case 'File_Rename':
        return handleFileRename(message)
      case 'Edit_Notification':
        return handleEditNotification()
    }
  }

  return { handlePostMessage, isLoaded }
}
