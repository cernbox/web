import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isPublicSpaceResource, Resource, SpaceResource } from '@ownclouders/web-client'
import { ClipboardActions } from '../../helpers'
import { useGettext } from 'vue3-gettext'
import { useMessages } from './messages'

export const useClipboardStore = defineStore('clipboard', () => {
  const { $gettext } = useGettext()
  const { showMessage } = useMessages()

  const action = ref<ClipboardActions>()
  const resources = ref<Resource[]>([])
  /**
   * Whether the clipboard was filled from a public link. A webdav COPY/MOVE carries either the
   * public link token or the user's bearer token, never both, so a transfer that crosses that
   * boundary is built for one context and rejected by the other. Recorded here because it can't
   * be recovered later: public link listings strip the token from the resources they build.
   */
  const isPublicLinkSource = ref(false)

  const copyResources = (r: Resource[], sourceSpace?: SpaceResource) => {
    if (!r[0].canDownload()) {
      return
    }

    action.value = ClipboardActions.Copy
    resources.value = r
    isPublicLinkSource.value = isPublicSpaceResource(sourceSpace)

    showMessage({ title: $gettext('Copied to clipboard!'), status: 'success' })
  }

  const cutResources = (r: Resource[], sourceSpace?: SpaceResource) => {
    if (!r[0].canDownload()) {
      return
    }

    action.value = ClipboardActions.Cut
    resources.value = r
    isPublicLinkSource.value = isPublicSpaceResource(sourceSpace)

    showMessage({ title: $gettext('Cut to clipboard!'), status: 'success' })
  }

  const duplicateResources = (r: Resource[], sourceSpace?: SpaceResource) => {
    if (!r[0].canDownload()) {
      return
    }

    action.value = ClipboardActions.Duplicate
    resources.value = r
    isPublicLinkSource.value = isPublicSpaceResource(sourceSpace)
  }

  const clearClipboard = () => {
    action.value = undefined
    resources.value = []
    isPublicLinkSource.value = false
  }

  return {
    action,
    resources,
    isPublicLinkSource,

    copyResources,
    cutResources,
    duplicateResources,
    clearClipboard
  }
})

export type ClipboardStore = ReturnType<typeof useClipboardStore>
