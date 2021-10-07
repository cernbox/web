<template>
  <main id="text-editor">
    <text-editor-app-bar ref="bar_comp"/>
    <oc-notifications>
      <oc-notification-message
        v-if="lastError"
        :message="lastError"
        status="danger"
        @close="clearLastError"
      />
    </oc-notifications>
    <div class="uk-flex">
      <div class="uk-container uk-width-1-1">
        <oc-textarea
          id="text-editor-input"
          label=""
          name="input"
          full-width
          :value="currentContent"
          class="uk-height-1-1"
          :rows="20"
          @input="onType"
        />
      </div>
    </div>
  </main>
</template>
<script>
import TextEditorAppBar from './TextEditorAppBar.vue'
import { mapActions, mapGetters } from 'vuex'

export default {
  name: 'TextEditor',
  components: {
    TextEditorAppBar
  },
  computed: {
    ...mapGetters(['activeFile']),
    ...mapGetters('TextEditor', ['currentContent', 'lastError'])
  },
  mounted() {
    if (this.$route.params.filePath === '') {
      this.$router.push({
        path: '/files'
      })
      return
    }
    this.loadFile({
      filePath: this.$route.params.filePath,
      client: this.$client
    })
    this.$refs.bar_comp.registerKeyboardShortcuts()
  },
  methods: {
    ...mapActions('TextEditor', ['updateText', 'loadFile', 'clearLastError', 'handleSKey']),
    onType(e) {
      this.updateText(e)
    }
  }
}
</script>
