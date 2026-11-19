import { Resource } from '@ownclouders/web-client'
import { AppConfigObject } from '../../apps/types'
import { Ref } from 'vue'

export interface AppWrapperSlotArgs {
  applicationConfig: AppConfigObject
  resource: Resource
  currentContent: Ref<string>
  isDirty: boolean
  isReadOnly: boolean
  url: string
  currentETag: string
}

/**
 * A save of the file that the app learned about from elsewhere, for example from a peer it edits
 * the file with.
 */
export interface AppWrapperServerState {
  etag: string
  /** What was saved, if it is the same as the app's current content. */
  content?: string
}
