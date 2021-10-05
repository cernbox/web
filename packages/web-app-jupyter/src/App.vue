<template>
  <main id="jupyter">
    <oc-spinner
      v-if="isLoading"
      :aria-label="$gettext('Loading...')"
      class="uk-position-center"
      size="xlarge"
    />
    <oc-notifications position="top-center">
      <oc-notification-message
        v-if="lastError"
        :message="lastError"
        title="Error"
        status="danger"
        @close="clearLastError"
      />
    </oc-notifications>
    <div class="uk-container uk-width-1-1">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div id="notebook">
        <div id="notebook-container" class="container" v-html="renderedNotebook"></div>
      </div>
    </div>
  </main>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'

export default {
  name: 'Jupyter Viewer',
  computed: {
    ...mapGetters('Jupyter Viewer', ['isLoading', 'renderedNotebook', 'lastError'])
  },
  mounted() {
    const filePath = `/${this.$route.params.filePath.split('/').filter(Boolean).join('/')}`
    this.loadFile({
      filePath: filePath,
      client: this.$client
    })
  },
  methods: {
    ...mapActions('Jupyter Viewer', ['loadFile', 'clearLastError'])
  }
}
</script>
<style>
#notebook {
  padding-top: 40px;
  padding-bottom: 40px;
}

#notebook-container {
  padding: 30px 28px 30px 130px;
  background-color: #fff;
  min-height: 0;
  -webkit-box-shadow: 0px 0px 12px 1px rgb(87 87 87 / 20%);
  box-shadow: 0px 0px 12px 1px rgb(87 87 87 / 20%);
  margin-right: auto;
  margin-left: auto;
}

@media (min-width: 1200px) {
  #notebook .container {
    width: 1140px;
  }
}
@media (min-width: 992px) {
  #notebook .container {
    width: 940px;
  }
}
@media (min-width: 768px) {
  #notebook .container {
    width: 768px;
  }
}
</style>
