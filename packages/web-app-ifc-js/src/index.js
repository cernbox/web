import App from './App.vue'

const routes = [
  {
    name: 'view',
    path: '/:filePath*',
    components: {
      fullscreen: App
    },
    meta: {
      hideHeadbar: true,
      patchCleanPath: true
    }
  }
]

const appInfo = {
  name: 'IFC.js',
  id: 'ifc-js',
  icon: 'grid_on',
  extensions: [
    {
      extension: 'ifc',
      newTab: true,
      routeName: 'ifc-js-view',
      //newFileMenu: {
      //  menuTitle($gettext) {
      //    return $gettext('New IFC document…')
      //  }
      //},
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
  routes
}
