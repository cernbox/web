<template>
  <div id="text-editor-app-bar" class="oc-app-bar">
    <oc-grid flex gutter="small">
      <div class="uk-width-auto">
        <oc-button id="text-editor-controls-save" :disabled="!isTouched" @click="saveContent">
          <oc-icon name="save" />
        </oc-button>
        <oc-spinner v-if="isLoading" :aria-label="$gettext('Loading editor content')" />
      </div>
      <div class="uk-width-expand uk-text-center">
        <span id="text-editor-file-path">{{ activeFilePath }}</span>
      </div>
      <div class="uk-width-auto uk-text-right">
        <oc-button id="text-editor-controls-close" @click="closeApp">
          <oc-icon name="close" />
        </oc-button>
      </div>
    </oc-grid>
  </div>
</template>
<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  computed: {
    ...mapGetters(['activeFile']),
    ...mapGetters('TextEditor', ['isTouched', 'isLoading']),
    activeFilePath() {
      return this.activeFile.path.replace(/^(\/|\\)+/, '')
    }
  },
  methods: {
    ...mapActions('TextEditor', ['saveFile']),
    saveContent() {
      this.saveFile({
        client: this.$client
      })
    },
    closeApp() {
      this.$router.push({
        path: '/files'
      })
    }
  }
}
</script>
