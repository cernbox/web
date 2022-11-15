import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import Router from 'vue-router'
import { useTask } from 'vue-concurrency'
import { isLocationCommonActive } from '../../router'
import { Store } from 'vuex'
import path from 'path'

export class FolderLoaderBackups implements FolderLoader {
  public isEnabled(store: Store<any>): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    // console.log("route", this.$route.name)
    return (
      isLocationCommonActive(router, 'files-common-backups-me') ||
      isLocationCommonActive(router, 'files-common-backups-projects')
    )
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const { store, clientService } = context

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return useTask(function* (signal1, signal2) {
      store.commit('Files/CLEAR_CURRENT_FILES_LIST')

      const headers = new Headers()
      headers.append('Authorization', 'Bearer ' + store.getters['runtime/auth/accessToken'])
      headers.append('X-Requested-With', 'XMLHttpRequest')
      const response = yield fetch('cback/backups', {
        method: 'GET',
        headers
      })
      if (!response.ok) {
        const message = `An error has occured: ${response.status}`
        throw new Error(message)
      }
      const data = yield response.json()

      console.log('data', data)

      const res = data.map((r) => {
        return {
          name: path.basename(r),
          type: 'folder',
          path: r,
          canUpload: () => false,
          canDownload: () => false,
          id: r
        }
      })

      console.log('res', res)

      // const resources = [
      //   {
      //     id: 'eoshome-r!98959128',
      //     fileId: 'eoshome-r!98959128',
      //     storageId: 'eoshome-r',
      //     name: 'dev',
      //     extension: '',
      //     path: '/eos/user/r/ragozina/a/dev',
      //     webDavPath: '/files/ragozina/eos/user/r/ragozina/a/dev',
      //     type: 'folder',
      //     isFolder: true,
      //     mdate: 'Tue, 01 Nov 2022 13:44:21 GMT',
      //     size: '0',
      //     canRename: () => false,
      //     indicators: [
      //       {
      //         id: 'files-sharing-eoshome-r98959128',
      //         accessibleDescription:
      //           'This item is shared with others through one of the parent folders.',
      //         label: 'Show invited people',
      //         visible: true,
      //         icon: 'group',
      //         target: 'sharing-item',
      //         type: 'user-indirect'
      //       },
      //       {
      //         id: 'file-link-eoshome-r98959128',
      //         accessibleDescription:
      //           'This item is shared publicly through one of the parent folders.',
      //         label: 'Show links',
      //         visible: true,
      //         icon: 'link',
      //         target: 'sharing-item',
      //         type: 'link-indirect'
      //       }
      //     ],
      //     permissions: 'RDNVCK',
      //     starred: false,
      //     etag: '"5e5ff18:1667310261.038"',
      //     shareTypes: [],
      //     ownerId: 'ragozina',
      //     ownerDisplayName: 'Elizaveta Ragozina'
      //   }
      // ]

      store.commit('Files/LOAD_FILES', {
        currentFolder: null,
        files: res
      })
    })
  }
}
