import { RouteComponents } from './router'
import { Location, RouteConfig } from 'vue-router'
import { createLocation, $gettext, isLocationActiveDirector } from './utils'

type commonTypes =
  | 'files-common-favorites'
  | 'files-common-trash'
  | 'files-common-home'
  | 'files-common-projects'
  | 'files-common-projects-trashbin'

export const createLocationCommon = (name: commonTypes, location = {}): Location =>
  createLocation(name, location)

export const locationFavorites = createLocationCommon('files-common-favorites')
export const locationTrash = createLocationCommon('files-common-trash')
export const locationHome = createLocationCommon('files-common-home')
export const locationProjects = createLocationCommon('files-common-projects')
export const locationProjectsTrashbin = createLocationCommon('files-common-projects-trashbin')

export const isLocationCommonActive = isLocationActiveDirector<commonTypes>(
  locationFavorites,
  locationTrash,
  locationHome,
  locationProjects,
  locationProjectsTrashbin
)

export const buildRoutes = (components: RouteComponents): RouteConfig[] => [
  {
    path: '/trash',
    components: {
      app: components.App
    },
    children: [
      {
        name: locationTrash.name,
        path: '',
        component: components.Trashbin,
        meta: {
          hideFilelistActions: true,
          hasBulkActions: true,
          title: $gettext('Deleted files')
        }
      }
    ]
  },
  {
    path: '/favorites',
    components: {
      app: components.App
    },
    children: [
      {
        name: locationFavorites.name,
        path: '',
        component: components.Favorites,
        meta: {
          hideFilelistActions: true,
          hasBulkActions: false,
          title: $gettext('Favorite files')
        }
      }
    ]
  },
  {
    path: '/home',
    components: {
      app: components.App
    },
    children: [
      {
        name: locationHome.name,
        path: '',
        component: components.Home,
        meta: {
          hideFilelistActions: true,
          hasBulkActions: false,
          title: $gettext('Home')
        }
      }
    ]
  },
  {
    path: '/projects',
    components: {
      app: components.App
    },
    children: [
      {
        name: locationProjects.name,
        path: '',
        component: components.Projects,
        meta: {
          hideFilelistActions: true,
          hasBulkActions: false,
          title: $gettext('Projects')
        }
      }
    ]
  },
  {
    path: '/projects-trashbin',
    components: {
      app: components.App
    },
    children: [
      {
        name: locationProjectsTrashbin.name,
        path: '',
        component: components.Trashbin,
        meta: {
          hideFilelistActions: true,
          hasBulkActions: false,
          title: $gettext('Projects trashbin')
        }
      }
    ]
  }
]
