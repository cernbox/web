import App from './App.vue'
import store from './store.js'

import '../css/notebook.min.css'
import '../css/default.min.css'
import '../css/katex.min.css'

const routes = [
  {
    name: 'view',
    path: '/:filePath*',
    components: {
      app: App
    },
    meta: {
      patchCleanPath: true
    }
  }
]

const appInfo = {
  name: 'Jupyter Viewer',
  id: 'jupyter',
  icon: 'jupyter',
  extensions: [
    {
      extension: 'ipynb',
      newTab: true,
      routeName: 'jupyter-view',
      routes: [
        'files-personal',
        'files-favorites',
        'files-shared-with-others',
        'files-shared-with-me',
        'files-public-list'
      ]
    }
  ]
}

export default {
  appInfo,
  routes,
  store
}
