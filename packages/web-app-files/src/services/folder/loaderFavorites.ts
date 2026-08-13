import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { buildResource, WebDavResponseResource } from '@ownclouders/web-client'
import { isLocationCommonActive } from '@ownclouders/web-pkg'

export class FolderLoaderFavorites implements FolderLoader {
  public isEnabled(): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    return isLocationCommonActive(router, 'files-common-favorites')
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const { resourcesStore, clientService, spacesStore, configStore } = context

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return useTask(function* (signal1, signal2) {
      resourcesStore.clearResourceList()
      resourcesStore.setAncestorMetaData({})

      let resources = yield clientService.webdav.listFavoriteFiles({
        spaceID: spacesStore.personalSpace.id,
        signal: signal1
      })

      if (configStore.options.routing.fullShareOwnerPaths) {
        const hasUnknownSpaces = () =>
          resources.results.some((resource: WebDavResponseResource) => {
            const spaceID = resource.props.fileid.split('!')[0]
            return !spacesStore.spaces.some((space) => space.id === spaceID)
          })

        // favourites can live in any space, and drive types are loaded on demand. Project spaces
        // are the cheaper and far more likely home, so resolve those before paying for the mount
        // point listing - which frequently isn't needed at all.
        if (hasUnknownSpaces()) {
          yield spacesStore.loadSpacesByType('project', {
            graphClient: clientService.graphAuthenticated,
            signal: signal1
          })
        }

        if (hasUnknownSpaces()) {
          // left unawaited, as before: the list renders now and the space labels fill in once
          // the mount points arrive
          spacesStore.loadMountPoints({
            graphClient: clientService.graphAuthenticated,
            signal: signal1
          })
        }
      }

      resources = resources.results.map(buildResource)
      resourcesStore.initResourceList({ currentFolder: null, resources })
    })
  }
}
