import App from './App.vue'
import translations from '../l10n/translations'

// just a dummy function to trick gettext tools
function $gettext(msg) {
  return msg
}

const routes = [
  {
    path: '/:filePath*',
    component: App,
    name: 'text-editor',
    meta: {
      title: $gettext('Text Editor'),
      auth: false,
      patchCleanPath: true
    }
  }
]

const appInfo = {
  name: $gettext('Text Editor'),
  id: 'text-editor',
  icon: 'file-text',
  isFileEditor: true,
  extensions: [
    {
      extension: 'txt',
      newFileMenu: {
        menuTitle($gettext) {
          return $gettext('Plain text file')
        }
      },
      canBeDefault: true
    },
    {
      extension: 'md',
      canBeDefault: false
    }
  ]
}

for (const ext of ['js', 'json', 'xml', 'py', 'php', 'yaml']) {
  appInfo.extensions.push({
    extension: ext,
    canBeDefault: true
  })
}

export default {
  appInfo,
  routes,
  translations
}
