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
          id="projects-table"
          v-model="selected"
          class="files-table"
          :class="{ 'files-table-squashed': isSidebarOpen }"
          :are-previews-displayed="displayPreviews"
          :are-paths-displayed="true"
          :resources="activeFiles"
          :target-route="targetRoute"
          :highlighted="highlightedFile ? highlightedFile.id : null"
          :header-position="headerPosition"
          @showDetails="setHighlightedFile"
          @fileClick="$_fileActions_triggerDefaultAction"
          @rowMounted="rowMounted"
        >
        </oc-table-files>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions, mapMutations } from 'vuex'
import { buildResource } from '../helpers/resources'

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
      console.log('project after mapping', this.activeFiles)
      return this.activeFiles.length < 1
    },

    isSidebarOpen() {
      return this.highlightedFile !== null
    },

    uploadProgressVisible() {
      return this.inProgress.length > 0
    },

    targetRoute() {
      return { name: this.$route.name }
    },

    displayPreviews() {
      return !this.configuration.options.disablePreviews
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

    loadResources() {
      this.loading = false
      this.CLEAR_CURRENT_FILES_LIST()
      fetch('api/v0/projects')
        .then(response => {
          response.json()
        })
        .then(data => {
          /* Data from the backend */
          if (data.length > 0) {
            let resources = data.forEach((p, i) => {
              p.id = i + p.name
              p.type = 'dir'
              p.fileInfo = {
                '{http://owncloud.org/ns}permissions': 'RDNVCK',
                '{http://owncloud.org/ns}favorite': '0',
                '{http://owncloud.org/ns}fileid': i + p.name,
                '{http://owncloud.org/ns}owner-id': 'einstein',
                '{http://owncloud.org/ns}owner-display-name': 'Albert Einstein',
                '{DAV:}getetag': '"ac531ba650fd4912447b22fa5d66c600"',
                '{DAV:}resourcetype': ['{DAV:}collection']
              }
              p.tusSupport = {
                version: ['1.0.0'],
                extension: ['creation', 'creation-with-upload'],
                resumable: '1.0.0'
              }
            })

            resources = resources.map(buildResource)

            this.LOAD_FILES({
              currentFolder: null,
              files: resources
            })

            this.LOAD_FILES({ currentFolder: null, files: resources })
          }
          this.loading = false
        })
        .catch(err => {
          console.log(err)
          this.loading = false
        })

      /* For testing locally if no projects in the backend */
      const recievedResources = [
        {
          name: '/example',
          path: '/eos/project/e/example',
          permissions: 'admin'
        },
        { name: '/fdo', path: '/eos/project/f/fdo', permissions: 'writer' }
      ]

      let resources = []

      recievedResources.forEach((p, i) => {
        resources.push({
          id: i + p.name,
          name: p.name,
          type: 'dir',
          fileInfo: {
            '{http://owncloud.org/ns}permissions': 'RDNVCK',

            '{http://owncloud.org/ns}fileid': i + p.name,
            '{http://owncloud.org/ns}owner-id': 'einstein',
            '{http://owncloud.org/ns}owner-display-name': 'Albert Einstein',
            '{http://owncloud.org/ns}size': '0',
            '{DAV:}getlastmodified': 'Tue, 06 Jul 2021 13:46:50 GMT',
            '{DAV:}resourcetype': ['{DAV:}collection']
          }
        })
      })

      console.log('project data from api', resources)
      resources = resources.map(buildResource)
      this.LOAD_FILES({
        currentFolder: null,
        files: resources
      })

      this.LOAD_FILES({ currentFolder: null, files: resources })

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
