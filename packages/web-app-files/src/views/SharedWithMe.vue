<template>
  <div>
    <list-loader v-if="loading" />
    <template v-else>
      <!-- Pending shares: show always -->
      <div id="pending-shares" v-if="filterDataByStatus(activeFiles, 1).length > 0">
        <div class="oc-app-bar" style="display: flex; flex-direction: row; align-items: baseline">
          <h4>Pending Shares</h4>
          <a
            v-if="filterDataByStatus(activeFiles, 0).length === 0 && !getShowDeclined()"
            @click="setShowDeclined(true)"
            style="padding-left: 24px; margin: 0 0 20px"
            >Show declined shares</a
          >
        </div>

        <div style="background-color: aliceblue">
          <oc-table-files
            id="files-shared-with-me-table"
            v-model="selected"
            class="files-table"
            :class="{ 'files-table-squashed': isSidebarOpen }"
            :are-previews-displayed="displayPreviews"
            :resources="
              getShowAllPending() === false
                ? filterDataByStatus(activeFiles, 1).slice(0, 3)
                : filterDataByStatus(activeFiles, 1)
            "
            :target-route="targetRoute"
            :highlighted="highlightedFile ? highlightedFile.id : null"
            :header-position="headerPosition"
            @showDetails="setHighlightedFile"
            @fileClick="$_fileActions_triggerDefaultAction"
          >
            <template v-slot:status="{ resource }">
              <div
                :key="resource.id + resource.status"
                class="uk-text-nowrap uk-flex uk-flex-middle uk-flex-right"
              >
                <oc-button
                  v-if="resource.status === 1 || resource.status === 2"
                  appearance="raw"
                  class="file-row-share-status-action uk-text-meta"
                  @click.stop="triggerShareAction(resource, 'POST')"
                  style="color: #347235"
                >
                  <translate>Accept</translate>
                </oc-button>
                <oc-button
                  v-if="resource.status === 1 || resource.status === 0"
                  appearance="raw"
                  class="file-row-share-status-action uk-text-meta oc-ml"
                  @click.stop="triggerShareAction(resource, 'DELETE')"
                >
                  <translate>Decline</translate>
                </oc-button>
                <span
                  class="uk-text-small oc-ml file-row-share-status-text uk-text-baseline"
                  v-text="getShareStatusText(resource.status)"
                />
              </div>
            </template>
          </oc-table-files>

          <!-- <expander
              :aria-label="$gettext('Show all')"
              :is-show-all="true"
              @click="setShowAllPending(true)"
            >
              <translate translate-context="Name column in files table">Show all</translate>
            </expander>-->
          <div
            class="oc-app-bar"
            v-if="getShowAllPending() === false && filterDataByStatus(activeFiles, 1).length > 3"
            style="text-align: center"
          >
            <a @click="setShowAllPending(true)" style="text-align: center; padding-bottom: 12px">
              Show all</a
            >
          </div>

          <div
            class="oc-app-bar"
            v-else-if="
              getShowAllPending() === true && filterDataByStatus(activeFiles, 1).length > 3
            "
            style="text-align: center"
          >
            <a @click="setShowAllPending(false)" style="text-align: center; padding-bottom: 12px">
              Show less
            </a>
          </div>
        </div>
      </div>
      <br />

      <!-- Accepted shares -->
      <div v-if="!getShowDeclined()">
        <div
          v-if="filterDataByStatus(activeFiles, 0).length > 0"
          class="oc-app-bar"
          style="display: flex; flex-direction: row; align-items: baseline"
        >
          <h4>Accepted Shares</h4>

          <a @click="setShowDeclined(true)" style="padding-left: 24px; margin: 0 0 20px"
            >Show declined shares</a
          >
        </div>
        <no-content-message
          v-if="isEmpty"
          id="files-shared-with-me-empty"
          class="files-empty"
          icon="group"
        >
          <template #message>
            <span v-translate>
              You are currently not collaborating on other people's resources
            </span>
          </template>
        </no-content-message>
        <oc-table-files
          v-else
          id="files-shared-with-me-table"
          v-model="selected"
          class="files-table"
          :class="{ 'files-table-squashed': isSidebarOpen }"
          :are-previews-displayed="displayPreviews"
          :resources="filterDataByStatus(activeFiles, 0)"
          :target-route="targetRoute"
          :highlighted="highlightedFile ? highlightedFile.id : null"
          :header-position="headerPosition"
          @showDetails="setHighlightedFile"
          @fileClick="$_fileActions_triggerDefaultAction"
        >
          <template v-slot:status="{ resource }">
            <div
              :key="resource.id + resource.status"
              class="uk-text-nowrap uk-flex uk-flex-middle uk-flex-right"
            >
              <oc-button
                v-if="resource.status === 1 || resource.status === 2"
                appearance="raw"
                class="file-row-share-status-action uk-text-meta"
                @click.stop="triggerShareAction(resource, 'POST')"
              >
                <translate>Accept</translate>
              </oc-button>
              <oc-button
                v-if="resource.status === 1 || resource.status === 0"
                appearance="raw"
                class="file-row-share-status-action uk-text-meta oc-ml"
                @click.stop="triggerShareAction(resource, 'DELETE')"
              >
                <translate>Decline</translate>
              </oc-button>
              <span
                class="uk-text-small oc-ml file-row-share-status-text uk-text-baseline"
                v-text="getShareStatusText(resource.status)"
              />
            </div>
          </template>
          <!-- <template #footer>
            <div
              v-if="activeFilesCount.folders > 0 || activeFilesCount.files > 0"
              class="uk-text-nowrap uk-text-meta uk-text-center uk-width-1-1"
            >
              <span id="files-list-count-folders" v-text="activeFilesCount.folders" />
              <translate :translate-n="activeFilesCount.folders" translate-plural="folders"
                >folder</translate
              >
              <translate>and</translate>
              <span id="files-list-count-files" v-text="activeFilesCount.files" />
              <translate :translate-n="activeFilesCount.files" translate-plural="files"
                >file</translate
              >
            </div>
          </template>-->
        </oc-table-files>
      </div>

      <!-- Declined shares -->
      <div v-if="getShowDeclined()">
        <div class="oc-app-bar" style="display: flex; flex-direction: row; align-items: baseline">
          <h4>Declined Shares</h4>

          <a @click="setShowDeclined(false)" style="padding-left: 24px; margin: 0 0 20px"
            >Show my shares</a
          >
        </div>
        <no-content-message
          v-if="isEmpty"
          id="files-shared-with-me-empty"
          class="files-empty"
          icon="group"
        >
          <template #message>
            <span v-translate> No declined files found </span>
          </template>
        </no-content-message>
        <oc-table-files
          v-else
          id="files-shared-with-me-table"
          v-model="selected"
          class="files-table"
          :class="{ 'files-table-squashed': isSidebarOpen }"
          :are-previews-displayed="displayPreviews"
          :resources="filterDataByStatus(activeFiles, 2)"
          :target-route="targetRoute"
          :highlighted="highlightedFile ? highlightedFile.id : null"
          :header-position="headerPosition"
          @showDetails="setHighlightedFile"
          @fileClick="$_fileActions_triggerDefaultAction"
        >
          <template v-slot:status="{ resource }">
            <div
              :key="resource.id + resource.status"
              class="uk-text-nowrap uk-flex uk-flex-middle uk-flex-right"
            >
              <oc-button
                v-if="resource.status === 1 || resource.status === 2"
                appearance="raw"
                class="file-row-share-status-action uk-text-meta"
                @click.stop="triggerShareAction(resource, 'POST')"
              >
                <translate>Accept</translate>
              </oc-button>
              <oc-button
                v-if="resource.status === 1 || resource.status === 0"
                appearance="raw"
                class="file-row-share-status-action uk-text-meta oc-ml"
                @click.stop="triggerShareAction(resource, 'DELETE')"
              >
                <translate>Decline</translate>
              </oc-button>
              <span
                class="uk-text-small oc-ml file-row-share-status-text uk-text-baseline"
                v-text="getShareStatusText(resource.status)"
              />
            </div>
          </template>
          <!-- <template #footer>
            <div
              v-if="activeFilesCount.folders > 0 || activeFilesCount.files > 0"
              class="uk-text-nowrap uk-text-meta uk-text-center uk-width-1-1"
            >
              <span id="files-list-count-folders" v-text="activeFilesCount.folders" />
              <translate :translate-n="activeFilesCount.folders" translate-plural="folders"
                >folder</translate
              >
              <translate>and</translate>
              <span id="files-list-count-files" v-text="activeFilesCount.files" />
              <translate :translate-n="activeFilesCount.files" translate-plural="files"
                >file</translate
              >
            </div>
          </template>-->
        </oc-table-files>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions, mapMutations } from 'vuex'
