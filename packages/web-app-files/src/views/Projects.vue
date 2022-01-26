<template>
  <div class="oc-flex oc-flex-column">
    <list-loader v-if="loadResourcesTask.isRunning" />
    <template v-else>
      <no-content-message
        v-if="!hasShares"
        id="files-shared-with-me-shares-empty"
        class="files-empty oc-flex-stretch"
        icon="group"
      >
        <template #message>
          <span>{{ sharesEmptyMessage }}</span>
        </template>
      </no-content-message>
      <resource-table
        v-else
        id="files-shared-with-me-shares-table"
        v-model="selected"
        class="files-table"
        :class="{ 'files-table-squashed': !sidebarClosed }"
        :are-thumbnails-displayed="displayThumbnails"
        :resources="activeFiles"
        :are-resources-clickable="true"
        :target-route="resourceTargetLocation"
        :header-position="fileListHeaderY"
        :sort-by="sortBy"
        :sort-dir="sortDir"
        @fileClick="$_fileActions_triggerDefaultAction"
        @rowMounted="rowMounted"
        @sort="handleSort"
      >
        <template #contextMenu="{ resource }">
          <context-actions v-if="isResourceInSharesSelection(resource)" :items="selected" />
        </template>
      </resource-table>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions, mapMutations } from 'vuex'
import ResourceTable, { determineSortFields } from '../components/FilesList/ResourceTable.vue'
import { aggregateResourceShares } from '../helpers/resources'
import FileActions from '../mixins/fileActions'
import MixinFilesListFilter from '../mixins/filesListFilter'
import MixinMountSideBar from '../mixins/sidebar/mountSideBar'
import { VisibilityObserver } from 'web-pkg/src/observer'
import { ImageDimension, ImageType } from '../constants'
import { useFileListHeaderPosition, useSort } from '../composables'
import { useStore } from 'web-pkg/src/composables'
import debounce from 'lodash-es/debounce'

import ListLoader from '../components/FilesList/ListLoader.vue'
import NoContentMessage from '../components/FilesList/NoContentMessage.vue'
import ListInfo from '../components/FilesList/ListInfo.vue'
import ContextActions from '../components/FilesList/ContextActions.vue'
import { useTask } from 'vue-concurrency'
import { ShareStatus } from '../helpers/share'
import { computed, unref } from '@vue/composition-api'
import { createLocationSpaces } from '../router'

const visibilityObserver = new VisibilityObserver()

export default {
  components: {
    ResourceTable,
    ListLoader,
    NoContentMessage,
    ListInfo,
    ContextActions
  },

  mixins: [FileActions, MixinMountSideBar, MixinFilesListFilter],

  setup() {
    const store = useStore()
    const { y: fileListHeaderY } = useFileListHeaderPosition()
    const storeItems = computed(() => store.getters['Files/activeFiles'] || [])
    const fields = computed(() => {
      return determineSortFields(unref(storeItems)[0])
    })

    // shares depending on view mode
    const shares = computed(() => unref(storeItems))
    const {
      sortBy,
      sortDir,
      items: activeFiles,
      handleSort
    } = useSort({
      items: shares,
      fields,
      sortByQueryName: 'shares-sort-by',
      sortDirQueryName: 'shares-sort-dir'
    })

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
            state: 2,
            stime: 23233435
          })
        })
      }

      let resources = []

      try {
        if (recievedResources.length) {
          resources = aggregateResourceShares(
            recievedResources,
            true,
            !ref.isOcis,
            ref.configuration.server,
            ref.getToken
          )
        }
      } catch (error) {
        console.error(error)
        // expected output: ReferenceError: nonExistentFunction is not defined
        // Note - error messages will vary depending on browser
      }

      resources.forEach((r) => {
        delete r.owner
        delete r.share
        delete r.sdate
        delete r.status
      })

      ref.LOAD_FILES({ currentFolder: null, files: resources })
    })

    return {
      resourceTargetLocation: createLocationSpaces('files-spaces-personal-home'),
      fileListHeaderY,
      loadResourcesTask,
      handleSort,
      sortBy,
      sortDir,
      activeFiles
    }
  },

  data: () => ({
    ShareStatus,
    showMorePending: false
  }),

  computed: {
    ...mapGetters('Files', ['selectedFiles']),
    ...mapGetters(['isOcis', 'configuration', 'getToken']),
    ...mapState('Files/sidebar', { sidebarClosed: 'closed' }),

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

    // accepted or declined shares
    selected: {
      get() {
        return this.selectedFiles
      },
      set(resources) {
        // this will (intentionally) reset the file selection to shares for the current view mode only.
        this.SET_FILE_SELECTION(resources)
      }
    },

    sharesEmptyMessage() {
      return this.$gettext("You are not collaborating on other people's resources.")
    },
    hasShares() {
      return this.sharesCount > 0
    },
    sharesCount() {
      return this.activeFiles.length
    },
    sharesCountFiles() {
      return this.activeFiles.filter((s) => s.type !== 'folder').length
    },
    sharesCountFolders() {
      return this.activeFiles.filter((s) => s.type === 'folder').length
    },
    sharesToggleRouterLink() {
      return {
        name: this.$route.name,
        params: {
          ...this.$route.params
        },
        query: {
          ...this.$route.query
        }
      }
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
    ...mapMutations('Files', ['LOAD_FILES', 'SET_FILE_SELECTION', 'CLEAR_CURRENT_FILES_LIST']),

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

    isResourceInSharesSelection(resource) {
      return this.selected?.includes(resource)
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
