import kebabCase from 'lodash-es/kebabCase'
import isNil from 'lodash-es/isNil'
import { isShareSpaceResource } from '@ownclouders/web-client'
import { routeToContextQuery } from '../../appDefaults'
import { isLocationTrashActive } from '../../../router'
import { computed, unref } from 'vue'
import { useRouter } from '../../router'
import { useGettext } from 'vue3-gettext'
import {
  Action,
  FileAction,
  FileActionOptions,
  useIsSearchActive,
  useWindowOpen
} from '../../actions'

import {
  useFileActionsEnableSync,
  useFileActionsToggleHideShare,
  useFileActionsCopy,
  useFileActionsDisableSync,
  useFileActionsDelete,
  useFileActionsDownloadArchive,
  useFileActionsDownloadFile,
  useFileActionsDuplicate,
  useFileActionsFavorite,
  useFileActionsMove,
  useFileActionsNavigate,
  useFileActionsRename,
  useFileActionsRestore,
  useFileActionsCreateSpaceFromResource
} from './index'
import {
  ActionExtension,
  useAppsStore,
  useConfigStore,
  useExtensionRegistry
} from '../../piniaStores'
import { ApplicationFileExtension } from '../../../apps'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { storeToRefs } from 'pinia'
import { useEmbedMode } from '../../embedMode'
import { RouteRecordName } from 'vue-router'

export const EDITOR_MODE_EDIT = 'edit'
export const EDITOR_MODE_CREATE = 'create'

export interface GetFileActionsOptions extends FileActionOptions {
  omitSystemActions?: boolean
}

