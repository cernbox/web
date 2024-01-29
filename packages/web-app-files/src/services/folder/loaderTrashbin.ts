import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { DavProperties } from 'web-client/src/webdav/constants'
import { isLocationTrashActive } from '../../router'
import { buildDeletedResource, buildWebDavFilesTrashPath } from '../../helpers/resources'
import { Store } from 'vuex'
import { Resource } from 'web-client'
import { useCapabilityShareJailEnabled } from 'web-pkg/src/composables'
import { unref } from 'vue'
import { buildResource, buildWebDavSpacesTrashPath } from 'web-client/src/helpers'

export class FolderLoaderTrashbin implements FolderLoader {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public isEnabled(store: Store<any>): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    return isLocationTrashActive(router, 'files-trash-generic')
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const {
      store,
      clientService: { owncloudSdk: client }
    } = context
    const hasShareJail = useCapabilityShareJailEnabled(store)

    return useTask(function* (signal1, signal2, space: Resource, dateFilter, projectName) {
      store.commit('Files/CLEAR_CURRENT_FILES_LIST')
      store.commit('Files/SET_RECYCLE_ERROR', false)

      // const path = unref(hasShareJail)
      //   ? buildWebDavSpacesTrashPath(space.id)
      //   : buildWebDavFilesTrashPath(space.id)
      const path = buildWebDavFilesTrashPath(space.id) //user.id
      let query = projectName ? { base_path: `/eos/project/${projectName[0]}/${projectName}` } : {}
      if (dateFilter.value) {
        query = { ...query, ...unref(dateFilter) }
      }
      let resources
      try {

        resources = yield client.fileTrash.list(path, '1', DavProperties.Trashbin, query)
      } catch (e) {
        if (e.statusCode === 400) {
          store.commit('Files/SET_RECYCLE_ERROR', true)
        }
        throw e
      }

      store.commit('Files/LOAD_FILES', {
        currentFolder: buildResource(resources[0]),
        files: resources.slice(1).map(buildDeletedResource)
      })
    })
  }
}
