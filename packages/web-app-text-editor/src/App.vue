<template>
  <main id="text-editor">
    <text-editor-app-bar ref="bar_comp" />
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
          :disabled="isReadOnly"
        />
      </div>
    </div>
  </main>
</template>
<script>
import TextEditorAppBar from './TextEditorAppBar.vue'
import { mapActions, mapGetters } from 'vuex'

export default {
  name: 'Text Editor',
  components: {
    TextEditorAppBar
  },
  computed: {
    ...mapGetters(['activeFile']),
    ...mapGetters('Text Editor', ['currentContent', 'lastError', 'isReadOnly'])
  },
  mounted() {
    const filePath = `/${this.$route.params.filePath.split('/').filter(Boolean).join('/')}`
    if (filePath === '') {
      this.$router.push({
        path: '/files'
      })
      return
    }
    // TODO on route change run exit
    // FIXME this is always edit or create... need to find file permissions
    // if (this.$route.params.mode === 'edit' || 
    //   this.$route.params.mode === 'create') {
    //   // This file can be edited
    this.setWriteMode()
    // }
    this.loadFile({
      filePath: filePath,
      client: this.$client,
      public: this.$route.name === 'text-editor-public'
    })
    this.$refs.bar_comp.registerKeyboardShortcuts()
  },
  methods: {
    ...mapActions('Text Editor', ['updateText', 'loadFile', 'setWriteMode', 'clearLastError', 'handleSKey']),
    onType(e) {
      this.updateText(e)
    }
  }
}
</script>
