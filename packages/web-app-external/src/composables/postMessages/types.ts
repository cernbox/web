import type { Ref } from 'vue'
import type { Resource, SpaceResource } from '@ownclouders/web-client'

export interface OfficePostMessage {
  MessageId: string
  SendTime?: number
  Values?: Record<string, unknown>
}

export interface OfficePostMessageContext {
  space: Ref<SpaceResource>
  resource: Ref<Resource>
  appIframeRef: Ref<HTMLIFrameElement | null>
  // only used by MS365 today; other apps switch view/edit mode via their own protocol
  switchToWriteMode?: () => void
}

export interface OfficePostMessageRegistration {
  handlePostMessage: (event: MessageEvent) => void | Promise<void>
  onResourceChanged?: () => void
  onUnmount?: () => void
  // whether the app has signaled (via its own "loaded" message) that it finished loading;
  // only populated by MS365 today, exposed generically so App.vue can react to it
  isLoaded?: Ref<boolean>
  // whether there are @mentions queued for notifyMentionedUsers that haven't been flushed yet;
  // populated by Collabora and EuroOffice, exposed generically so App.vue can warn before unload
  hasPendingMentions?: Ref<boolean>
}

export type OfficePostMessageFactory = (
  ctx: OfficePostMessageContext
) => OfficePostMessageRegistration
