import { FileAction, FileActionOptions } from '../types'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useAppsStore, useModals } from '../../piniaStores'
import { storeToRefs } from 'pinia'
import FilePickerModal from '../../../components/Modals/FilePickerModal.vue'
import { useFolderLink } from '../../folderLink'
import { useIsFilesAppActive } from '../helpers'
import { useGetMatchingSpace } from '../../spaces'
import { useFileActions, EDITOR_MODE_EDIT } from './useFileActions'
import { useRouter, LocationQuery } from '../../router'
import { Resource, isShareSpaceResource } from '@ownclouders/web-client'

export const useFileActionsOpenWithApp = ({ appId }: { appId: string }) => {
  const { $gettext } = useGettext()
  const isFilesAppActive = useIsFilesAppActive()
  const { dispatchModal } = useModals()
  const appsStore = useAppsStore()
  const { apps } = storeToRefs(appsStore)
  const { getParentFolderLink } = useFolderLink()
  const { getMatchingSpace } = useGetMatchingSpace()
  const { getEditorRouteOpts } = useFileActions()
  const router = useRouter()

  const handler = ({ resources }: FileActionOptions) => {
    const app = unref(apps)[appId]
    const parentFolderLink = getParentFolderLink(resources[0])
    const allowedFileTypes = app.extensions.map((e) => (e.extension ? e.extension : e.mimeType))

    dispatchModal({
      elementClass: 'open-with-app-modal',
      title: $gettext('Open file in %{app}', { app: app.name }),
      customComponent: FilePickerModal,
      hideActions: true,
      customComponentAttrs: () => ({
        allowedFileTypes,
        parentFolderLink,
        callbackFn: ({
          resource,
          locationQuery
        }: {
          resource: Resource
          locationQuery?: LocationQuery
        }) => {
          const space = getMatchingSpace(resource)
          const remoteItemId = isShareSpaceResource(space) ? space.id : undefined

          const routeOpts = getEditorRouteOpts(
            unref(router.currentRoute).name,
            space,
            resource,
            EDITOR_MODE_EDIT,
            remoteItemId
          )
          routeOpts.query = { ...routeOpts.query, ...locationQuery }

          const editorRoute = router.resolve(routeOpts)
          const editorRouteUrl = new URL(editorRoute.href, window.location.origin)

          window.open(editorRouteUrl.href, '_blank')
        }
      }),
      focusTrapInitial: false
    })
  }

  const actions = computed((): FileAction[] => [
    {
      name: 'open-with-app',
      icon: 'folder-open',
      handler,
      label: () => {
        return $gettext('Open')
      },
      isVisible: () => {
        return !unref(isFilesAppActive)
      },
      class: 'oc-files-actions-open-with-app-trigger'
    }
  ])

  return {
    actions
  }
}
