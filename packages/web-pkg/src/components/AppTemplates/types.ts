import { Resource } from '@ownclouders/web-client'
import { AppConfigObject } from '../../apps/types'
import { Ref } from 'vue'
import type * as Y from 'yjs'
import type { Awareness } from 'y-protocols/awareness'
import type { YjsAdapter, YjsStatus } from '../../composables/yjs'

export interface AppWrapperSlotArgs {
  applicationConfig: AppConfigObject
  resource: Resource
  currentContent: Ref<string>
  isDirty: boolean
  isReadOnly: boolean
  url: string
  /** Set once the Yjs session is synced and hydrated, else null. */
  ydoc: Y.Doc | null
  /** Set once the Yjs session is synced and hydrated, else null. */
  awareness: Awareness | null
  /** Current collaboration transport status. Null when the app did not opt into Yjs. */
  yjsStatus: YjsStatus | null
}

/**
 * Handed to {@link YjsOptions.makeAdapter}. Reactive, because the
 * adapter is built during the wrapper's setup before the file is loaded.
 */
export interface YjsAdapterContext {
  /** The file. Undefined until the wrapper has loaded it, so read it lazily. */
  resource: Ref<Resource>
}

/** Live editing through the Yjs server, see `useYjsSession`. */
export interface YjsOptions {
  /**
   * Builds the bridge between the native file format and the shared Y.Doc.
   * Called once during the wrapper's setup, so it may use composables.
   */
  makeAdapter: (context: YjsAdapterContext) => YjsAdapter
  /**
   * Namespace for the Yjs room. Defaults to the `applicationId`. Editors
   * with incompatible Y.Doc schemas must not share a room, so only override
   * this when two apps deliberately use the same shared-type layout.
   */
  documentPrefix?: string
  /**
   * CERNBox: whether this file is edited together at all. A file it turns away
   * is edited as without live editing: no session, and `ydoc` stays null.
   * Defaults to every file.
   */
  isEnabled?: (resource: Resource) => boolean
}
