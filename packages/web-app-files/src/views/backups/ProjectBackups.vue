<template>
  <div class="oc-flex">
    <files-view-wrapper class="oc-flex-column">
      <app-bar :has-backups-navigation="true" :has-bulk-actions="true" />
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <h2 class="oc-px-m oc-py-s">
          {{ backupsTitle }}
        </h2>

        <backups-section
          id="backups-section"
          :display-thumbnails="displayThumbnails"
          :empty-message="emptyMessage"
          :file-list-header-y="fileListHeaderY"
          :items="backupItems"
          :resource-clickable="true"
          :title="backupsTitle"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :sort-handler="handleSort"
        />
      </template>
    </files-view-wrapper>
  </div>
</template>

<script lang="ts">
import { mapGetters } from 'vuex'
import { useSort, useResourcesViewDefaults } from '../../composables'

import AppLoadingSpinner from 'web-pkg/src/components/AppLoadingSpinner.vue'
import AppBar from '../../components/AppBar/AppBar.vue'
import BackupsSection from '../../components/Backups/BackupsSection.vue'
import { defineComponent } from '@vue/composition-api'
import { Resource } from 'web-client'
import FilesViewWrapper from '../../components/FilesViewWrapper.vue'

export default defineComponent({
  components: {
    FilesViewWrapper,
    AppBar,
    AppLoadingSpinner,
    BackupsSection
  },

  setup() {
    const {
      areResourcesLoading,
      fields,
      fileListHeaderY,
      loadResourcesTask,
      selectedResources,
      selectedResourcesIds,
      storeItems
    } = useResourcesViewDefaults<Resource, any, any[]>()

    // backup items
    const backups = storeItems
    const {
      sortBy,
      sortDir,
      items: backupItems,
      handleSort
    } = useSort({
      items: backups,
      fields,
      sortByQueryName: 'backups-sort-by',
      sortDirQueryName: 'backups-sort-dir'
    })

    return {
      // defaults
      loadResourcesTask,
      areResourcesLoading,
      selectedResources,
      selectedResourcesIds,
      fileListHeaderY,

      handleSort,
      sortBy,
      sortDir,
      backupItems
    }
  },

  computed: {
    ...mapGetters(['configuration']),

    backupsTitle() {
      return this.$gettext('Projects backups')
    },
    emptyMessage() {
      return this.$gettext("You don't have any backups.")
    },
    displayThumbnails() {
      return !this.configuration?.options?.disablePreviews
    }
  },

  created() {
    this.loadResourcesTask.perform()
  }
})
</script>

<style scoped>
h2 {
  font-size: 1.3em;
  margin-top: 0;
}
</style>
