<template>
  <div>
    <list-loader v-if="loading" />
    <template v-else>
      <!-- Projects -->
      <div>
        <div class="oc-app-bar shares-bar">
          <h2 key="accepted-shares-header" v-translate>Projects</h2>
        </div>
        <no-content-message
          v-if="isEmpty"
          id="files-shared-with-me-accepted-empty"
          class="files-empty"
          icon="group"
        >
          <template #message>
            <span v-translate>
              You are currently not collaborating on projects
            </span>
          </template>
        </no-content-message>
        <oc-table-files
          v-else
          id="files-shared-with-me-accepted-table"
          v-model="selected"
          class="files-table"
          :class="{ 'files-table-squashed': isSidebarOpen }"
          :are-previews-displayed="displayPreviews"
          :resources="resources"
          :target-route="targetRoute"
          :highlighted="highlightedFile ? highlightedFile.id : null"
          :header-position="headerPosition"
          @showDetails="setHighlightedFile"
          @fileClick="$_fileActions_triggerDefaultAction"
        >
        </oc-table-files>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions, mapMutations } from 'vuex'
import { shareStatus } from '../helpers/shareStatus'
import { buildResource, aggregateResourceShares, buildSharedResource } from '../helpers/resources'

import FileActions from '../mixins/fileActions'
import MixinFilesListPositioning from '../mixins/filesListPositioning'
import MixinFilesListPagination from '../mixins/filesListPagination'

import ListLoader from '../components/FilesList/ListLoader.vue'
import NoContentMessage from '../components/FilesList/NoContentMessage.vue'
import ListInfo from '../components/FilesList/ListInfo.vue'
import { VisibilityObserver } from 'web-pkg/src/observer'
import { ImageDimension } from '../constants'
import debounce from 'lodash-es/debounce'

const visibilityObserver = new VisibilityObserver()

export default {
  components: { ListLoader, NoContentMessage, ListInfo },

  mixins: [FileActions, MixinFilesListPositioning, MixinFilesListPagination],

  data: () => ({
    loading: true
  }),

  computed: {
    ...mapState(['app']),
    ...mapState('Files', ['currentPage', 'files']),
    ...mapGetters('Files', [
      'davProperties',
      'highlightedFile',
      'activeFiles',
      'selectedFiles',
      'inProgress',
      'totalFilesCount',
      'pages',
      'activeFilesCount'
    ]),
    ...mapGetters(['isOcis', 'configuration', 'getToken', 'user']),

    selected: {
      get() {
        return this.selectedFiles
      },
      set(resources) {
        this.SELECT_RESOURCES(resources)
      }
    },
    isEmpty() {
      return this.resources.length < 1
    },

    isSidebarOpen() {
      return this.highlightedFile !== null
    },

    uploadProgressVisible() {
      return this.inProgress.length > 0
    },

    targetRoute() {
      return { name: 'projects' }
    },

    displayPreviews() {
      return !this.configuration.options.disablePreviews
    },

    resources() {
      return [
        {
          id: 'Project1',
          name: 'Project1',
          path: '/Docs',
          icon: 'folder',
          indicators: [],
          type: 'folder'
        },
        {
          id: 'Project2',
          name: 'Project2',
          path: '/Pic',
          icon: 'folder',
          indicators: [],
          type: 'folder'
        }
      ]
    }
  },

  watch: {
    uploadProgressVisible() {
      this.adjustTableHeaderPosition()
    },
    $route: {
      handler: '$_filesListPagination_updateCurrentPage',
      immediate: true
    }
  },

  created() {
    this.loadResources()
    window.onresize = this.adjustTableHeaderPosition
  },

  mounted() {
    this.adjustTableHeaderPosition()
  },

  beforeDestroy() {
    visibilityObserver.disconnect()
  },

  methods: {
    ...mapActions('Files', ['setHighlightedFile', 'loadIndicators', 'loadPreview', 'loadAvatars']),
    ...mapActions(['showMessage']),
    ...mapMutations('Files', [
      'LOAD_FILES',
      'SELECT_RESOURCES',
      'CLEAR_CURRENT_FILES_LIST',
      'UPDATE_RESOURCE'
    ]),
    ...mapMutations(['SET_QUOTA']),

    rowMounted(resource, component) {
      const debounced = debounce(({ unobserve }) => {
        unobserve()
        this.loadAvatars({ resource })

        if (!this.displayPreviews) {
          return
        }

        this.loadPreview({
          resource,
          isPublic: false,
          dimensions: ImageDimension.ThumbNail
        })
      }, 250)

      visibilityObserver.observe(component.$el, { onEnter: debounced, onExit: debounced.cancel })
    },

    async loadResources() {
      this.loading = true
      this.CLEAR_CURRENT_FILES_LIST()

      try {
        let resources = await this.$client.files.list(
          this.$route.params.item,
          1,
          this.davProperties
        )
        console.log(resources[0])
        resources = resources.map(buildResource)
        console.log(resources[0])
        resources = [
          [
            {
              id: 'fjsiefjasldkas',
              fileId: 'fjsiefjasldkas',
              name: 'awesomeproject',
              type: 'folder',
              path: '/eos/project/a/awesomeproject',
              permissions: 'admin',
              icon: 'folder'
            },
            {
              id: 'sifijskd',
              fileId: 'sifijskd',
              name: 'awesomeproject8',
              type: 'folder',
              path: '/eos/project/a/awesomeproject8',
              permissions: 'reader',
              icon: 'folder'
            },
            {
              id: 'sfisjf',
              fileId: 'sfisjf',
              name: 'storage-ci',
              type: 'folder',
              path: '/eos/project/s/storage-ci',
              permissions: 'writer',
              icon: 'folder'
            }
          ]
        ]
        this.LOAD_FILES({
          currentFolder: resources[0],
          files: resources.slice(1)
        })
        this.loadIndicators({
          client: this.$client,
          currentFolder: this.$route.params.item
        })

        // Load quota
        const user = await this.$client.users.getUser(this.user.id)

        this.SET_QUOTA(user.quota)
      } catch (error) {
        this.SET_CURRENT_FOLDER(null)
        console.error(error)
      }

      this.adjustTableHeaderPosition()
      this.loading = false
    }
  }
}
</script>

<style>
.centered {
  display: flex;
  flex-direction: row;
  justify-content: center;
}
.shares-bar {
  display: flex;
  flex-direction: row;
  align-items: baseline;
}
#pending-highlight {
  background-color: var(--oc-color-background-highlight);
}
.show-hide-pending {
  text-align: center;
}
</style>
