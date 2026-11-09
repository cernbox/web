import {
  ApplicationInformation,
  Extension,
  useCapabilityStore,
  useConfigStore,
  useRouter,
  useSearch,
  useUserStore
} from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { SDKSearch } from './search'
import { useFolderViews } from './composables/extensions/useFolderViews'
import { useFileActions } from './composables/extensions/useFileActions'
import { urlJoin } from '@ownclouders/web-client'
import ShareModal from './components/Modals/ShareModal.vue'
import DetailsModal from './components/Modals/DetailsModal.vue'
import {
  detailsDialogExtensionPoint,
  shareDialogExtensionPoint,
  spaceMembersDialogExtensionPoint
} from './extensionPoints'

export const extensions = (appInfo: ApplicationInformation) => {
  const capabilityStore = useCapabilityStore()
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const router = useRouter()
  const { search: searchFunction } = useSearch()

  const fileActionExtensions = useFileActions()
  const folderViewExtensions = useFolderViews()

  return computed<Extension[]>(() => [
    ...fileActionExtensions,
    ...folderViewExtensions,
    {
      id: 'com.github.owncloud.web.files.share-dialog',
      extensionPointIds: [shareDialogExtensionPoint.id],
      type: 'customComponent',
      content: ShareModal
    },
    {
      id: 'com.github.owncloud.web.files.details-dialog',
      extensionPointIds: [detailsDialogExtensionPoint.id],
      type: 'customComponent',
      content: DetailsModal
    },
    {
      // The id of the members panel of the sidebar, which deployments may have turned off
      // with disabledExtensions. The members of a project space then open its details.
      id: 'com.github.owncloud.web.files.sidebar-panel.projects.sharing',
      extensionPointIds: [spaceMembersDialogExtensionPoint.id],
      type: 'customComponent',
      content: ShareModal
    },
    {
      id: 'com.github.owncloud.web.files.search',
      extensionPointIds: ['app.search.provider'],
      type: 'search',
      searchProvider: new SDKSearch(capabilityStore, router, searchFunction, configStore)
    },
    ...((userStore.user && [
      {
        id: `app.${appInfo.id}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        priority: 10,
        path: urlJoin(appInfo.id)
      }
    ]) ||
      [])
  ])
}