export const useFileActions = () => {
  const appsStore = useAppsStore()
  const router = useRouter()
  const { $gettext } = useGettext()
  const isSearchActive = useIsSearchActive()
  const { isEnabled: isEmbedModeEnabled } = useEmbedMode()
  const { requestExtensions } = useExtensionRegistry()

  const { openUrl } = useWindowOpen()

  const configStore = useConfigStore()
  const { options } = storeToRefs(configStore)

  const { actions: enableSyncActions } = useFileActionsEnableSync()
  const { actions: hideShareActions } = useFileActionsToggleHideShare()
  const { actions: copyActions } = useFileActionsCopy()
  const { actions: deleteActions } = useFileActionsDelete()
  const { actions: disableSyncActions } = useFileActionsDisableSync()
  const { actions: downloadArchiveActions } = useFileActionsDownloadArchive()
  const { actions: downloadFileActions } = useFileActionsDownloadFile()
  const { actions: duplicateActions } = useFileActionsDuplicate()
  const { actions: favoriteActions } = useFileActionsFavorite()
  const { actions: moveActions } = useFileActionsMove()
  const { actions: navigateActions } = useFileActionsNavigate()
  const { actions: renameActions } = useFileActionsRename()
  const { actions: restoreActions } = useFileActionsRestore()
  const { actions: createSpaceFromResource } = useFileActionsCreateSpaceFromResource()

  const systemActions = computed((): Action[] => [
    ...unref(downloadArchiveActions),
    ...unref(downloadFileActions),
    ...unref(deleteActions),
    ...unref(moveActions),
    ...unref(copyActions),
    ...unref(duplicateActions),
    ...unref(renameActions),
    ...unref(createSpaceFromResource),
    ...unref(restoreActions),
    ...unref(enableSyncActions),
    ...unref(hideShareActions),
    ...unref(disableSyncActions),
    ...unref(favoriteActions),
    ...unref(navigateActions)
  ])

  const defaultActions = computed<FileAction[]>(() => {
    const contextActionExtensions = requestExtensions<ActionExtension>({
      id: 'global.files.default-actions',
      extensionType: 'action'
    })
    return contextActionExtensions.map((extension) => extension.action)
  })

  const extensionActions = computed(() => {
    return requestExtensions<ActionExtension>({
      id: 'global.files.context-actions',
      extensionType: 'action'
    }).map((e) => e.action)
  })

  /**
   * How specifically an app's file extension entry matches a resource: 0 for no match, then
   * mimetype group (`text`), exact mimetype, file extension.
   */
  const matchRank = (fileExtension: ApplicationFileExtension, resource: Resource): number => {
    if (!resource.canDownload() && !fileExtension.secureView) {
      return 0
    }

    if (resource.extension && fileExtension.extension) {
      return resource.extension.toLowerCase() === fileExtension.extension.toLowerCase() ? 3 : 0
    }

    if (resource.mimeType && fileExtension.mimeType) {
      const mimeType = resource.mimeType.toLowerCase()
      const wanted = fileExtension.mimeType.toLowerCase()
      if (mimeType === wanted) {
        return 2
      }
      if (mimeType.split('/')[0] === wanted) {
        return 1
      }
    }

    return 0
  }

  const editorActions = computed(() => {
    if (unref(isEmbedModeEnabled)) {
      return []
    }

    return appsStore.fileExtensions
      .filter((fileExtension) => appsStore.apps[fileExtension.app]?.hasEditor)
      .map((fileExtension): FileAction => {
        const appInfo = appsStore.apps[fileExtension.app]

        return {
          name: `editor-${fileExtension.app}`,
          label: () => {
            if (fileExtension.label) {
              if (typeof fileExtension.label === 'function') {
                return fileExtension.label()
              }
              return fileExtension.label
            }
            return $gettext('Open in %{app}', { app: appInfo.name }, true)
          },
          showOpenInNewTabHint: true,
          icon: fileExtension.icon || appInfo.icon,
          ...(appInfo.iconFillType && {
            iconFillType: appInfo.iconFillType
          }),
          img: appInfo.img,
          route: ({ space, resources }) => {
            return getEditorRoute({
              appFileExtension: fileExtension,
              space,
              resource: resources[0],
              mode: EDITOR_MODE_EDIT
            })
          },
          handler: (options) =>
            openEditor(fileExtension, options.space, options.resources[0], EDITOR_MODE_EDIT),
          isVisible: ({ resources }) => {
            if (resources.length !== 1) {
              return false
            }

            if (!unref(isSearchActive) && isLocationTrashActive(router, 'files-trash-generic')) {
              return false
            }

            // An app can register several entries matching the same file, e.g. `txt` and the
            // `text` mimetype, or `text/plain` and `text`. Only its best match is offered, so
            // each app appears once.
            let best: ApplicationFileExtension
            let bestRank = 0
            for (const other of appsStore.fileExtensions) {
              if (other.app !== fileExtension.app) {
                continue
              }
              const rank = matchRank(other, resources[0])
              if (rank > bestRank) {
                best = other
                bestRank = rank
              }
            }
            return best === fileExtension
          },
          hasPriority: fileExtension.hasPriority,
          class: `oc-files-actions-${kebabCase(appInfo.name).toLowerCase()}-trigger`
        }
      })
      .sort((first, second) => {
        // Ensure default are listed first
        if (second.hasPriority !== first.hasPriority && second.hasPriority) {
          return 1
        }
        return 0
      })
  })

  const getEditorRoute = ({
    appFileExtension,
    space,
    resource,
    mode
  }: {
    appFileExtension: ApplicationFileExtension
    space: SpaceResource
    resource: Resource
    mode: string
  }) => {
    const remoteItemId = isShareSpaceResource(space) ? space.id : undefined
    const routeName = appFileExtension.routeName || appFileExtension.app
    const routeOpts = getEditorRouteOpts(routeName, space, resource, mode, remoteItemId)
    return router.resolve(routeOpts)
  }
  const getEditorRouteOpts = (
    routeName: RouteRecordName,
    space: SpaceResource,
    resource: Resource,
    mode: string,
    remoteItemId: string,
    templateId?: string
  ) => {
    return {
      name: routeName,
      params: {
        driveAliasAndItem: space?.getDriveAliasAndItem(resource),
        filePath: resource.path,
        fileId: resource.fileId,
        mode
      },
      query: {
        ...(remoteItemId && { shareId: remoteItemId }),
        ...(resource.fileId && unref(options).routing.idBased && { fileId: resource.fileId }),
        ...(templateId && { templateId }),
        ...routeToContextQuery(unref(router.currentRoute))
      },
      // A link that points into a document - a heading anchor, say - arrives on the file's own
      // route and is then redirected here. Carrying the fragment over is what lets the editor
      // still see which part of the file was asked for.
      hash: unref(router.currentRoute).hash
    }
  }

  const openEditor = (
    appFileExtension: ApplicationFileExtension,
    space: SpaceResource,
    resource: Resource,
    mode: string
  ) => {
    const remoteItemId = isShareSpaceResource(space) ? space.id : undefined
    const routeName = appFileExtension.routeName || appFileExtension.app
    const routeOpts = getEditorRouteOpts(routeName, space, resource, mode, remoteItemId)
    router.push(routeOpts)
  }

  // TODO: Make user-configurable what is a defaultAction for a filetype/mimetype
  // returns the _first_ action from actions array which we now construct from
  // available mime-types coming from the app-provider and existing actions
  const triggerDefaultAction = (options: FileActionOptions) => {
    const action = getDefaultAction(options)
    action.handler({ ...options })
  }

  const getDefaultAction = (options: GetFileActionsOptions): Action | undefined => {
    const allActions = getAllAvailableActions(options)
    if (allActions.length) {
      return allActions[0]
    }
    return undefined
  }

  const getAllAvailableActions = (options: GetFileActionsOptions) => {
    const filterCallback = (action: FileAction) => action.isVisible(options)

    // TEMPORARY: browser-local override for which app opens office files by default, written
    // to localStorage by the office-app-feedback extension. Read raw/inline on purpose - this
    // is meant to be ripped out in a couple of months, not grown into a proper store.
    const preferredAppName = localStorage.getItem('preferredOfficeAppName')
    const preferredActionName = preferredAppName
      ? `editor-external-${preferredAppName.toLowerCase()}`
      : null

    const primaryActions = [...unref(defaultActions), ...unref(editorActions)]
      .filter(filterCallback)
      .sort((a, b) => {
        if (
          preferredActionName &&
          (a.name === preferredActionName || b.name === preferredActionName)
        ) {
          return a.name === preferredActionName ? -1 : 1
        }
        return Number(b.hasPriority) - Number(a.hasPriority)
      })

    const secondaryActions = options.omitSystemActions
      ? []
      : unref(systemActions).filter(filterCallback)

    return [
      ...primaryActions,
      ...secondaryActions,
      ...unref(extensionActions).filter(
        (a) =>
          a.isVisible(options as FileActionOptions) &&
          (a.category === 'actions' || isNil(a.category))
      )
    ]
  }

  return {
    editorActions,
    systemActions,
    defaultActions,
    getDefaultAction,
    getAllAvailableActions,
    getEditorRouteOpts,
    openEditor,
    triggerDefaultAction
  }
}
