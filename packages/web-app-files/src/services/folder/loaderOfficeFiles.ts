import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { buildResource } from '@ownclouders/web-client'
import { isLocationCommonActive } from '@ownclouders/web-pkg'

export class FolderLoaderOfficeFiles implements FolderLoader {
  public isEnabled(): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    return isLocationCommonActive(router, 'files-common-office')
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const { resourcesStore, clientService, spacesStore } = context

    return useTask(function* (signal1, signal2, fileExtension, projectName) {
      resourcesStore.clearResourceList()
      resourcesStore.setAncestorMetaData({})

      let resources = yield clientService.webdav.listOfficeFiles({
        spaceID: spacesStore.personalSpace.id,
        signal: signal1,
        fileExtension,
        projectName
      })

      resources = resources.results.map(buildResource)
      resourcesStore.initResourceList({ currentFolder: null, resources })
    })
  }
}
