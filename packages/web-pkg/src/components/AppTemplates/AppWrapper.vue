<template>
  <main :id="applicationId" class="app-wrapper oc-height-1-1" @keydown.esc="closeApp">
    <h1 class="oc-invisible-sr" v-text="pageTitle" />
    <app-top-bar
      v-if="!loading && !loadingError && resource"
      :main-actions="fileActions"
      :drop-down-menu-sections="dropDownMenuSections"
      :drop-down-action-options="dropDownActionOptions"
      :has-auto-save="hasAutoSave"
      :is-editor="isEditor"
      :resource="resource"
      @close="closeApp"
    />
    <loading-screen v-if="isLoading" />
    <not-found-message v-else-if="showNotFoundMessage" />
    <error-screen v-else-if="loadingError" :message="loadingError.message" />
    <div
      v-else
      class="oc-flex oc-width-1-1 oc-height-1-1"
      :class="{ 'app-sidebar-open': isSideBarOpen }"
    >
      <slot class="app-wrapper-content oc-height-1-1" v-bind="slotAttrs" />
      <file-side-bar :is-open="isSideBarOpen" :active-panel="sideBarActivePanel" :space="space" />
    </div>
  </main>
</template>

<script lang="ts">
import {
  PropType,
  Ref,
  defineComponent,
  onBeforeUnmount,
  ref,
  unref,
  watch,
  computed,
  onMounted
} from 'vue'
import { DateTime } from 'luxon'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import AppTopBar from '../AppTopBar.vue'
import ErrorScreen from './PartialViews/ErrorScreen.vue'
import LoadingScreen from './PartialViews/LoadingScreen.vue'
import FileSideBar from '../SideBar/FileSideBar.vue'
import NotFoundMessage from '../FilesList/NotFoundMessage.vue'
import {
  UrlForResourceOptions,
  queryItemAsString,
  useAppDefaults,
  useClientService,
  useRoute,
  useRouteParam,
  useRouteQuery,
  useSelectedResources,
  useSideBar,
  useModals,
  useMessages,
  useSpacesStore,
  useAppsStore,
  useConfigStore,
  useResourcesStore,
  FileContentOptions,
  useFileActionsCopyPermanentLink,
  useFileActionsDownloadFile,
  useFileActionsShowDetails,
  useFileActionsShowShares,
  FileActionOptions,
  FileAction,
  useLoadingService,
  useFileActionsSaveAs,
  useSharesStore
} from '../../composables'
import {
  Action,
  Modifier,
  Key,
  useAppMeta,
  useGetResourceContext,
  useKeyboardActions
} from '../../composables'
import {
  Resource,
  SpaceResource,
  buildIncomingShareResource,
  call,
  isPersonalSpaceResource,
  isProjectSpaceResource,
  isShareSpaceResource
} from '@ownclouders/web-client'
import { DavPermission } from '@ownclouders/web-client/webdav'
import { HttpError, getHttpErrorLogDetails } from '@ownclouders/web-client'
import { dirname } from 'path'
import { useFileActionsOpenWithApp } from '../../composables/actions/files/useFileActionsOpenWithApp'
import { UnsavedChangesModal } from '../Modals'
import { formatFileSize, getSharedDriveItem } from '../../helpers'
import toNumber from 'lodash-es/toNumber'
import { YjsOptions } from './types'
import { useAppWrapperYjs } from './useAppWrapperYjs'

