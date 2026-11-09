import { mock } from 'vitest-mock-extended'
import { nextTick, ref } from 'vue'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import {
  CustomComponentExtension,
  eventBus,
  ExtensionPoint,
  Modal,
  SideBarEventTopics,
  useExtensionRegistry,
  useModals,
  useSideBarDialogs
} from '../../../../src'

const resource = { id: '1', name: 'notes.txt' } as Resource
const projectSpace = { id: '2', name: 'test', driveType: 'project' } as SpaceResource
const allDialogs = [
  'global.files.share-dialog',
  'global.files.details-dialog',
  'global.files.space-members-dialog'
]

describe('useSideBarDialogs', () => {
  it.each([
    { topic: SideBarEventTopics.open, panel: undefined, elementClass: 'details-modal' },
    { topic: SideBarEventTopics.toggle, panel: undefined, elementClass: 'details-modal' },
    { topic: SideBarEventTopics.openWithPanel, panel: 'versions', elementClass: 'details-modal' },
    {
      topic: SideBarEventTopics.openWithPanel,
      panel: 'sharing#peopleShares',
      elementClass: 'share-modal'
    }
  ])('opens the $elementClass for $topic $panel', ({ topic, panel, elementClass }) => {
    const { wrapper, dispatchModal } = getWrapper({ items: [resource] })
    eventBus.publish(topic, panel)
    expect(dispatchModal).toHaveBeenCalledWith(expect.objectContaining({ elementClass }))
    wrapper.unmount()
  })
  it('opens the members of a project space', () => {
    const { wrapper, dispatchModal } = getWrapper({ items: [projectSpace] })
    eventBus.publish(SideBarEventTopics.openWithPanel, 'space-share')
    expect(dispatchModal).toHaveBeenCalledWith(
      expect.objectContaining({ elementClass: 'share-modal', title: 'Members of "test"' })
    )
    wrapper.unmount()
  })
  it('opens the details of a project space when its members are turned off', () => {
    const { wrapper, dispatchModal } = getWrapper({
      items: [projectSpace],
      registered: ['global.files.share-dialog', 'global.files.details-dialog']
    })
    eventBus.publish(SideBarEventTopics.openWithPanel, 'space-share')
    expect(dispatchModal).toHaveBeenCalledWith(
      expect.objectContaining({ elementClass: 'details-modal' })
    )
    wrapper.unmount()
  })
  it('opens no dialog for several items', () => {
    const { wrapper, dispatchModal } = getWrapper({ items: [resource, resource] })
    eventBus.publish(SideBarEventTopics.open)
    expect(dispatchModal).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('closes the sidebar state again after an open event', async () => {
    const { wrapper } = getWrapper({ items: [resource] })
    const publish = vi.spyOn(eventBus, 'publish')
    eventBus.publish(SideBarEventTopics.open)
    await nextTick()
    expect(publish).toHaveBeenCalledWith(SideBarEventTopics.close)
    wrapper.unmount()
  })
})

function getWrapper({
  items,
  registered = allDialogs
}: {
  items: Resource[]
  registered?: string[]
}) {
  const mocks = defaultComponentMocks()
  let dispatchModal: (data: Omit<Modal, 'id'>) => Modal
  const wrapper = getComposableWrapper(
    () => {
      const { requestExtensions } = useExtensionRegistry()
      vi.mocked(requestExtensions).mockImplementation(({ id }: ExtensionPoint<any>) =>
        registered.includes(id) ? [mock<CustomComponentExtension>()] : []
      )
      dispatchModal = useModals().dispatchModal
      useSideBarDialogs({ space: ref(mock<SpaceResource>()), items: ref(items) })
    },
    { mocks, provide: mocks }
  )
  return { wrapper, dispatchModal }
}
