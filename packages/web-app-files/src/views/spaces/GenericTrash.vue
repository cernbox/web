<template>
  <div class="oc-flex oc-width-1-1">
    <files-view-wrapper>
      <app-bar
        :breadcrumbs="breadcrumbs"
        :has-bulk-actions="true"
        :is-side-bar-open="isSideBarOpen"
        :space="space"
      />
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <div
          class="shared-with-me-filters oc-flex oc-flex-between oc-flex-wrap oc-flex-bottom oc-mx-m oc-mb-m"
        >
          <div class="oc-flex oc-flex-wrap">
            <div class="oc-mr-m oc-flex oc-flex-middle">
              <oc-icon name="filter-2" class="oc-mr-xs" />
              <span v-text="$gettext('Filter:')" />
            </div>
            <trashbin-date-picker @range-changed="rangeChanged" />
          </div>
        </div>
        <no-content-message
          v-if="recycleError"
          id="files-trashbin-error"
          class="files-empty"
          icon="error-warning"
          icon-fill-type="line"
        >
          <template #message>
            <span
              >Your trash bin returned too many entries and cannot be displayed, or the date range
              is too long. <br />Please filter by date or check the
              <a
                href="https://cernbox.docs.cern.ch/web/data-security/restore_from_trash/"
                target="_blank"
                >documentation</a
              >.</span
            >
          </template>
        </no-content-message>
        <no-content-message
          v-else-if="isEmpty"
          id="files-trashbin-empty"
          class="files-empty"
          icon="delete-bin-7"
          icon-fill-type="line"
        >
          <template #message>
            <span>{{ noContentMessage }}</span>
          </template>
        </no-content-message>
        <resource-table
          v-else
          v-model:selected-ids="selectedResourcesIds"
          :is-side-bar-open="isSideBarOpen"
          :fields-displayed="['name', 'ddate']"
          :are-paths-displayed="true"
          :resources="paginatedResources"
          :are-resources-clickable="false"
          :are-thumbnails-displayed="false"
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
              :action-options="{ space, resources: selectedResources }"
            />
          </template>
          <template #footer>
            <pagination :pages="paginationPages" :current-page="paginationPage" />
            <list-info v-if="paginatedResources.length > 0" class="oc-width-1-1 oc-my-s" />
          </template>
        </resource-table>
      </template>
    </files-view-wrapper>
    <file-side-bar :is-open="isSideBarOpen" :active-panel="sideBarActivePanel" :space="space" />
  </div>
</template>

<script lang="ts">
import { storeToRefs } from 'pinia'

import { AppBar, ContextActions, FileSideBar, useUserStore } from '@ownclouders/web-pkg'
import FilesViewWrapper from '../../components/FilesViewWrapper.vue'
import ListInfo from '../../components/FilesList/ListInfo.vue'
import { ResourceTable } from '@ownclouders/web-pkg'
import { AppLoadingSpinner } from '@ownclouders/web-pkg'
import { NoContentMessage } from '@ownclouders/web-pkg'
import { Pagination } from '@ownclouders/web-pkg'

import { eventBus } from '@ownclouders/web-pkg'
import { useResourcesViewDefaults } from '../../composables'
import { computed, defineComponent, PropType, onMounted, onBeforeUnmount, unref, ref } from 'vue'
import { Resource } from '@ownclouders/web-client'
import { createLocationTrash } from '@ownclouders/web-pkg'
import { isProjectSpaceResource, SpaceResource } from '@ownclouders/web-client'
import { useDocumentTitle } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

import { useRouteQuery } from '@ownclouders/web-pkg'
import TrashbinDatePicker from '../../components/FilesList/TrashbinDatePicker.vue'

export default defineComponent({
  name: 'GenericTrash',

  components: {
    AppBar,
    AppLoadingSpinner,
    ContextActions,
    FileSideBar,
    FilesViewWrapper,
    ListInfo,
    NoContentMessage,
    Pagination,
    ResourceTable,
    TrashbinDatePicker
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
    const { $gettext } = useGettext()
    const userStore = useUserStore()
    const { user } = storeToRefs(userStore)

    const filterFrom = useRouteQuery('from')
    const filterTo = useRouteQuery('to')
    const dateFilter =
      unref(filterFrom) && unref(filterTo)
        ? ref({
            from: unref(filterFrom),
            to: unref(filterTo)
          })
        : ref(null)

    const rangeChanged = (data) => {
      dateFilter.value =
        data.range?.from && data.range?.to ? { from: data.range.from, to: data.range.to } : null
      performLoaderTask()
    }
    const recycleError = ref(false)

    let loadResourcesEventToken: string
    const noContentMessage = computed(() => {
      return props.space.driveType === 'personal'
        ? $gettext('You have no deleted files')
        : $gettext('Space has no deleted files')
    })

    const titleSegments = computed(() => {
      const segments = [$gettext('Deleted files')]
      segments.unshift(props.space.name)

      return segments
    })
    useDocumentTitle({ titleSegments })

    const resourcesViewDefaults = useResourcesViewDefaults<Resource, any, any[]>()
    const performLoaderTask = async () => {
      recycleError.value = false
      try {
        await resourcesViewDefaults.loadResourcesTask.perform(props.space, unref(dateFilter))
        resourcesViewDefaults.refreshFileListHeaderPosition()
        resourcesViewDefaults.scrollToResourceFromRoute(
          unref(resourcesViewDefaults.paginatedResources),
          'files-app-bar'
        )
      } catch (e) {
        recycleError.value = true
      }
    }

    onMounted(() => {
      performLoaderTask()
      loadResourcesEventToken = eventBus.subscribe('app.files.list.load', () => {
        performLoaderTask()
      })
    })

    onBeforeUnmount(() => {
      eventBus.unsubscribe('app.files.list.load', loadResourcesEventToken)
    })

    return {
      ...resourcesViewDefaults,
      user,
      noContentMessage,
      rangeChanged,
      recycleError
    }
  },

  computed: {
    isEmpty() {
      return this.paginatedResources.length < 1
    },

    breadcrumbs() {
      let currentNodeName = this.space?.name
      if (this.space.driveType === 'personal') {
        currentNodeName = this.$gettext('Personal')
      }
      return [
        {
          text: this.$gettext('Deleted files'),
          to: createLocationTrash('files-trash-overview')
        },
        {
          text: currentNodeName,
          onClick: () => eventBus.publish('app.files.list.load')
        }
      ]
    },

    showActions() {
      return (
        !isProjectSpaceResource(this.space) ||
        this.space.canDeleteFromTrashBin({ user: this.user }) ||
        this.space.canRestoreFromTrashbin({ user: this.user })
      )
    }
  }
})
</script>
