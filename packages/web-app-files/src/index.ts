import App from './App.vue'
import Favorites from './views/Favorites.vue'
import FilesDrop from './views/FilesDrop.vue'
import SharedWithMe from './views/shares/SharedWithMe.vue'
import SharedWithOthers from './views/shares/SharedWithOthers.vue'
import SharedViaLink from './views/shares/SharedViaLink.vue'
import SpaceDriveResolver from './views/spaces/DriveResolver.vue'
import SpaceProjects from './views/spaces/Projects.vue'
import OfficeFiles from './views/OfficeFiles.vue'
import TrashOverview from './views/trash/Overview.vue'
import translations from '../l10n/translations.json'
import {
  ApplicationInformation,
  defineWebApplication,
  useCapabilityStore,
  useEmbedMode,
  useSpacesStore,
  useUserStore
} from '@ownclouders/web-pkg'
import { extensions } from './extensions'
import { buildRoutes } from '@ownclouders/web-pkg'
import { AppNavigationItem } from '@ownclouders/web-pkg'

// dirty: importing view from other extension within project
import SearchResults from '../../web-app-search/src/views/List.vue'
import {
  isFallbackSpaceResource,
  isPersonalSpaceResource,
  isShareSpaceResource,
  isProjectSpaceResource
} from '@ownclouders/web-client'
import { ComponentCustomProperties, unref } from 'vue'
import { extensionPoints } from './extensionPoints'

// just a dummy function to trick gettext tools
function $gettext(msg: string) {
  return msg
}

const appInfo: ApplicationInformation = {
  name: $gettext('Files'),
  id: 'files',
  icon: 'resource-type-folder',
  color: 'var(--oc-color-swatch-primary-muted)',
  extensions: []
}

export const navItems = (context: ComponentCustomProperties): AppNavigationItem[] => {
  const spacesStores = useSpacesStore()
  const userStore = useUserStore()
  const capabilityStore = useCapabilityStore()
  const { isEnabled: isEmbedModeEnabled } = useEmbedMode()

  return [
    {
      name() {
        return $gettext('Personal')
      },
      icon: appInfo.icon,
      route: {
        path: `/${appInfo.id}/spaces/personal`
      },
      isActive: () => {
        return !spacesStores.currentSpace || spacesStores.currentSpace?.isOwner(userStore.user)
      },
      activeFor: () => {
        const personalSpace = spacesStores.spaces.find(
          (drive) => isPersonalSpaceResource(drive) && drive.isOwner(userStore.user)
        )

        return personalSpace
          ? [
              {
                path: `/${appInfo.id}/spaces/${personalSpace.driveAlias}`
              }
            ]
          : []
      },
      isVisible() {
        // personal spaces are fetched on demand, so "not loaded yet" must not read as "the user
        // has none" - that would hide the item for the rest of the session
        if (!spacesStores.initializedTypes.personal) {
          return true
        }

        return !!spacesStores.spaces.find(
          (drive) => isPersonalSpaceResource(drive) && drive.isOwner(userStore.user)
        )
      },
      priority: 10
    },
    {
      name: $gettext('Favorites'),
      icon: 'star',
      route: {
        path: `/${appInfo.id}/favorites`
      },
      isVisible() {
        return capabilityStore.filesFavorites && context.$ability.can('read', 'Favorite')
      },
      priority: 20
    },
    {
      name: $gettext('My office files'),
      icon: 'file-list',
      route: {
        path: `/${appInfo.id}/office-files`
      },
      isVisible() {
        return capabilityStore.groupCapabilities?.includes('office-view')
      },
      priority: 25
    },
    {
      name: $gettext('Shares'),
      icon: 'share-forward',
      route: {
        path: `/${appInfo.id}/shares`
      },
      isActive: () => {
        const space = spacesStores.currentSpace
        // last check is when fullShareOwnerPaths is enabled
        return !space || isShareSpaceResource(space) || !space?.isOwner(userStore.user)
      },
      activeFor: () => {
        const shares = [
          { path: `/${appInfo.id}/spaces/share` },
          { path: `/${appInfo.id}/spaces/ocm-share` },
          { path: `/${appInfo.id}/spaces/personal` }
        ]
        spacesStores.spaces.forEach((drive) => {
          if (isShareSpaceResource(drive)) {
            shares.push({
              path: `/${appInfo.id}/spaces/${drive.driveAlias}`
            })
          }
        })
        return shares
      },
      isVisible() {
        return capabilityStore.sharingApiEnabled !== false
      },
      priority: 30
    },
    {
      name: $gettext('Spaces'),
      icon: 'layout-grid',
      route: {
        path: `/${appInfo.id}/spaces/projects`
      },
      isActive: () => {
        // `currentSpace` is briefly null while navigating (the outgoing route's resolver clears it),
        // and it is permanently null on the projects overview itself - so "no space" has to stay
        // active, and the href match in activeFor is what narrows it down.
        const currentSpace = spacesStores.currentSpace
        return (
          !currentSpace ||
          isProjectSpaceResource(currentSpace) ||
          isFallbackSpaceResource(currentSpace)
        )
      },
      activeFor: () => {
        const projects = [{ path: `/${appInfo.id}/spaces/project` }]
        spacesStores.spaces.forEach((drive) => {
          // deliberately excludes the catch-all fallback space: its driveAlias ('eos') is a
          // url-prefix of every real eos-backed driveAlias, so listing it here would match any
          // eos route - including shares - and light this item up alongside the right one
          if (isProjectSpaceResource(drive)) {
            projects.push({
              path: `/${appInfo.id}/spaces/${drive.driveAlias}`
            })
          }
        })
        return projects
      },
      isVisible() {
        return capabilityStore.spacesProjects
      },
      priority: 40
    },
    {
      name: $gettext('Deleted files'),
      icon: 'delete-bin-5',
      route: {
        path: `/${appInfo.id}/trash/overview`
      },
      activeFor: () => [{ path: `/${appInfo.id}/trash` }],
      isVisible() {
        return (
          capabilityStore.davTrashbin === '1.0' &&
          capabilityStore.filesUndelete &&
          !unref(isEmbedModeEnabled)
        )
      },
      priority: 50
    }
  ]
}

export default defineWebApplication({
  setup() {
    return {
      appInfo,
      routes: buildRoutes({
        App,
        Favorites,
        OfficeFiles,
        FilesDrop,
        SearchResults,
        Shares: {
          SharedViaLink,
          SharedWithMe,
          SharedWithOthers
        },
        Spaces: {
          DriveResolver: SpaceDriveResolver,
          Projects: SpaceProjects
        },
        Trash: {
          Overview: TrashOverview
        }
      }),
      navItems,
      translations,
      extensions: extensions(appInfo),
      extensionPoints: extensionPoints()
    }
  }
})
