<template>
  <div class="oc-flex oc-flex-column">
    <app-bar :has-shares-navigation="true" :has-bulk-actions="true" />
    <app-loading-spinner v-if="areResourcesLoading" />
    <template v-else>
      <shared-with-me-section
        v-if="pendingItems.length > 0"
        id="files-shared-with-me-pending-section"
        :title="pendingTitle"
        :items="pendingItems"
        :share-status="ShareStatus.pending"
        :sort-by="pendingSortBy"
        :sort-dir="pendingSortDir"
        :sort-handler="pendingHandleSort"
        :show-more-toggle="true"
        :resource-clickable="false"
        :display-thumbnails="false"
      />

      <shared-with-me-section
        id="files-shared-with-me-accepted-section"
        :title="acceptedTitle"
        :empty-message="acceptedEmptyMessage"
        :items="acceptedItems"
        :share-status="ShareStatus.accepted"
        :sort-by="acceptedSortBy"
        :sort-dir="acceptedSortDir"
        :sort-handler="acceptedHandleSort"
        :resource-clickable="true"
        :display-thumbnails="displayThumbnails"
        :grouping-settings="groupingSettings"
      />

      <shared-with-me-section
        id="files-shared-with-me-declined-section"
        :title="declinedTitle"
        :empty-message="declinedEmptyMessage"
        :items="declinedItems"
        :share-status="ShareStatus.declined"
        :sort-by="declinedSortBy"
        :sort-dir="declinedSortDir"
        :sort-handler="declinedHandleSort"
        :show-more-toggle="true"
        :display-thumbnails="false"
        :resource-clickable="false"
        :grouping-settings="groupingSettings"
      />
    </template>
  </div>
</template>

<script lang="ts">
import { mapGetters } from 'vuex'
import { useSort, useResourcesViewDefaults } from '../../composables'

import AppLoadingSpinner from 'web-pkg/src/components/AppLoadingSpinner.vue'
import AppBar from '../../components/AppBar/AppBar.vue'
import SharedWithMeSection from '../../components/Shares/SharedWithMeSection.vue'
import { ShareStatus } from '../../helpers/share'
import { computed, defineComponent, unref } from '@vue/composition-api'
import { Resource } from 'web-client'

export default defineComponent({
  components: {
    AppBar,
    AppLoadingSpinner,
    SharedWithMeSection
  },

  setup() {
    const { storeItems, fields, loadResourcesTask, areResourcesLoading } = useResourcesViewDefaults<
      Resource,
      any,
      any[]
    >()

    // pending shares
    const pending = computed(() =>
      unref(storeItems).filter((item) => item.status === ShareStatus.pending)
    )
    const {
      sortBy: pendingSortBy,
      sortDir: pendingSortDir,
      items: pendingItems,
      handleSort: pendingHandleSort
    } = useSort({
      items: pending,
      fields,
      sortByQueryName: 'pending-sort-by',
      sortDirQueryName: 'pending-sort-dir'
    })

    // accepted shares
    const accepted = computed(() =>
      unref(storeItems).filter((item) => item.status === ShareStatus.accepted)
    )
    const {
      sortBy: acceptedSortBy,
      sortDir: acceptedSortDir,
      items: acceptedItems,
      handleSort: acceptedHandleSort
    } = useSort({
      items: accepted,
      fields,
      sortByQueryName: 'accepted-sort-by',
      sortDirQueryName: 'accepted-sort-dir'
    })

    // declined shares
    const declined = computed(() =>
      unref(storeItems).filter((item) => item.status === ShareStatus.declined)
    )
    const {
      sortBy: declinedSortBy,
      sortDir: declinedSortDir,
      items: declinedItems,
      handleSort: declinedHandleSort
    } = useSort({
      items: declined,
      fields,
      sortByQueryName: 'declined-sort-by',
      sortDirQueryName: 'declined-sort-dir'
    })

    return {
      // defaults
      loadResourcesTask,
      areResourcesLoading,

      // view specific
      pendingHandleSort,
      pendingSortBy,
      pendingSortDir,
      pendingItems,

      acceptedHandleSort,
      acceptedSortBy,
      acceptedSortDir,
      acceptedItems,

      declinedHandleSort,
      declinedSortBy,
      declinedSortDir,
      declinedItems
    }
  },

  data: () => ({
    ShareStatus
  }),

  computed: {
    ...mapGetters(['configuration']),

    groupingSettings() {
      const that = this
      return {
        groupingBy: localStorage.getItem('grouping-shared-with-me') || 'Shared on',
        showGroupingOptions: true,
        groupingFunctions: {
          'Name alphabetically': function (row) {
            localStorage.setItem('grouping-shared-with-me', 'Name alphabetically')
            if (!isNaN(row.name.charAt(0))) return '#'
            if (row.name.charAt(0) === '.') return row.name.charAt(1).toLowerCase()
            return row.name.charAt(0).toLowerCase()
          },
          'Shared on': function (row) {
            localStorage.setItem('grouping-shared-with-me', 'Shared on')
            const recently = Date.now() - 604800000
            const lastMonth = Date.now() - 2592000000
            if (Date.parse(row.sdate) < lastMonth) return 'Older'
            if (Date.parse(row.sdate) >= recently) return 'Recently'
            else return 'Last month'
          },
          'Share owner': function (row) {
            localStorage.setItem('grouping-shared-with-me', 'Share owner')
            return row.owner[0].displayName
          },
          None: function () {
            localStorage.setItem('grouping-shared-with-me', 'None')
          }
        },
        sortGroups: {
          'Name alphabetically': function (groups) {
            // sort in alphabetical order by group name
            const sortedGroups = groups.sort(function (a, b) {
              if (a.name < b.name) {
                return -1
              }
              if (a.name > b.name) {
                return 1
              }
              return 0
            })
            // if sorting is done by name, reverse groups depending on asc/desc
            if (that.sharesSortBy === 'name' && that.sharesSortDir === 'desc')
              sortedGroups.reverse()
            return sortedGroups
          },
          'Shared on': function (groups) {
            // sort in order: 1-Recently, 2-Last month, 3-Older
            const sortedGroups = []
            const options = ['Recently', 'Last month', 'Older']
            for (const o of options) {
              const found = groups.find((el) => el.name.toLowerCase() === o.toLowerCase())
              if (found) sortedGroups.push(found)
            }
            // if sorting is done by sdate, reverse groups depending on asc/desc
            if (that.sharesSortBy === 'sdate' && that.sharesSortDir === 'asc')
              sortedGroups.reverse()
            return sortedGroups
          },
          'Share owner': function (groups) {
            // sort in alphabetical order by group name
            const sortedGroups = groups.sort(function (a, b) {
              if (a.name < b.name) {
                return -1
              }
              if (a.name > b.name) {
                return 1
              }
              return 0
            })
            // if sorting is done by owner, reverse groups depending on asc/desc
            if (that.sharesSortBy === 'owner' && that.sharesSortDir === 'desc')
              sortedGroups.reverse()
            return sortedGroups
          }
        }
      }
    },

    pendingTitle() {
      return this.$gettext('Pending shares')
    },

    acceptedTitle() {
      return this.$gettext('Accepted shares')
    },
    acceptedEmptyMessage() {
      return this.$gettext("You are not collaborating on other people's resources.")
    },

    declinedTitle() {
      return this.$gettext('Declined shares')
    },
    declinedEmptyMessage() {
      return this.$gettext("You don't have any previously declined shares.")
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
