import { RouteComponents } from './router'
import { Location, RouteConfig } from 'vue-router'
import { createLocation, $gettext, isLocationActiveDirector } from './utils'

type commonTypes =
  | 'files-common-favorites'
  | 'files-common-search'
  | 'files-common-home'
  | 'files-common-projects'
  | 'files-common-projects-trash'
  | 'files-common-backups-me'
  | 'files-common-backups-projects'

export const createLocationCommon = (name: commonTypes, location = {}): Location =>
  createLocation(name, location)

export const locationFavorites = createLocationCommon('files-common-favorites')
export const locationSearch = createLocationCommon('files-common-search')
export const locationHome = createLocationCommon('files-common-home')
export const locationProjects = createLocationCommon('files-common-projects')
export const locationProjectsTrashbin = createLocationCommon('files-common-projects-trash')
export const locationBackupsMe = createLocationCommon('files-common-backups-me')
export const locationBackupsProjects = createLocationCommon('files-common-backups-projects')

export const isLocationCommonActive = isLocationActiveDirector<commonTypes>(
  locationFavorites,
  locationSearch,
  locationHome,
  locationProjects,
  locationProjectsTrashbin,
  locationBackupsMe,
  locationBackupsProjects
)

export const buildRoutes = (components: RouteComponents): RouteConfig[] => [
  {
    path: '/search',
    component: components.App,
    children: [
      {
        name: locationSearch.name,
        path: 'list/:page?',
        component: components.SearchResults,
        meta: {
          title: $gettext('Search results'),
          contextQueryItems: ['term', 'provider']
        }
      }
    ]
  },
  {
    path: '/favorites',
    component: components.App,
    children: [
      {
        name: locationFavorites.name,
        path: '',
        component: components.Favorites,
        meta: {
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
    component: components.App,
    children: [
      {
        name: locationProjects.name,
        path: '',
        component: components.Projects,
        meta: {
          hideFilelistActions: true,
          hasBulkActions: true,
          title: $gettext('Projects')
        }
      }
    ]
  },
  {
    path: '/projects-trashbin',
    component: components.App,
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
  },
  {
    path: '/backups',
    component: components.App,
    redirect: locationBackupsMe,
    children: [
      {
        name: locationBackupsMe.name,
        path: 'me',
        component: components.MyBackups,
        meta: {
          title: $gettext('My backups')
        }
      },
      {
        name: locationBackupsProjects.name,
        path: 'projects',
        component: components.ProjectBackups,
        meta: {
          title: $gettext('Project backups')
        }
      }
    ]
  }
]
