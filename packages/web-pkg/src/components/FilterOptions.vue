<template>
  <oc-button id="oc-filter-button" appearance="raw" size="small">
    <oc-icon name="filter-2" fill-type="line" class="oc-filter-icon" />
  </oc-button>
  <oc-drop toggle="#oc-filter-button" position="bottom" padding-size="remove">
    <ul class="oc-filter-list">
      <li class="oc-filter-list-item">
        <p style="{{ font-size: 16; }}">Filetype</p>
        <oc-page-size
          v-model="selectedResourceType"
          :options="resourceTypes"
          label=""
          :selected="selectedResourceType"
          @change="updateSelectedResourceType"
        />
      </li>
    </ul>
  </oc-drop>
</template>

<script lang="ts">
import { ref } from 'vue'
import { defineComponent } from 'vue'
import { ResourceFilterConstants, useFilter } from 'web-pkg/src/composables'

export default defineComponent({
  emits: ['updateActiveResourceType'],
  setup() {
    const resourceTypes: string[] = ResourceFilterConstants.resourceOptions
    const { setFilter, resetFilter } = useFilter({})
    return {
      resourceTypes,
      setFilter,
      resetFilter
    }
  },
  data: function () {
    return {
      hover: false,
      selectedResourceType: ref('IMAGES')
    }
  },
  methods: {
    updateSelectedResourceType(resourceType: string) {
      this.selectedResourceType = resourceType
      this.setFilter(resourceType)
      this.$emit('updateActiveResourceType', this.selectedResourceType)
    }
  }
})
</script>

<style lang="scss" scoped>
#oc-filter-button {
  margin-right: 0.7rem;
  :hover {
    background-color: var(--oc-color-border);
  }
}

.oc-filter-list {
  list-style-type: none;
  display: flex;
  justify-content: center;
  padding: 1rem;
  margin-left: 0;
  margin-top: 0;
}

.oc-filter-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.oc-filter-icon {
  padding: 3px;
  border-radius: 2px;
}
</style>
