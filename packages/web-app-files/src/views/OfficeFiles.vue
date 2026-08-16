<template>
  <div class="oc-flex">
    <files-view-wrapper>
      <app-bar
        ref="appBarRef"
        :breadcrumbs="breadcrumbs"
        :view-modes="viewModes"
        :is-side-bar-open="isSideBarOpen"
      />
      <div id="files-filter" class="oc-my-m oc-px-m oc-flex">
        <project-picker @project-selected="locationSelectedChanged" />
        <office-files-extension-filter @extension-selected="extensionSelectedChanged" />
      </div>
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <no-content-message
          v-if="isEmpty"
          id="files-office-empty"
          class="files-empty"
          icon="file-list"
        >
          <template #message>
            <span v-translate>
              There are no resources with Microsoft Office extensions in this location
            </span>
          </template>
        </no-content-message>
        <component
          :is="folderView.component"
          v-else
          v-model:selected-ids="selectedResourcesIds"
          :is-side-bar-open="isSideBarOpen"
          :are-paths-displayed="true"
          :resources="paginatedResources"
          :header-position="fileListHeaderY"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :style="folderViewStyle"
          v-bind="folderView.componentAttrs?.()"
          @file-click="triggerDefaultAction"
          @item-visible="loadPreview({ space: getMatchingSpace($event), resource: $event })"
          @sort="handleSort"
        >
          <template #quickActions="props">
            <quick-actions class="oc-visible@s" :item="props.resource" />
          </template>
          <template #contextMenu="{ resource }">
            <context-actions
              v-if="isResourceInSelection(resource)"
              :action-options="{ space: getMatchingSpace(resource), resources: selectedResources }"
            />
          </template>
          <template #footer>
            <pagination :pages="paginationPages" :current-page="paginationPage" />
            <list-info v-if="paginatedResources.length > 0" class="oc-width-1-1 oc-my-s" />
          </template>
        </component>
      </template>
    </files-view-wrapper>
    <file-side-bar
      :is-open="isSideBarOpen"
      :active-panel="sideBarActivePanel"
      :space="selectedResourceSpace"
    />
  </div>
</template>

<script lang="ts">
import { Resource } from '@ownclouders/web-client'
import {
  AppBar,
  AppLoadingSpinner,
  ContextActions,
  FileSideBar,
  NoContentMessage,
  Pagination,
  ResourceTable,
  useConfigStore,
  useExtensionRegistry,
  useFileActions,
  useGetMatchingSpace,
  useLoadPreview
} from '@ownclouders/web-pkg'
import { storeToRefs } from 'pinia'
import { ComponentPublicInstance, computed, defineComponent, ref, unref } from 'vue'
import ListInfo from '../components/FilesList/ListInfo.vue'
import ProjectPicker from '../components/FilesList/ProjectPicker.vue'
import OfficeFilesExtensionFilter from '../components/FilesList/OfficeFilesExtensionFilter.vue'
import QuickActions from '../components/FilesList/QuickActions.vue'
import FilesViewWrapper from '../components/FilesViewWrapper.vue'
import { useResourcesViewDefaults } from '../composables'

import { folderViewsOfficeFilesExtensionPoint } from '../extensionPoints'

export default defineComponent({
  components: {
    FilesViewWrapper,
    AppBar,
    ResourceTable,
    QuickActions,
    AppLoadingSpinner,
    Pagination,
    NoContentMessage,
    ListInfo,
    ContextActions,
    FileSideBar,
    ProjectPicker,
    OfficeFilesExtensionFilter
  },

  setup() {
    const { getMatchingSpace } = useGetMatchingSpace()

    const configStore = useConfigStore()
    const { options: configOptions } = storeToRefs(configStore)

    const resourcesViewDefaults = useResourcesViewDefaults<Resource, any, any[]>()
    const { loadPreview } = useLoadPreview(resourcesViewDefaults.viewMode)

    const extensionRegistry = useExtensionRegistry()

    const viewModes = computed(() => {
      return [
        ...extensionRegistry
          .requestExtensions(folderViewsOfficeFilesExtensionPoint)
          .map((e) => e.folderView)
      ]
    })
    const folderView = computed(() => {
      const viewMode = unref(resourcesViewDefaults.viewMode)
      return unref(viewModes).find((v) => v.name === viewMode)
    })
    const appBarRef = ref<ComponentPublicInstance | null>()
    const folderViewStyle = computed(() => {
      return {
        ...(unref(folderView)?.isScrollable === false && {
          height: `calc(100% - ${unref(appBarRef)?.$el.getBoundingClientRect().height}px)`
        })
      }
    })

    if (!localStorage.getItem('oc-options_files-common-office_sort-by')) {
      localStorage.setItem('oc-options_files-common-office_sort-by', 'mdate')
      localStorage.setItem('oc-options_files-common-office_sort-dir', 'desc')
    }

    return {
      ...useFileActions(),
      ...resourcesViewDefaults,
      configOptions,
      getMatchingSpace,
      viewModes,
      appBarRef,
      folderView,
      folderViewStyle,
      loadPreview,
      ...useResourcesViewDefaults<Resource, any, any[]>(),
      ...useFileActions()
    }
  },

  data() {
    return {
      extensionSelected: localStorage.getItem('extension-picked') || '',
      locationSelected: localStorage.getItem('project-picked') || null
    }
  },

  computed: {
    breadcrumbs() {
      return [
        {
          text: this.$gettext('My office files'),
          onClick: () =>
            this.loadResourcesTask.perform(this.extensionSelected, this.locationSelected)
        }
      ]
    },
    isEmpty() {
      return this.paginatedResources.length < 1
    },

    officeFilesParams() {
      return {
        extension: this.extensionSelected,
        location: this.locationSelected
      }
    }
  },

  async created() {
    await this.loadOfficeFiles()
    this.scrollToResourceFromRoute(this.paginatedResources, 'files-app-bar')
  },

  methods: {
    extensionSelectedChanged(extension: string) {
      this.extensionSelected = extension
      this.loadOfficeFiles()
    },

    locationSelectedChanged(location: string) {
      this.locationSelected = location
      this.loadOfficeFiles()
    },

    async loadOfficeFiles() {
      if (this.extensionSelected && this.locationSelected !== null) {
        await this.loadResourcesTask.perform(
          this.officeFilesParams.extension,
          this.officeFilesParams.location
        )
      }
    }
  }
})
</script>
