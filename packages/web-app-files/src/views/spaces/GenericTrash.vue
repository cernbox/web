<template>
  <div class="oc-flex oc-width-1-1">
    <files-view-wrapper>
      <app-bar
        :breadcrumbs="breadcrumbs"
        :has-bulk-actions="true"
        :side-bar-open="sideBarOpen"
        :space="space"
      />
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <no-content-message
          v-if="isEmpty"
          id="files-trashbin-empty"
          class="files-empty"
          icon="delete-bin-5"
        >
          <template #message>
            <span>{{ noContentMessage }}</span>
          </template>
        </no-content-message>
        <resource-table
          v-else
          id="files-trashbin-table"
          v-model="selectedResourcesIds"
          class="files-table"
          :class="{ 'files-table-squashed': sideBarOpen }"
          :fields-displayed="['name', 'ddate']"
          :are-paths-displayed="true"
          :are-thumbnails-displayed="false"
          :resources="paginatedResources"
          :are-resources-clickable="false"
          :header-position="fileListHeaderY"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :space="space"
          :has-actions="showActions"
          @sort="handleSort"
        >
          <template #contextMenu="{ resource }">
            <context-actions
              v-if="isResourceInSelection(resource)"
              :items="selectedResources"
              :space="space"
            />
          </template>
          <template #footer>
            <pagination :pages="paginationPages" :current-page="paginationPage" />
            <list-info
              v-if="paginatedResources.length > 0"
              class="oc-width-1-1 oc-my-s"
              :files="totalFilesCount.files"
              :folders="totalFilesCount.folders"
            />
          </template>
        </resource-table>
      </template>
    </files-view-wrapper>
    <side-bar :open="sideBarOpen" :active-panel="sideBarActivePanel" :space="space" />
  </div>
</template>

<script lang="ts">
import { mapGetters, mapState } from 'vuex'

import AppBar from '../../components/AppBar/AppBar.vue'
import ContextActions from '../../components/FilesList/ContextActions.vue'
import FilesViewWrapper from '../../components/FilesViewWrapper.vue'
import ListInfo from '../../components/FilesList/ListInfo.vue'
import Pagination from '../../components/FilesList/Pagination.vue'
import ResourceTable from '../../components/FilesList/ResourceTable.vue'
import SideBar from '../../components/SideBar/SideBar.vue'
import AppLoadingSpinner from 'web-pkg/src/components/AppLoadingSpinner.vue'
import NoContentMessage from 'web-pkg/src/components/NoContentMessage.vue'

import { eventBus } from 'web-pkg/src/services/eventBus'
import { useResourcesViewDefaults } from '../../composables'
import { computed, defineComponent, PropType, unref } from 'vue'
import { Resource } from 'web-client'
import {
  useCapabilityShareJailEnabled,
  useCapabilitySpacesEnabled,
  useTranslations
} from 'web-pkg/src/composables'
import { createLocationTrash, createLocationSpaces } from '../../router'
import { isProjectSpaceResource, SpaceResource } from 'web-client/src/helpers'
import { useDocumentTitle } from 'web-pkg/src/composables/appDefaults/useDocumentTitle'
import { createFileRouteOptions } from 'web-pkg/src/helpers/router'

export default defineComponent({
  name: 'GenericTrash',

  components: {
    AppBar,
    AppLoadingSpinner,
    ContextActions,
    FilesViewWrapper,
    ListInfo,
    NoContentMessage,
    Pagination,
    ResourceTable,
    SideBar
  },

  props: {
    space: {
      type: Object as PropType<SpaceResource>,
      required: false,
      default: null
    },
    itemId: {
      type: [String, Number],
      required: false,
      default: null
    }
  },

  setup(props) {
    const { $gettext } = useTranslations()
    const noContentMessage = computed(() => {
      return $gettext('There are no deleted files')
    })

    const hasSpaces = useCapabilitySpacesEnabled()
    const titleSegments = computed(() => {
      const segments = [$gettext('Deleted files')]
      if (unref(hasSpaces)) {
        segments.unshift(props.space.name)
      }
      return segments
    })
    useDocumentTitle({ titleSegments })

    return {
      ...useResourcesViewDefaults<Resource, any, any[]>(),
      hasShareJail: useCapabilityShareJailEnabled(),
      noContentMessage
    }
  },

  computed: {
    ...mapState('Files', ['files']),
    ...mapGetters('Files', ['highlightedFile', 'totalFilesCount']),
    ...mapGetters(['user']),

    isEmpty() {
      return this.paginatedResources.length < 1
    },

    projectName() {
      const path = this.$router.currentRoute.params.driveAliasAndItem || ''
      const re = /eos\/project\/[a-z]\/([a-z0-9\-]+)/i
      const found = path.match(re)
      return found ? found[1] : undefined
    },

    breadcrumbs() {
      /*
      let allowContextActions = true
      let currentNodeName = this.space?.name
      if (this.space.driveType === 'personal') {
        currentNodeName = this.hasShareJail ? this.$gettext('Personal') : this.$gettext('All files')
        allowContextActions = false
      }
      return [
        {
          text: this.$gettext('Deleted files'),
          to: createLocationTrash('files-trash-generic') // FIXME: UX of clicking `Deleted files` and being redirected to personal trash is wrong.
        },
        {
          allowContextActions,
          text: currentNodeName,
          onClick: () => eventBus.publish('app.files.list.load')
        }
      ]
      */

        return [
          {
            text: this.$gettext('Deleted files'),
            to: createLocationTrash('files-trash-generic', createFileRouteOptions(this.space, {
            path: '/eos'
          }))
          },
        ...(this.projectName
          ? [
              {
            text: this.$gettext('Projects'),
            to: createLocationSpaces('files-spaces-projects')
          },
          {
            text: this.projectName,
            onClick: () => eventBus.publish('app.files.list.load')
          }] : [
          {
          text: this.$gettext('Personal'),
          onClick: () => eventBus.publish('app.files.list.load')
        }
          ])
        ]
    },

    showActions() {
      // TODO only admins can restore?
      return true
    }
  },

  created() {
    this.performLoaderTask()

    const loadResourcesEventToken = eventBus.subscribe('app.files.list.load', () => {
      this.performLoaderTask()
    })
    this.$on('beforeDestroy', () => {
      eventBus.unsubscribe('app.files.list.load', loadResourcesEventToken)
    })
  },

  methods: {
    async performLoaderTask() {
      await this.loadResourcesTask.perform({ user: this.user, projectName: this.projectName })
      this.refreshFileListHeaderPosition()
      this.scrollToResourceFromRoute(this.paginatedResources)
    }
  }
})
</script>
