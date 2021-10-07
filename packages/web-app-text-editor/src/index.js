// --- Components --------------------------------------------------------------

import App from './App.vue'
import t from '../l10n/translations'

// --- Routing -----------------------------------------------------------------

import store from './store.js'

const routes = [
  {
    path: '/:filePath',
    components: {
      app: App
    },
    name: 'text-editor'
  }
]

const appInfo = {
  name: 'TextEditor',
  id: 'text-editor',
  icon: 'text',
  isFileEditor: true,
  extensions: [
    {
      extension: 'txt',
      newFileMenu: {
        menuTitle($gettext) {
          return $gettext('New plain text file…')
        }
      },
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

const translations = t
export default {
  appInfo,
  routes,
  store,
  translations
}
