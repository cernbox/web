import { isProjectSpaceResource } from '@ownclouders/web-client'
import { storeToRefs } from 'pinia'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  isLocationCommonActive,
  isLocationPublicActive,
  isLocationSpacesActive
} from '../../../router'
import { useClipboardStore, useResourcesStore } from '../../piniaStores'
import { useRouter } from '../../router'
import { FileAction, FileActionOptions } from '../types'
import { useFileActionsPaste } from './useFileActionsPaste'

export const useFileActionsDuplicate = () => {
  const { $gettext } = useGettext()

  const router = useRouter()

  const clipboardStore = useClipboardStore()
  const resourcesStore = useResourcesStore()
  const { currentFolder } = storeToRefs(resourcesStore)

  const copyHandler = ({ space, resources }: FileActionOptions) => {
    if (isLocationCommonActive(router, 'files-common-search')) {
      resources = resources.filter((r) => !isProjectSpaceResource(r))
    }

    clipboardStore.duplicateResources(resources, space)
  }
  const { handler: pasteHandler } = useFileActionsPaste()

  const handler = (options: FileActionOptions) => {
    copyHandler(options)
    // returned so callers can await the transfer actually finishing, not just being queued
    return pasteHandler(options)
  }

  const actions = computed((): FileAction[] => [
    {
      name: 'duplicate',
      icon: 'file-copy',
      handler,
      label: () => $gettext('Duplicate'),
      isVisible: ({ resources }) => {
        if (
          !isLocationSpacesActive(router, 'files-spaces-generic') &&
          !isLocationPublicActive(router, 'files-public-link') &&
          !isLocationCommonActive(router, 'files-common-search')
        ) {
          return false
        }
        if (isLocationSpacesActive(router, 'files-spaces-projects')) {
          return false
        }
        if (resources.length === 0) {
          return false
        }

        if (isLocationPublicActive(router, 'files-public-link')) {
          return unref(currentFolder)?.canCreate()
        }

        if (
          isLocationCommonActive(router, 'files-common-search') &&
          resources.every((r) => isProjectSpaceResource(r))
        ) {
          return false
        }

        if (!unref(resources)[0].canBeDeleted()) {
          return false
        }
        // duplicate can't be restricted in authenticated context, because
        // a user always has their home dir with write access
        return true
      }
    }
  ])

  return {
    actions
  }
}
