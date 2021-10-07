<template>
  <div id="text-editor-app-bar" class="uk-container oc-app-bar uk-width-1-1">
    <oc-grid flex gutter="small">
      <div class="uk-width-auto">
        <oc-button id="text-editor-controls-save" :disabled="!isTouched || isReadOnly" @click="saveContent">
          <oc-icon name="save" />
        </oc-button>
        <oc-spinner v-if="isLoading" :aria-label="$gettext('Loading editor content')" />
      </div>
      <div class="uk-width-expand uk-text-center">
        <span id="text-editor-file-path">{{ currentFile }}</span>
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
    ...mapGetters('Text Editor', ['isTouched', 'isLoading', 'isReadOnly', 'currentFile', 'isPublicLink', 'plToken'])
  },
  methods: {
    ...mapActions('Text Editor', ['saveFile', 'handleSKey', 'resetState']),
    ...mapActions(['createModal', 'hideModal']),
    saveContent() {
      this.saveFile({
        client: this.$client
      })
    },
    closeApp() {
      if (this.isTouched) {
        const modal = {
          variation: 'danger',
          icon: 'warning',
          title: 'Changes not saved',
          message: this.$gettext('Your changes were not saved. Do you want to save them?'),
          cancelText: this.$gettext('Not Save'),
          confirmText: this.$gettext('Save'),
          onCancel: this.finishClosingApp,
          onConfirm: this.saveAndClose
        }
        this.createModal(modal)
      } else {
        this.finishClosingApp()
      }
    },
    saveAndClose() {
      this.saveContent()
      this.finishClosingApp()
    },
    finishClosingApp() {
      this.hideModal()
      const folderPath = this.currentFile.substring(
        0,
        this.currentFile.lastIndexOf('/')
      )

      if (this.isPublicLink) {
        this.$router.push({
          path: '/files/public/list/' + plToken + folderPath
        })
      } else {
        this.$router.push({
          path: '/files/list/all' + folderPath
        })
      }
      document.removeEventListener('keydown', this.handleSKey, false)
      this.resetState()
    },
    registerKeyboardShortcuts() {
      document.addEventListener('keydown', this.handleSKey, false)
    },
    handleSKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.code == 'KeyS') {
        e.preventDefault()
        this.saveContent()
      }
    }
  }
}
</script>
<style>
#text-editor-app-bar {
  padding-top: 15px;
  padding-bottom: 15px;
}
</style>
