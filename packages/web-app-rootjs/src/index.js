import App from './App.vue'

const routes = [
  {
    name: 'view',
    path: '/view/:filePath',
    components: {
      fullscreen: App
    },
    meta: { hideHeadbar: true }
  }
]

const appInfo = {
  name: 'RootJS Viewer',
  id: 'rootjs',
  icon: 'grid_on',
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
