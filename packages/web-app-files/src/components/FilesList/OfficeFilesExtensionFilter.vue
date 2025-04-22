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

const lastExtensionPicked = localStorage.getItem('extension-picked') || false

export default defineComponent({
  name: 'OfficeFilesExtensionFilter',
  props: {},
  emits: ['extensionSelected'],

  setup(props, { emit }) {},

  data() {
    return {
      officeFileExtension: '',
      extensionOptions,
      lastExtensionPicked
    }
  },

  created() {
    if (this.lastExtensionPicked) {
      this.officeFileExtension = this.extensionOptions.find(
        (option: { value: string }) => option.value === this.lastExtensionPicked
      )
    } else {
      this.officeFileExtension = this.extensionOptions[0]
    }
    this.$emit('extensionSelected', this.officeFileExtension.value)
  },

  methods: {
    extensionSelected(newValue: { label: string; value: string }) {
      localStorage.setItem('extension-picked', newValue.value)
      this.$emit('extensionSelected', newValue.value)
    }
  }
})
</script>
