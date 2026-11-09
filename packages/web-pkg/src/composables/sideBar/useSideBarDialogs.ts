import { nextTick, onBeforeUnmount, onMounted, Ref, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { isProjectSpaceResource, Resource, SpaceResource } from '@ownclouders/web-client'
import { eventBus } from '../../services/eventBus'
import { isLocationTrashActive } from '../../router'
import { useRouter } from '../router'
import {
  CustomComponentExtension,
  CustomModalComponent,
  useExtensionRegistry,
  useModals
} from '../piniaStores'
import { SideBarEventTopics } from './eventTopics'

/**
 * Opens dialogs where the file sidebar used to open: the share dialog for the sharing
 * panels, the members dialog for the members panel of a project space, and the details
 * dialog for the others. The files app registers the dialogs as extensions. Several
 * items, and items in the trash, have no dialog.
 */
export const useSideBarDialogs = ({
  space,
  items
}: {
  space: Ref<SpaceResource>
  items: Ref<Resource[]>
}) => {
  const router = useRouter()
  const { $gettext } = useGettext()
  const extensionRegistry = useExtensionRegistry()
  const { dispatchModal } = useModals()

  const dialogs = {
    share: {
      extensionPoint: 'global.files.share-dialog',
      elementClass: 'share-modal',
      title: (name: string) => $gettext('Share "%{name}"', { name })
    },
    members: {
      extensionPoint: 'global.files.space-members-dialog',
      elementClass: 'share-modal',
      title: (name: string) => $gettext('Members of "%{name}"', { name })
    },
    details: {
      extensionPoint: 'global.files.details-dialog',
      elementClass: 'details-modal',
      title: (name: string) => $gettext('Details of "%{name}"', { name })
    }
  }
  const requestDialog = (kind: keyof typeof dialogs) => {
    const [dialog] = extensionRegistry.requestExtensions<CustomComponentExtension>({
      id: dialogs[kind].extensionPoint,
      extensionType: 'customComponent'
    })
    return dialog
  }

  const openDialog = (panel?: string) => {
    if (unref(items)?.length !== 1 || isLocationTrashActive(router, 'files-trash-generic')) {
      return
    }
    const [resource] = unref(items)
    let kind: keyof typeof dialogs = 'details'
    if (panel?.startsWith('sharing')) {
      kind = 'share'
    } else if (panel === 'space-share' && isProjectSpaceResource(resource)) {
      kind = 'members'
    }
    let dialog = requestDialog(kind)
    // deployments can turn off the members, which then open the details, as with the sidebar
    if (!dialog && kind === 'members') {
      kind = 'details'
      dialog = requestDialog(kind)
    }
    if (!dialog) {
      return
    }

    dispatchModal({
      elementClass: dialogs[kind].elementClass,
      title: dialogs[kind].title(resource.name),
      hideActions: true,
      customComponent: dialog.content as CustomModalComponent,
      customComponentAttrs: () => ({ space: unref(space), resource })
    })
  }

  // The views make the file list narrower while the sidebar state is open, so it is closed
  // again. That waits for the other subscribers of the event, which set it to open.
  const closeSideBar = () => nextTick(() => eventBus.publish(SideBarEventTopics.close))
  const onOpen = (panel?: string) => {
    openDialog(panel)
    closeSideBar()
  }

  const tokens = [
    [SideBarEventTopics.open, eventBus.subscribe(SideBarEventTopics.open, () => onOpen())],
    [SideBarEventTopics.toggle, eventBus.subscribe(SideBarEventTopics.toggle, () => onOpen())],
    [
      SideBarEventTopics.openWithPanel,
      eventBus.subscribe(SideBarEventTopics.openWithPanel, (panel: string) => onOpen(panel))
    ]
  ]
  onBeforeUnmount(() => {
    tokens.forEach(([topic, token]) => eventBus.unsubscribe(topic, token))
  })

  // the open state is kept in the local storage, so it can be open from an older session
  onMounted(closeSideBar)
}
