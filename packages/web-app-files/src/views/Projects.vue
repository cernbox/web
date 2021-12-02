<template>
  <div>
    <list-loader v-if="loading" />
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
        <oc-table-files
          v-else
          id="projects-table"
          v-model="selected"
          class="files-table"
          :class="{ 'files-table-squashed': isSidebarOpen }"
          :are-previews-displayed="displayPreviews"
          :resources="activeFiles"
          :target-route="targetRoute"
          :header-position="fileListHeaderY"
          @fileClick="$_fileActions_triggerDefaultAction"
          @rowMounted="rowMounted"
        >
          <template #status="{ resource }">
            <div
              :key="resource.id + resource.status"
              class="uk-text-nowrap uk-flex uk-flex-middle uk-flex-right"
            >
              <oc-button
                size="small"
                class="file-row-share-status-action"
                @click.stop="trashbin(resource)"
              >
                <oc-icon size="small" name="delete" />
                <translate>Trashbin</translate>
              </oc-button>
            </div>
          </template>
          <template #contextMenu="{ resource }">
            <context-actions v-if="isResourceInSelection(resource)" :items="selected" />
          </template>
        </oc-table-files>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions, mapMutations } from 'vuex'
import { shareStatus } from '../helpers/shareStatus'
import { aggregateResourceShares } from '../helpers/resources'

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
    ContextActions
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

      /* const data = {
        projects: [
          {
            name: 'cboxmacwin',
            path: '/eos/project/c/cboxmacwin',
            permissions: 'admin'
          },
          {
            name: 'cern-organization',
            path: '/eos/project/c/cern-organization',
            permissions: 'admin'
          }
        ]
      } */

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

    viewMode() {
      if (Object.prototype.hasOwnProperty.call(this.$route.query, 'view-mode')) {
        return parseInt(this.$route.query['view-mode'])
      }
      return shareStatus.accepted
    },
    groupingSettings() {
      return {
        groupingBy: 'Shared date',
        showGroupingOptions: true,
        groupingFunctions: {
          'Share owner': function (row) {
            return row.owner[0].displayName
          },
          'Name alphabetically': function (row) {
            if (!isNaN(row.name.charAt(0))) return '#'
            if (row.name.charAt(0) === '.') return row.name.charAt(1).toLowerCase()
            return row.name.charAt(0).toLowerCase()
          },
          'Shared date': function (row) {
            const interval1 = new Date()
            interval1.setDate(interval1.getDate() - 7)
            const interval2 = new Date()
            interval2.setDate(interval2.getDate() - 30)
            if (row.sdate > interval1.getTime()) {
              return 'Recent'
            } else if (row.sdate > interval2.getTime()) {
              return 'This Month'
            } else return 'Older'
          }
        },
        functionColMappings: {
          'Share owner': 'owner',
          'Shared date': 'sdate'
        }
      }
    },
    groupingSettingsPreview() {
      return {
        previewAmount: 3
      }
    },
    // pending shares
    pendingSelected: {
      get() {
        return this.selectedFiles.filter((r) => r.status === shareStatus.pending)
      },
      set(resources) {
        // this will (intentionally) reset the file selection to pending shares only.
        this.SET_FILE_SELECTION(resources.filter((r) => r.status === shareStatus.pending))
      }
    },
    pendingTitle() {
      return this.$gettext('Pending shares')
    },
    pendingHasMore() {
      return this.pendingCount > 3
    },
    pendingToggleMoreLabel() {
      return this.showMorePending ? this.$gettext('Show less') : this.$gettext('Show more')
    },
    hasPending() {
      return this.pendingCount > 0
    },
    pendingCount() {
      return this.pending.length
    },
    pending() {
      return this.activeFiles.filter((file) => file.status === shareStatus.pending)
    },

    // accepted or declined shares
    sharesSelected: {
      get() {
        return this.selectedFiles.filter((r) => r.status === this.viewMode)
      },
      set(resources) {
        // this will (intentionally) reset the file selection to shares for the current view mode only.
        this.SET_FILE_SELECTION(resources.filter((r) => r.status === this.viewMode))
      }
    },
    sharesTitle() {
      return this.viewMode === shareStatus.declined
        ? this.$gettext('Declined shares')
        : this.$gettext('Accepted shares')
    },
    sharesToggleLabel() {
      return this.viewMode === shareStatus.declined
        ? this.$gettext('Show accepted shares')
        : this.$gettext('Show declined shares')
    },
    sharesEmptyMessage() {
      return this.viewMode === shareStatus.declined
        ? this.$gettext("You don't have any previously declined shares.")
        : this.$gettext("You are not collaborating on other people's resources.")
    },
    hasShares() {
      return this.sharesCount > 0
    },
    sharesCount() {
      return this.shares.length
    },
    sharesCountFiles() {
      return this.shares.filter((s) => s.type !== 'folder').length
    },
    sharesCountFolders() {
      return this.shares.filter((s) => s.type === 'folder').length
    },
    shares() {
      return this.activeFiles.filter((file) => file.status === this.viewMode)
    },
    sharesOtherViewMode() {
      return this.viewMode === shareStatus.accepted ? shareStatus.declined : shareStatus.accepted
    },
    sharesToggleRouterLink() {
      return {
        name: this.$route.name,
        params: {
          ...this.$route.params
        },
        query: {
          ...this.$route.query,
          'view-mode': this.sharesOtherViewMode
        }
      }
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

    togglePendingShowMore() {
      this.showMorePending = !this.showMorePending
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
