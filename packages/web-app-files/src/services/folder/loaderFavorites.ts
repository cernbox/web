import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { buildResource } from '@ownclouders/web-client'
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
        const needMountPointsToLoad = resources.results.some((resource) => {
          const spaceID = resource.props.fileid.split('!')[0]
          const spaceExists = spacesStore.spaces.some((space) => space.id === spaceID)
          return !spaceExists
        })
        if (needMountPointsToLoad) {
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
