import App from './App.vue'

const routes = [
  {
    name: 'view',
    path: '/view/:filePath*',
    components: {
      fullscreen: App
    },
    meta: {
      patchCleanPath: true,
      hideHeadbar: true
    }
  }
]

const appInfo = {
  name: 'ROOT Viewer',
  id: 'rootjs',
  iconImg: 'https://root.cern/img/logos/ROOT_Logo/misc/generic-logo-cyan-512.png',
  extensions: [
    {
      extension: 'root',
      newTab: true,
      routeName: 'rootjs-view',
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
