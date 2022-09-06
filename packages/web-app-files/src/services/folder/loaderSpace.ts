import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import Router from 'vue-router'
import { useTask } from 'vue-concurrency'
import { Resource } from 'web-client'
import { isLocationPublicActive, isLocationSpacesActive } from '../../router'
import {
  useCapabilityFilesSharingResharing,
  useCapabilityShareJailEnabled,
  useCapabilitySpacesEnabled
} from 'web-pkg/src/composables'
import { getIndicators } from '../../helpers/statusIndicators'
import { SpaceResource } from 'web-client/src/helpers'
import { unref } from 'vue'
import { FolderLoaderOptions } from './types'
import { authService } from 'web-runtime/src/services/auth'
import { useFileRouteReplace } from 'web-pkg/src/composables/router/useFileRouteReplace'
import { aggregateResourceShares } from '../../helpers/resources'

export class FolderLoaderSpace implements FolderLoader {
  public isEnabled(): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    // TODO: remove next check when isLocationSpacesActive doesn't return true for generic route when being on projects overview.
    if (isLocationSpacesActive(router, 'files-spaces-projects')) {
      return false
    }
    return (
      isLocationSpacesActive(router, 'files-spaces-generic') ||
      isLocationPublicActive(router, 'files-public-link')
    )
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const {
      store,
      router,
      clientService: { owncloudSdk: client, webdav }
    } = context
    const { replaceInvalidFileRoute } = useFileRouteReplace({ router })
    const hasShareJail = useCapabilityShareJailEnabled(store)
    const hasResharing = useCapabilityFilesSharingResharing(store)
    const hasSpaces = useCapabilitySpacesEnabled(store)

    const getResourcesAndCurrent = async (
      resourcePromise: Promise<any>
    ): Promise<[Resource[], Resource]> => {
      const { resource: currentFolder, children: resources } = await resourcePromise
      return [resources, currentFolder]
    }

    return useTask(function* (
      signal1,
      signal2,
      space: SpaceResource,
      path: string = null,
      fileId: string | number = null,
      options: FolderLoaderOptions = {}
    ) {
      try {
        store.commit('Files/CLEAR_CURRENT_FILES_LIST')

        const resourcesPromise = webdav.listFiles(space, { path, fileId })

        // Re-use the passed path and fileid...
        let currentFolder = { path, fileId } as Resource
        let resources

        // ... but if any of these is null, just wait for the files list and
        // take them from there
        if (!currentFolder.path || !currentFolder.fileId) {
          ;[resources, currentFolder] = yield getResourcesAndCurrent(resourcesPromise)
        }

        if (path === '/') {
          if (space.driveType === 'share') {
            const parentShare = yield client.shares.getShare(space.shareId)
            const aggregatedShares = aggregateResourceShares(
              [parentShare.shareInfo],
              true,
              unref(hasResharing),
              true
            )
            currentFolder = aggregatedShares[0]
          } else if (!['personal', 'public'].includes(space.driveType)) {
            // note: in the future we might want to show the space as root for personal spaces as well (to show quota and the like). Currently not needed.
            currentFolder = space
          }
        }

        if (options.loadShares) {
          // If id based routing is enabled, we might have the wrong path at this point (since we used the passed params)
          // The backend will still give the proper output, since it also uses fileId as precedence, but the shares tree is wrong
          // But we will eventually redirect the user (bellow) to the correct path, so this call will just be ignored
          yield store.dispatch('Files/loadSharesTree', {
            client,
            path: currentFolder.path,
            ...(unref(hasSpaces) && { storageId: currentFolder.fileId }),
            includeRoot: currentFolder.path === '/' && space.driveType !== 'personal'
          })
        }

        // By now we haven't awaited for the file listing yet (unless the passed params were null)
        if (!resources) {
          ;[resources, currentFolder] = yield getResourcesAndCurrent(resourcesPromise)
        }
        replaceInvalidFileRoute({ space, resource: currentFolder, path, fileId })

        if (options.loadShares) {
          for (const file of resources) {
            file.indicators = getIndicators(file, store.state.Files.sharesTree, unref(hasShareJail))
          }
        }

        store.commit('Files/LOAD_FILES', {
          currentFolder,
          files: resources
        })
      } catch (error) {
        store.commit('Files/SET_CURRENT_FOLDER', null)
        console.error(error)

        if (error.statusCode === 401) {
          return authService.handleAuthError(router.currentRoute)
        }
      }
    }).restartable()
  }
}
