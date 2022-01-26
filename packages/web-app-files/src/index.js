import App from './App.vue'
import Favorites from './views/Favorites.vue'
import FilesDrop from './views/FilesDrop.vue'
import LocationPicker from './views/LocationPicker.vue'
import PrivateLink from './views/PrivateLink.vue'
import PublicFiles from './views/PublicFiles.vue'
import PublicLink from './views/PublicLink.vue'
import Personal from './views/Personal.vue'
import SharedWithMe from './views/SharedWithMe.vue'
import SharedWithOthers from './views/SharedWithOthers.vue'
import SharedViaLink from './views/SharedViaLink.vue'
import SpaceProjects from './views/spaces/Projects.vue'
import Trashbin from './views/Trashbin.vue'
import Home from './views/Home.vue'
import Projects from './views/Projects.vue'
import translations from '../l10n/translations.json'
import quickActions from './quickActions'
import store from './store'
import { FilterSearch, SDKSearch } from './search'
import { bus } from 'web-pkg/src/instance'
import { archiverService, Registry } from './services'
import fileSideBars from './fileSideBars'
import { buildRoutes } from './router'
import get from 'lodash-es/get'

// just a dummy function to trick gettext tools
function $gettext(msg) {
  return msg
}

const appInfo = {
  name: $gettext('Files'),
  id: 'files',
  icon: 'folder',
  isFileEditor: false,
  extensions: [],
  fileSideBars
}

const navItemFirst = [
  {
    name: $gettext('All files'),
    icon: appInfo.icon,
    hideByLightweight: true,
    route: {
      path: `/${appInfo.id}/spaces/personal/home`
    }
  }
]
const navItems = [
  {
    name: $gettext('Favorites'),
    icon: 'star',
    route: {
      path: `/${appInfo.id}/favorites`
    },
    enabled(capabilities) {
      return capabilities.files && capabilities.files.favorites
    }
  },
  {
    name: $gettext('Shared with me'),
    icon: 'share-forward',
    route: {
      path: `/${appInfo.id}/shares/with-me`
    }
  },
  {
    name: $gettext('Shared with others'),
    icon: 'reply',
    route: {
      path: `/${appInfo.id}/shares/with-others`
    }
  },
  {
    name: $gettext('Shared via link'),
    icon: 'link',
    route: {
      path: `/${appInfo.id}/shares/via-link`
    }
  },
  {
    name: $gettext('Spaces'),
    icon: 'layout-grid',
    route: {
      path: `/${appInfo.id}/spaces/projects`
    },
    enabled(capabilities) {
      return capabilities.spaces && capabilities.spaces.enabled === true
    }
  },
  {
    name: $gettext('Projects'),
    icon: 'layout-grid',
    route: {
      path: `/${appInfo.id}/projects`
    }
  },
  {
    name: $gettext('Deleted files'),
    icon: 'delete-bin-5',
    route: {
      path: `/${appInfo.id}/trash`
    },
    enabled(capabilities) {
      return capabilities.dav && capabilities.dav.trashbin === '1.0'
    }
  }
]

const navItemsLightweight = [
  {
    name: $gettext('Home'),
    icon: 'home-2',
    route: {
      path: `/${appInfo.id}/home`
    }
  },
  {
    name: $gettext('Shared with me'),
    icon: 'share-forward',
    route: {
      path: `/${appInfo.id}/shares/with-me`
    }
  },
  {
    name: $gettext('Projects'),
    icon: 'layout-grid',
    route: {
      path: `/${appInfo.id}/projects`
    }
  }
]

export default {
  appInfo,
  store,
  routes: buildRoutes({
    App,
    Favorites,
    Personal,
    FilesDrop,
    LocationPicker,
    PrivateLink,
    PublicFiles,
    PublicLink,
    SharedViaLink,
    SharedWithMe,
    SharedWithOthers,
    Spaces: {
      Projects: SpaceProjects
    },
    Trashbin,
    Home,
    Projects
  }),
  navItems: navItemFirst,
  quickActions,
  translations,
  ready({ router, store }) {
    Registry.filterSearch = new FilterSearch(store, router)
    Registry.sdkSearch = new SDKSearch(store, router)

    // when discussing the boot process of applications we need to implement a
    // registry that does not rely on call order, aka first register "on" and only after emit.
    bus.publish('app.search.register.provider', Registry.filterSearch)
    bus.publish('app.search.register.provider', Registry.sdkSearch)
  },
  userReady({ store }) {
    ;(store.getters.user.usertype && store.getters.user.usertype === 'lightweight'
      ? navItemsLightweight
      : navItems
    ).forEach((navItem) => {
      store.commit('ADD_NAV_ITEM', {
        extension: 'files',
        navItem
      })
    })
    archiverService.initialize(
      store.getters.configuration.server || window.location.origin,
      get(store, 'getters.capabilities.files.archivers', []),
      get(store, 'getters.capabilities.core.support-url-signing', true)
    )
  }
}