export default defineComponent({
  name: 'AppWrapper',
  components: {
    AppTopBar,
    FileSideBar,
    ErrorScreen,
    LoadingScreen,
    NotFoundMessage
  },
  props: {
    // TODO: Add app-top-bar-actions array prop and pass to AppTopBar
    applicationId: {
      type: String,
      required: true
    },
    urlForResourceOptions: {
      type: Object as PropType<UrlForResourceOptions>,
      default: (): UrlForResourceOptions => null,
      required: false
    },
    fileContentOptions: {
      type: Object as PropType<FileContentOptions>,
      default: (): FileContentOptions => null,
      required: false
    },
    wrappedComponent: {
      type: Object as PropType<ReturnType<typeof defineComponent>>,
      default: null
    },
    importResourceWithExtension: {
      type: Function as PropType<(resource: Resource) => string>,
      default: (): Resource => null
    },
    disableAutoSave: {
      type: Boolean,
      default: false
    },
    /** Live editing through the Yjs server, see `YjsOptions`. */
    yjs: {
      type: Object as PropType<YjsOptions>,
      default: null
    }
  },
  setup(props) {
    const { $gettext, current: currentLanguage } = useGettext()
    const appsStore = useAppsStore()
    const { showMessage, showErrorMessage } = useMessages()
    const router = useRouter()
    const currentRoute = useRoute()
    const clientService = useClientService()
    const loadingService = useLoadingService()
    const { getResourceContext } = useGetResourceContext()
    const { selectedResources } = useSelectedResources()
    const { dispatchModal } = useModals()
    const spacesStore = useSpacesStore()
    const configStore = useConfigStore()
    const resourcesStore = useResourcesStore()
    const sharesStore = useSharesStore()

    const { actions: openWithAppActions } = useFileActionsOpenWithApp({
      appId: props.applicationId
    })
    const { actions: copyPermanentLinkActions } = useFileActionsCopyPermanentLink()
    const { actions: downloadFileActions } = useFileActionsDownloadFile()
    const { actions: showDetailsActions } = useFileActionsShowDetails()
    const { actions: showSharesActions } = useFileActionsShowShares()

    const noResourceLoading = computed(() => {
      // component has its own way to load the resource(s)
      return Boolean(props.wrappedComponent.emits?.includes('update:resource'))
    })

    const resource: Ref<Resource> = ref()
    const space: Ref<SpaceResource> = ref()
    const currentETag = ref('')
    const url = ref('')
    const loading = ref(!unref(noResourceLoading))
    const loadingError: Ref<Error> = ref()
    const isReadOnly = ref(false)
    const serverContent = ref()
    const currentContent = ref()
    const showNotFoundMessage = ref(false)
    /**
     * Id of the resource `currentContent` was fetched for. `resource` is swapped
     * ahead of the body; the Yjs session's `enabled` gate compares the two.
     */
    const contentResourceId = ref<string>()

    const { actions: saveAsActions } = useFileActionsSaveAs({ content: currentContent })

    const isEditor = computed(() => {
      // A collaborative app drives its content through the Yjs session instead
      // of `update:currentContent`, so opting in makes it an editor.
      return (
        Boolean(props.yjs) ||
        Boolean(props.wrappedComponent.emits?.includes('update:currentContent'))
      )
    })

    const hasProp = (name: string) => {
      return Boolean(Object.keys(props.wrappedComponent.props).includes(name))
    }

    const isDirty = computed(() => {
      // Peers' edits reach a read-only editor too, but it has nothing to save
      if (unref(isReadOnly)) {
        return false
      }
      return unref(currentContent) !== unref(serverContent)
    })

    const preventUnload = (e: Event) => {
      e.preventDefault()
    }

    const {
      applicationConfig,
      closeApp,
      currentFileContext,
      getFileContents,
      getFileInfo,
      getUrlForResource,
      putFileContents,
      replaceInvalidFileRoute,
      revokeUrl,
      activeFiles,
      loadFolderForFileContext,
      isFolderLoading
    } = useAppDefaults({
      applicationId: props.applicationId
    })

    const {
      session: yjsSession,
      isSessionReady,
      effectiveReadOnly,
      isConflicted,
      reconcileConflict
    } = useAppWrapperYjs({
      yjs: props.yjs,
      applicationId: props.applicationId,
      resource,
      isReadOnly,
      isDirty,
      loading,
      loadingError,
      contentResourceId,
      currentContent,
      serverContent,
      currentETag,
      currentFileContext,
      fileContentOptions: props.fileContentOptions,
      getFileContents,
      putFileContents,
      applySavedResource,
      onConflict: showExternalUpdateConflict,
      onExternalUpdateApplied: () => {
        showMessage({
          title: $gettext('File updated'),
          desc: $gettext(
            'This file was updated outside this window. The editor now shows the latest version.'
          )
        })
      }
    })

    /**
     * The Yjs session reports doc changes debounced, so `isDirty` and `currentContent` lag behind
     * the last keystrokes. Let it catch up before deciding about unsaved work.
     */
    const flushPendingContent = () => {
      yjsSession?.flushContent()
    }

    // `beforeunload` can't wait for a flush, so a pending change counts as unsaved there.
    // Remote edits leave changes pending for read-only users too, which they can't save anyway.
    const hasUnsavedWork = computed(
      () => unref(isDirty) || (!unref(isReadOnly) && unref(yjsSession?.hasPendingContent))
    )

    watch(hasUnsavedWork, (dirty) => {
      // Prevent reload if there are changes
      if (dirty) {
        window.addEventListener('beforeunload', preventUnload)
      } else {
        window.removeEventListener('beforeunload', preventUnload)
      }
    })

    // components that load their own resource keep `loading` false from the start, so without this
    // the slot would render before the drive resolver has produced a file context. Resolving a
    // space is asynchronous (drive types are fetched on demand), and everything below - `slotAttrs`
    // included - assumes a context is there.
    // The loading screen also stays up until the Yjs session is synced and hydrated, so the wrapped
    // component always mounts against a ready Y.Doc. A load failure short-circuits: it leaves the
    // session disabled, so waiting on it would keep the error from ever showing.
    const isLoading = computed(() => {
      if (unref(loading) || !unref(currentFileContext)) {
        return true
      }
      if (unref(loadingError) || unref(showNotFoundMessage)) {
        return false
      }
      return !unref(isSessionReady)
    })

    const { applicationMeta } = useAppMeta({ applicationId: props.applicationId, appsStore })

    const fileSizeLimit = computed(() => {
      return unref(applicationMeta).meta?.fileSizeLimit
    })

    const pageTitle = computed(() => {
      const { name: appName } = unref(applicationMeta)

      return $gettext(`%{appName} for %{fileName}`, {
        appName: $gettext(appName),
        fileName: unref(unref(currentFileContext)?.fileName)
      })
    })

    const driveAliasAndItem = useRouteParam('driveAliasAndItem')
    const fileIdQueryItem = useRouteQuery('fileId')
    const fileId = computed(() => {
      return queryItemAsString(unref(fileIdQueryItem))
    })

    const addMissingDriveAliasAndItem = async () => {
      const id = unref(fileId)
      const { space, path } = await getResourceContext(id)
      const driveAliasAndItem = space.getDriveAliasAndItem({ path } as Resource)

      if (isPersonalSpaceResource(space)) {
        return router.push({
          params: {
            ...unref(currentRoute).params,
            driveAliasAndItem
          },
          query: {
            ...unref(currentRoute).query,
            fileId: id,
            contextRouteName: 'files-spaces-generic',
            contextRouteParams: { driveAliasAndItem: dirname(driveAliasAndItem) } as any
          }
        })
      }

      return router.push({
        params: {
          ...unref(currentRoute).params,
          driveAliasAndItem
        },
        query: {
          ...unref(currentRoute).query,
          fileId: id,
          contextRouteName: path === '/' ? 'files-shares-with-me' : 'files-spaces-generic',
          ...(isShareSpaceResource(space) && { shareId: space.id }),
          contextRouteParams: {
            driveAliasAndItem: dirname(driveAliasAndItem)
          } as any,
          contextRouteQuery: {
            ...(isShareSpaceResource(space) && { shareId: space.id })
          } as any
        }
      })
    }

    const loadResourceTask = useTask(function* (signal) {
      try {
        if (!unref(driveAliasAndItem)) {
          yield addMissingDriveAliasAndItem()
        }
        if (!unref(currentFileContext)) {
          return null
        }
        space.value = unref(unref(currentFileContext).space)
        const fileInfo = yield getFileInfo(unref(currentFileContext), { signal })
        resource.value = fileInfo

        if (isShareSpaceResource(unref(space))) {
          // FIXME: As soon the backend exposes oc-remote-id via webdav, remove the assignment below
          unref(resource).remoteItemId = unref(space).id

          if (unref(resource).id === unref(resource).remoteItemId) {
            // use graph api to build incoming share resource
            const sharedDriveItem = yield* call(
              getSharedDriveItem({
                graphClient: clientService.graphAuthenticated,
                spacesStore,
                space: unref(space)
              })
            )

            if (sharedDriveItem) {
              resource.value = {
                ...fileInfo,
                ...buildIncomingShareResource({
                  graphRoles: sharesStore.graphRoles,
                  driveItem: sharedDriveItem,
                  serverUrl: configStore.serverUrl
                }),
                tags: fileInfo.tags // tags are always [] in Graph API, hence take them from webdav
              }
            }
          }
        }
        resourcesStore.initResourceList({ currentFolder: null, resources: [unref(resource)] })
        selectedResources.value = [unref(resource)]
      } catch (e) {
        console.error('Failed to load app resource', getHttpErrorLogDetails(e))
        if (e?.statusCode === 403 || e?.statusCode === 404) {
          showNotFoundMessage.value = true
        } else {
          loadingError.value = e
        }
        loading.value = false
      }
    }).restartable()

    const loadFileTask = useTask(function* (signal) {
      // Bail out before the `finally` below: nothing has been loaded yet, so clearing `loading`
      // here would render the slot without a resource. The wrapped app receives it as a prop and
      // typically only reacts to the very first value it sees, so handing it `undefined` means it
      // never opens the file. The watcher runs this again once the context and resource exist.
      if (!unref(currentFileContext) || !unref(resource)) {
        return null
      }

      try {
        const newExtension = props.importResourceWithExtension(unref(resource))
        if (newExtension) {
          const timestamp = DateTime.local().toFormat('yyyyMMddHHmmss')
          const targetPath = `${unref(resource).name}_${timestamp}.${newExtension}`
          if (
            !(yield clientService.webdav.copyFiles(
              unref(space),
              unref(resource),
              unref(space),
              {
                path: targetPath
              },
              { signal }
            ))
          ) {
            throw new Error($gettext('Importing failed'))
          }

          resource.value = { path: targetPath } as Resource
        }

        if (replaceInvalidFileRoute(currentFileContext, unref(resource))) {
          return
        }

        isReadOnly.value = ![DavPermission.Updateable, DavPermission.FileUpdateable].some(
          (p) => (unref(resource).permissions || '').indexOf(p) > -1
        )

        // A collaborative app needs the body too: the Yjs session seeds the room from it
        if (props.yjs || unref(hasProp('currentContent'))) {
          const fileContentsResponse = yield* call(
            getFileContents(currentFileContext, { ...props.fileContentOptions, signal })
          )
          serverContent.value = currentContent.value = fileContentsResponse.body
          currentETag.value = fileContentsResponse.headers['OC-ETag']
          contentResourceId.value = unref(resource).id
        }

        if (unref(hasProp('url'))) {
          url.value = yield getUrlForResource(unref(space), unref(resource), {
            ...props.urlForResourceOptions,
            signal
          })
        }
      } catch (e) {
        console.error('Failed to load app file', getHttpErrorLogDetails(e))
        loadingError.value = e
      } finally {
        loading.value = false
      }
    }).restartable()

    watch(
      currentFileContext,
      async () => {
        if (!unref(noResourceLoading)) {
          await loadResourceTask.perform()

          if (unref(fileSizeLimit) && toNumber(unref(resource).size) > unref(fileSizeLimit)) {
            dispatchModal({
              title: $gettext('File exceeds %{threshold}', {
                threshold: formatFileSize(unref(fileSizeLimit), currentLanguage)
              }),
              message: $gettext(
                '%{resource} exceeds the recommended size of %{threshold} for editing, and may cause performance issues.',
                {
                  resource: unref(resource).name,
                  threshold: formatFileSize(unref(fileSizeLimit), currentLanguage)
                }
              ),
              confirmText: $gettext('Continue'),
              onCancel: () => {
                closeApp()
              },
              onConfirm: () => {
                loadFileTask.perform()
              }
            })
          } else {
            loadFileTask.perform()
          }
        }
      },
      { immediate: true }
    )

    const errorPopup = (error: HttpError) => {
      console.error('Failed to save file', getHttpErrorLogDetails(error))
      showErrorMessage({
        title: $gettext('An error occurred'),
        desc: error.message,
        errors: [error]
      })
    }

    const autosavePopup = () => {
      showMessage({ title: $gettext('File autosaved') })
    }

    function showExternalUpdateConflict(response: Response = null) {
      errorPopup(
        new HttpError(
          $gettext(
            'This file was updated outside this window. Please refresh the page (all changes will be lost).'
          ),
          response
        )
      )
    }

    /**
     * Single landing point for a successful write: updates the etag for the next `If-Match` and
     * the store. `saved` is the PUT's response, or null when only the etag is known. A function
     * declaration, so it is hoisted above the `useAppWrapperYjs` call that captures it.
     */
    function applySavedResource(etag: string, saved: Resource | null = null) {
      currentETag.value = etag
      const current = unref(resource)
      if (!current) {
        return
      }
      const updated: Resource = {
        ...current,
        etag,
        ...(saved && { size: saved.size, mdate: saved.mdate })
      }
      // The Yjs session stamps the room with the etag of our own saves, which it reads from
      // `resource`. Other apps keep the resource object they were given.
      if (yjsSession) {
        resource.value = updated
      }
      resourcesStore.upsertResource(saved ?? updated)
    }

    const saveFileTask = useTask(function* () {
      const newContent = unref(currentContent)
      // Pin the Y.Doc state behind `newContent`; the doc usually moves on while
      // the PUT is in flight.
      yjsSession?.beginSave()
      try {
        const putFileContentsResponse = yield putFileContents(currentFileContext, {
          content: newContent,
          previousEntityTag: unref(currentETag)
        })
        serverContent.value = newContent
        applySavedResource(putFileContentsResponse.etag, putFileContentsResponse)
      } catch (e) {
        switch (e.statusCode) {
          case 401:
          case 403:
            errorPopup(
              new HttpError($gettext("You're not authorized to save this file"), e.response)
            )
            break
          case 409:
          case 412:
            // `previousEntityTag` didn't match what the server has. A connected Yjs session can
            // resolve that itself when the conflicting write came from a peer in the room,
            // because our Y.Doc already holds that peer's edits.
            if (yield* reconcileConflict(newContent)) {
              break
            }
            showExternalUpdateConflict(e.response)
            break
          case 507:
            const space = spacesStore.spaces.find(
              (space) => space.id === unref(resource).storageId && isProjectSpaceResource(space)
            )
            if (space) {
              errorPopup(
                new HttpError(
                  $gettext('Insufficient quota on "%{spaceName}" to save this file', {
                    spaceName: space.name
                  }),
                  e.response
                )
              )
              break
            }
            errorPopup(
              new HttpError($gettext('Insufficient quota for saving this file'), e.response)
            )
            break
          default:
            errorPopup(new HttpError('', e.response))
        }
      }
    }).drop()

    const save = async () => {
      flushPendingContent()
      await saveFileTask.perform()
    }

    const hasAutoSave = computed(() => {
      return !props.disableAutoSave
    })

    let autosaveIntervalId: ReturnType<typeof setInterval> = null
    onMounted(() => {
      if (resourcesStore.ancestorMetaData?.['/'] && unref(space)) {
        const clearAncestorData = resourcesStore.ancestorMetaData['/'].spaceId !== unref(space).id
        if (clearAncestorData) {
          // clear ancestor data in case the user switched spaces (e.g. by opening a file via search results)
          resourcesStore.setAncestorMetaData({})
        }
      }

      if (!unref(isEditor)) {
        return
      }
      const editorOptions = configStore.options.editor
      if (editorOptions.autosaveEnabled && !props.disableAutoSave) {
        autosaveIntervalId = setInterval(
          async () => {
            flushPendingContent()
            // A session that gave up the room over an external write would only hit the same
            // conflict again
            if (isDirty.value && !unref(isConflicted)) {
              await save()
              autosavePopup()
            }
          },
          (editorOptions.autosaveInterval || 120) * 1000
        )
      }
    })
    onBeforeUnmount(() => {
      if (!loadingService.isLoading) {
        window.removeEventListener('beforeunload', preventUnload)
      }

      if (unref(hasProp('url'))) {
        revokeUrl(url.value)
      }

      if (!unref(isEditor)) {
        return
      }

      clearInterval(autosaveIntervalId)
      autosaveIntervalId = null
    })

    const { bindKeyAction } = useKeyboardActions({ skipDisabledKeyBindingsCheck: true })
    bindKeyAction({ modifier: Modifier.Ctrl, primary: Key.S }, () => {
      flushPendingContent()
      if (!unref(isDirty)) {
        return
      }
      save()
    })

    const fileActionsSave = computed<FileAction[]>(() => {
      return [
        {
          name: 'save-file',
          disabledTooltip: () => '',
          isVisible: () => unref(isEditor),
          isDisabled: () => unref(effectiveReadOnly) || !isDirty.value,
          icon: 'save',
          id: 'app-save-action',
          label: () => $gettext('Save'),
          handler: save
        }
      ]
    })

    const actionOptions = computed<FileActionOptions>(() => {
      return {
        space: unref(space),
        resources: [unref(resource)]
      }
    })

    /**
     * The interceptor is used to save the file automatically when in dirty state,
     * so the downloaded file equals the current state
     */
    const downloadFileActionInterceptor = async (
      args: FileActionOptions,
      originalAction: Action<FileActionOptions>['handler']
    ) => {
      flushPendingContent()
      if (unref(isDirty)) {
        await save()
        autosavePopup()
      }
      originalAction(args)
    }

    const menuItemsContext = computed(() => {
      return [
        ...unref(openWithAppActions),
        ...unref(fileActionsSave),
        ...unref(saveAsActions).map((action) => {
          return {
            ...action,
            isVisible: (args: FileActionOptions) => isEditor.value && action.isVisible(args)
          }
        })
      ].filter((item) => item.isVisible(unref(actionOptions)))
    })
    const menuItemsShare = computed(() => {
      return [...unref(showSharesActions), ...unref(copyPermanentLinkActions)].filter((item) =>
        item.isVisible(unref(actionOptions))
      )
    })
    const menuItemsActions = computed(() => {
      return [
        ...unref(downloadFileActions).map((originalAction) => ({
          ...originalAction,
          handler: (args) => downloadFileActionInterceptor(args, originalAction.handler)
        }))
      ].filter((item) => item.isVisible(unref(actionOptions)))
    })
    const menuItemsSidebar = computed(() => {
      return [...unref(showDetailsActions)].filter((item) => item.isVisible(unref(actionOptions)))
    })
    const dropDownMenuSections = computed(() => {
      const sections = []

      if (unref(menuItemsContext).length) {
        sections.push({
          name: 'context',
          items: unref(menuItemsContext)
        })
      }
      if (unref(menuItemsShare).length) {
        sections.push({
          name: 'share',
          items: unref(menuItemsShare)
        })
      }
      if (unref(menuItemsActions).length) {
        sections.push({
          name: 'actions',
          items: unref(menuItemsActions)
        })
      }
      if (unref(menuItemsSidebar).length) {
        sections.push({
          name: 'sidebar',
          items: unref(menuItemsSidebar)
        })
      }
      return sections
    })

    const fileActions = computed((): Action[] => [...unref(fileActionsSave)])

    onBeforeRouteLeave((_to, _from, next) => {
      flushPendingContent()
      if (unref(isDirty)) {
        dispatchModal({
          icon: 'error-warning',
          title: $gettext('Unsaved changes'),
          customComponent: UnsavedChangesModal,
          focusTrapInitial: '.oc-modal-body-actions-confirm',
          hideActions: true,
          customComponentAttrs: () => {
            return {
              closeCallback: () => {
                next()
              }
            }
          },
          async onConfirm() {
            await save()
            next()
          }
        })
      } else {
        next()
      }
    })

    const slotAttrs = computed(() => ({
      url: unref(url),
      space: unref(unref(currentFileContext)?.space),
      resource: unref(resource),
      activeFiles: unref(activeFiles),
      isDirty: unref(isDirty),
      isReadOnly: unref(effectiveReadOnly),
      applicationConfig: unref(applicationConfig),
      currentFileContext: unref(currentFileContext),
      currentContent: unref(currentContent),
      isFolderLoading: unref(isFolderLoading),

      // Non-null by the time a collaborative app renders: `isLoading` covers the
      // session being synced and hydrated. Always null for other apps.
      ydoc: unref(yjsSession?.ydoc) ?? null,
      awareness: unref(yjsSession?.awareness) ?? null,
      yjsStatus: unref(yjsSession?.status) ?? null,

      'onUpdate:resource': (value: Resource) => {
        resource.value = value
        space.value = unref(unref(currentFileContext)?.space)
        selectedResources.value = [value]
      },
      'onUpdate:currentContent': (value: unknown) => {
        currentContent.value = value
      },

      onSave: save,
      onClose: closeApp,
      loadFolderForFileContext,
      revokeUrl,
      getUrlForResource
    }))

    return {
      ...useSideBar(),
      dropDownMenuSections,
      dropDownActionOptions: actionOptions,
      hasAutoSave,
      isEditor,
      closeApp,
      fileActions,
      loading,
      isLoading,
      loadingError,
      pageTitle,
      resource,
      space,
      slotAttrs,
      showNotFoundMessage
    }
  }
})
</script>
<style lang="scss">
@media (max-width: $oc-breakpoint-medium-default) {
  .app-sidebar-open > *:not(:last-child) {
    display: none;
  }
}

.app-wrapper {
  .app-wrapper-content {
    width: 100%;
  }

  .app-sidebar-open .app-wrapper-content {
    // 440px is the width of the app sidebar
    width: calc(100% - 440px);
  }
}
</style>