import { shareStatus } from '../helpers/shareStatus'
import { aggregateResourceShares, buildResource, buildSharedResource } from '../helpers/resources'
import FileActions from '../mixins/fileActions'
import MixinFilesListPositioning from '../mixins/filesListPositioning'

import ListLoader from '../components/ListLoader.vue'
import NoContentMessage from '../components/NoContentMessage.vue'

let showDeclined = false
let showAllPending = false

export default {
  components: { ListLoader, NoContentMessage },

  mixins: [FileActions, MixinFilesListPositioning],

  data: () => ({
    loading: true,
  }),

  computed: {
    ...mapState(['app']),
    ...mapGetters('Files', [
      'davProperties',
      'highlightedFile',
      'activeFiles',
      'selectedFiles',
      'inProgress',
      'activeFilesCount',
    ]),
    ...mapGetters(['isOcis', 'configuration', 'getToken', 'user']),

    selected: {
      get() {
        return this.selectedFiles
      },
      set(resources) {
        this.SELECT_RESOURCES(resources)
      },
    },

    isEmpty() {
      return this.activeFiles.length < 1
    },

    isSidebarOpen() {
      return this.highlightedFile !== null
    },

    uploadProgressVisible() {
      return this.inProgress.length > 0
    },

    targetRoute() {
      return { name: 'files-personal' }
    },

    displayPreviews() {
      return !this.configuration.options.disablePreviews
    },
  },

  watch: {
    uploadProgressVisible() {
      this.adjustTableHeaderPosition()
    },
  },

  created() {
    this.loadResources()
    window.onresize = this.adjustTableHeaderPosition
  },

  mounted() {
    this.adjustTableHeaderPosition()
  },

  methods: {
    ...mapActions('Files', ['setHighlightedFile', 'loadIndicators', 'loadPreviews']),
    ...mapActions(['showMessage']),
    ...mapMutations('Files', [
      'LOAD_FILES',
      'SELECT_RESOURCES',
      'CLEAR_CURRENT_FILES_LIST',
      'UPDATE_RESOURCE',
    ]),
    ...mapMutations(['SET_QUOTA']),

    setShowDeclined(value) {
      showDeclined = value
      this.$forceUpdate()
    },

    getShowDeclined() {
      return showDeclined
    },

    setShowAllPending(value) {
      showAllPending = value
      this.$forceUpdate()
    },

    getShowAllPending() {
      console.log('show all?', showAllPending, this.filterDataByStatus(this.activeFiles, 1))
      return showAllPending
    },

    filterDataByStatus(data, status) {
      return data.filter((item) => item.status === status)
        ? data.filter((item) => item.status === status)
        : []
    },

    async loadResources() {
      this.loading = true
      this.CLEAR_CURRENT_FILES_LIST()

      let resources = await this.$client.requests.ocs({
        service: 'apps/files_sharing',
        action: '/api/v1/shares?format=json&shared_with_me=true&state=all&include_tags=false',
        method: 'GET',
      })
      let rootFolder = await this.$client.files.fileInfo('/', this.davProperties)

      resources = await resources.json()
      resources = resources.ocs.data
      rootFolder = buildResource(rootFolder)

      if (resources.length < 1) {
        this.LOAD_FILES({ currentFolder: rootFolder, files: [] })
        this.loading = false

        return
      }

      resources = await aggregateResourceShares(
        resources,
        true,
        !this.isOcis,
        this.configuration.server,
        this.getToken
      )

      this.LOAD_FILES({ currentFolder: rootFolder, files: resources })

      if (this.displayPreviews) {
        await this.loadPreviews({
          resources,
          isPublic: false,
          mediaSource: this.mediaSource,
          encodePath: this.encodePath,
          headers: this.requestHeaders,
        })
      }

      // Load quota
      const user = await this.$client.users.getUser(this.user.id)

      this.SET_QUOTA(user.quota)
      this.loading = false
    },

    getShareStatusText(status) {
      switch (status) {
        case shareStatus.accepted:
          return this.$gettext('Accepted')
        case shareStatus.declined:
          return this.$gettext('Declined')
        case shareStatus.pending:
        default:
          return this.$gettext('Pending')
      }
    },

    async triggerShareAction(resource, type) {
      try {
        let response = await this.$client.requests.ocs({
          service: 'apps/files_sharing',
          action: `api/v1/shares/pending/${resource.share.id}`,
          method: type,
        })
        response = await response.json()
        if (response.ocs.data && response.ocs.data.length > 0) {
          const sharedResource = await buildSharedResource(
            response.ocs.data[0],
            true,
            !this.isOcis,
            this.configuration.server,
            this.getToken
          )
          this.UPDATE_RESOURCE(sharedResource)
          this.loadResources()
        }
      } catch (error) {
        this.loadResources()
        this.showMessage({
          title: this.$gettext('Error while changing share state'),
          desc: error.message,
          status: 'danger',
          autoClose: {
            enabled: true,
          },
        })
      }
    },
  },
}
</script>
