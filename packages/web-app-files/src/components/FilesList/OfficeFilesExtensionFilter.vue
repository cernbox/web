<template>
  <div class="oc-my-s oc-flex oc-flex-row oc-width-large" style="align-items: center">
    <span>Filter by type: </span>
    <oc-select
      v-model="officeFileExtension"
      class="oc-mx-s oc-width-medium"
      :multiple="false"
      :searchable="false"
      :options="extensionOptions"
      @option:selected="extensionSelected"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

const extensionOptions = [
  { label: 'PowerPoint', value: 'ppt' },
  { label: 'Word', value: 'doc' },
  { label: 'Excel', value: 'xls' }
]

export default defineComponent({
  name: 'OfficeFilesExtensionFilter',
  props: {},
  emits: ['extensionSelected'],

  setup(props, { emit }) {},

  data() {
    return {
      officeFileExtension: '',
      extensionOptions
    }
  },

  created() {
    this.officeFileExtension = this.extensionOptions[0]
    this.$emit('extensionSelected', this.officeFileExtension.value)
  },

  methods: {
    extensionSelected(newValue: { label: string; value: string }) {
      this.$emit('extensionSelected', newValue.value)
    }
  }
})
</script>
