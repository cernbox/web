<template>
  <main>
    <oc-spinner
      v-if="loading"
      :aria-label="$gettext('Loading media')"
      class="uk-position-center"
      size="xlarge"
    />
    <div id="leftBar">
      <select id="mode-select" v-model="viewMode" @change="renderViewer">
        <option v-for="item in items" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
      <button @click="exit">Exit</button>
      <div id="treeViewer"></div>
    </div>
    <div id="mainViewer"></div>
  </main>
</template>
<script>

import 'https://root.cern/js/latest/scripts/JSRoot.core.min.js'

export default {
  name: 'ROOTJSViewer',
  data: () => ({
    loading: true,
    url: '',
    items: ['simple', 'tabs', 'collapsible', 'grid 2x2', 'grid 3x3', 'grid 4x4'],
    viewMode: null,
    painter: null,
  }),
  created() {
    this.url = this.$client.files.getFileUrl(this.$route.params.filePath)
    this.viewMode = this.items[0]
  },
  computed: {
    rootFile() {
      const headers = new Headers({
        Authorization: 'Bearer ' + this.getToken,
        'X-Requested-With': 'XMLHttpRequest',
      })
      return fetch(this.url, { headers }).then((resp) => {
        if (resp.ok) {
          return resp.arrayBuffer()
        } else {
          return Promise.reject('error code: ' + resp.status)
        }
      })
    },
  },
  methods: {
    renderViewer: function () {
      if (this.painter !== null) {
        this.painter.cleanup()
      }
      this.rootFile
        .then((file) => {
          JSROOT.require('hierarchy').then(() => {
            this.painter = new JSROOT.HierarchyPainter('treeViewer', 'treeViewer')
            this.painter.setDisplay(this.viewMode, 'mainViewer')
            this.painter.openRootFile(file).then(() => (this.loading = false))
          })
        })
        .catch((error) => {
          console.log(error)
        })
    },
    exit: function () {
      window.close()
    },
  },
  mounted: function () {
    this.renderViewer()
  },
}
</script>

<style>
#leftBar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 250px;
  height: 100%;
  border: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  float: left;
}
#mainViewer {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: calc(100% - 250px);
  height: 100%;
  border: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  float: right;
}
</style>
