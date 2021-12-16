<template>
  <div>
    <list-loader v-if="loadResourcesTask.isRunning" />
    <template v-else>
      <!-- Projects -->
      <div>
        <no-content-message
          v-if="isEmpty"
          id="files-shared-with-me-accepted-empty"
          class="files-empty"
          icon="group"
        >
          <template #message>
            <span v-translate> You are currently not collaborating on projects </span>
          </template>
        </no-content-message>
        <resource-table
          v-else
          id="projects-table"
          v-model="selected"
          class="files-table"
          :class="{ 'files-table-squashed': !sidebarClosed }"
          :are-thumbnails-displayed="displayThumbnails"
          :resources="activeFiles"
          :target-route="targetRoute"
          :header-position="fileListHeaderY"
          @fileClick="$_fileActions_triggerDefaultAction"
          @rowMounted="rowMounted"
        >
          <template #contextMenu="{ resource }">
            <context-actions v-if="isResourceInSelection(resource)" :items="selected" />
          </template>
        </resource-table>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions, mapMutations } from 'vuex'
import { shareStatus } from '../helpers/shareStatus'
import { aggregateResourceShares } from '../helpers/resources'
import ResourceTable from '../components/FilesList/ResourceTable.vue'

import FileActions from '../mixins/fileActions'
import MixinAcceptShare from '../mixins/actions/acceptShare'
import MixinDeclineShare from '../mixins/actions/declineShare'
import MixinFilesListFilter from '../mixins/filesListFilter'
import MixinMountSideBar from '../mixins/sidebar/mountSideBar'
import { VisibilityObserver } from 'web-pkg/src/observer'
import { ImageDimension, ImageType } from '../constants'
import { useFileListHeaderPosition } from '../composables'
import debounce from 'lodash-es/debounce'

import ListLoader from '../components/FilesList/ListLoader.vue'
import NoContentMessage from '../components/FilesList/NoContentMessage.vue'
import ContextActions from '../components/FilesList/ContextActions.vue'
import { useTask } from 'vue-concurrency'

const visibilityObserver = new VisibilityObserver()

export default {
  components: {
    ListLoader,
    NoContentMessage,
    ContextActions,
    ResourceTable
  },

  mixins: [
    FileActions,
    MixinAcceptShare,
    MixinDeclineShare,
    MixinMountSideBar,
    MixinFilesListFilter
  ],

  setup() {
    const { y: fileListHeaderY } = useFileListHeaderPosition()

    const loadResourcesTask = useTask(function* (signal, ref) {
      ref.CLEAR_CURRENT_FILES_LIST()

      const headers = new Headers()
      headers.append('Authorization', 'Bearer ' + ref.getToken)
      headers.append('X-Requested-With', 'XMLHttpRequest')
      const response = yield fetch('api/v0/projects', {
        method: 'GET',
        headers
      })
      if (!response.ok) {
        const message = `An error has occured: ${response.status}`
        throw new Error(message)
      }
      const data = yield response.json()

      // const data = {
      //   projects: [
      //     {
      //       name: 'cboxmacwin',
      //       path: '/eos/project/c/cboxmacwin',
      //       permissions: 'admin'
      //     },
      //     {
      //       name: 'cern-organization',
      //       path: '/eos/project/c/cern-organization',
      //       permissions: 'admin'
      //     }
      //   ]
      // }

      console.log('projects', data)
      const recievedResources = []
      if (data && data.projects) {
        data.projects.forEach((p, i) => {
          recievedResources.push({
            name: '/' + p.name.charAt(0) + '/' + p.name,
            id: i + p.name,
            type: 'dir',
            file_target: '/eos/project/' + p.name.charAt(0) + '/' + p.name,
            path: '/eos/project/' + p.name.charAt(0) + '/' + p.name,
            item_type: 'folder',
            mimetype: 'httpd/unix-directory',
            additional_info_file_owner: 'admin@example.org',
            additional_info_owner: 'admin@example.org',
            displayname_file_owner: 'Admin',
            displayname_owner: 'Admin',
            state: 2
          })
        })
      }
      let resources = []
      if (recievedResources.length) {
        resources = aggregateResourceShares(
          recievedResources,
          true,
          !ref.isOcis,
          ref.configuration.server,
          ref.getToken
        )
      }
      resources.forEach((r) => {
        delete r.owner
        delete r.share
        delete r.sdate
        delete r.status
      })

      ref.LOAD_FILES({ currentFolder: null, files: resources })
    })

    return { fileListHeaderY, loadResourcesTask }
  },

  data: () => ({
    shareStatus,
    showMorePending: false
  }),

  computed: {
    ...mapGetters('Files', ['activeFiles', 'selectedFiles']),
    ...mapGetters(['isOcis', 'configuration', 'getToken']),
    ...mapState('Files/sidebar', { sidebarClosed: 'closed' }),

    selected: {
      get() {
        return this.selectedFiles
      },
      set(resources) {
        this.SET_FILE_SELECTION(resources)
      }
    },
    isEmpty() {
      return this.activeFiles.length < 1
    },

    // misc
    targetRoute() {
      return { name: 'files-personal' }
    },
    displayThumbnails() {
      return !this.configuration.options.disablePreviews
    }
  },

  created() {
    this.loadResourcesTask.perform(this)
  },

  beforeDestroy() {
    visibilityObserver.disconnect()
  },

  methods: {
    ...mapActions('Files', ['loadIndicators', 'loadPreview', 'loadAvatars']),
    ...mapActions(['showMessage']),
    ...mapMutations('Files', [
      'LOAD_FILES',
      'SET_FILE_SELECTION',
      'CLEAR_CURRENT_FILES_LIST',
      'UPDATE_RESOURCE'
    ]),

    rowMounted(resource, component) {
      const debounced = debounce(({ unobserve }) => {
        unobserve()
        this.loadAvatars({ resource })

        if (!this.displayThumbnails) {
          return
        }

        this.loadPreview({
          resource,
          isPublic: false,
          dimensions: ImageDimension.Thumbnail,
          type: ImageType.Thumbnail
        })
      }, 250)

      visibilityObserver.observe(component.$el, {
        onEnter: debounced,
        onExit: debounced.cancel
      })
    },

    isResourceInSelection(resource) {
      return this.selected?.includes(resource)
    },
    trashbin(resource) {
      this.$router.push({
        path: '/files/list/trash-bin-project',
        query: { project: resource.path, name: resource.name }
      })
    }
  }
}
</script>

<style>
#files-shared-with-me-pending-table,
#files-shared-with-me-pending-table th {
  background-color: var(--oc-color-background-highlight);
}
</style>
