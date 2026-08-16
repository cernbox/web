import { createTestingPinia, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { AxiosError } from 'axios'
import {
  AddLinkOptions,
  AddShareOptions,
  DeleteLinkOptions,
  DeleteShareOptions,
  UpdateLinkOptions,
  UpdateShareOptions,
  useSharesStore,
  useUserStore
} from '../../../../src/composables/piniaStores'
import { mock, mockDeep } from 'vitest-mock-extended'
import { ClientService } from '../../../../src/services'
import {
  CollaboratorShare,
  LinkShare,
  Resource,
  SHARE_HIERARCHY_FORCE_HEADER,
  SharingHierarchyConflictRemoveShareError,
  SpaceResource
} from '@ownclouders/web-client'
import { User } from '@ownclouders/web-client/graph/generated'

describe('useSharesStore', () => {
  const space = { id: 'space-1' } as SpaceResource

  function conflict409() {
    return new AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        status: 409,
        statusText: 'Conflict',
        data: {
          error_type: 'child_conflict',
          message: 'x',
          can_force: true
        },
        headers: {},
        config: {} as any
      }
    )
  }

  function parentConflict409() {
    return new AxiosError(
      'Conflict',
      'ERR_BAD_REQUEST',
      undefined,
      {},
      {
        status: 409,
        statusText: 'Conflict',
        data: {
          error_type: 'parent_conflict',
          message: 'Already shared through parent',
          can_force: false
        },
        headers: {},
        config: {} as any
      }
    )
  }

  beforeEach(() => {
    createTestingPinia({
      stubActions: false,
      initialState: { resources: { currentFolder: mock<Resource>() } }
    })
  })

  describe('addShare', () => {
    it('adds a collaborator share', () => {
      getWrapper({
        setup: async (instance) => {
          const resource = { id: '1' } as Resource
          const share = mock<CollaboratorShare>({ id: '1' })
          const user = { id: '1' } as User

          const clientService = mockDeep<ClientService>()
          clientService.graphAuthenticated.permissions.createInvite.mockResolvedValue(share)

          const userStore = useUserStore()
          userStore.user = user

          await instance.addShare(mock<AddShareOptions>({ clientService, resource, space }))

          expect(clientService.graphAuthenticated.permissions.createInvite).toHaveBeenCalledTimes(1)
          expect(instance.collaboratorShares.length).toBe(1)
        }
      })
    })

    it('retries createInvite with force header when user confirms after 409', async () => {
      const resource = { id: '1' } as Resource
      const share = mock<CollaboratorShare>({ id: '1' })
      const user = { id: '1' } as User

      const clientService = mockDeep<ClientService>()
      clientService.graphAuthenticated.permissions.createInvite
        .mockRejectedValueOnce(conflict409())
        .mockResolvedValueOnce(share)

      const userStore = useUserStore()
      userStore.user = user

      const instance = useSharesStore()

      await instance.addShare({
        clientService,
        resource,
        space,
        options: {} as AddShareOptions['options'],
        confirmSharingHierarchyConflict: () => Promise.resolve(true),
        deferSharingHierarchyConflictConfirm: false
      })

      expect(clientService.graphAuthenticated.permissions.createInvite).toHaveBeenCalledTimes(2)
      expect(clientService.graphAuthenticated.permissions.createInvite).toHaveBeenLastCalledWith(
        space.id,
        resource.id,
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          headers: { [SHARE_HIERARCHY_FORCE_HEADER]: 'true' }
        })
      )
      expect(instance.collaboratorShares.length).toBe(1)
    })

    it('throws pending error when deferSharingHierarchyConflictConfirm is set', async () => {
      const resource = { id: '1' } as Resource
      const user = { id: '1' } as User

      const clientService = mockDeep<ClientService>()
      clientService.graphAuthenticated.permissions.createInvite.mockRejectedValueOnce(conflict409())

      const userStore = useUserStore()
      userStore.user = user

      const instance = useSharesStore()

      await expect(
        instance.addShare({
          clientService,
          resource,
          space,
          options: {} as AddShareOptions['options'],
          deferSharingHierarchyConflictConfirm: true
        })
      ).rejects.toMatchObject({
        name: 'SharingHierarchyConflictPendingError',
        conflict: expect.objectContaining({ canForce: true })
      })

      expect(clientService.graphAuthenticated.permissions.createInvite).toHaveBeenCalledTimes(1)
    })

    it('shows inform dialog and throws blocked error on parent conflict', async () => {
      const resource = { id: '1' } as Resource
      const user = { id: '1' } as User

      const clientService = mockDeep<ClientService>()
      clientService.graphAuthenticated.permissions.createInvite.mockRejectedValueOnce(
        parentConflict409()
      )

      const userStore = useUserStore()
      userStore.user = user

      const instance = useSharesStore()
      const inform = vi.fn().mockResolvedValue(undefined)

      await expect(
        instance.addShare({
          clientService,
          resource,
          space,
          options: {} as AddShareOptions['options'],
          informSharingHierarchyConflict: inform
        })
      ).rejects.toMatchObject({ name: 'SharingHierarchyConflictBlockedError' })

      expect(inform).toHaveBeenCalledTimes(1)
      expect(clientService.graphAuthenticated.permissions.createInvite).toHaveBeenCalledTimes(1)
    })

    it('throws cancelled error when user declines force confirmation', async () => {
      const resource = { id: '1' } as Resource
      const user = { id: '1' } as User

      const clientService = mockDeep<ClientService>()
      clientService.graphAuthenticated.permissions.createInvite.mockRejectedValueOnce(conflict409())

      const userStore = useUserStore()
      userStore.user = user

      const instance = useSharesStore()

      await expect(
        instance.addShare({
          clientService,
          resource,
          space,
          options: {} as AddShareOptions['options'],
          confirmSharingHierarchyConflict: () => Promise.resolve(false)
        })
      ).rejects.toMatchObject({ name: 'SharingHierarchyConflictCancelledError' })

      expect(clientService.graphAuthenticated.permissions.createInvite).toHaveBeenCalledTimes(1)
    })

    it('propagates remove share choice from inform callback on parent conflict', async () => {
      const resource = { id: '1' } as Resource
      const share = mock<CollaboratorShare>({ id: 'share-1' })
      const user = { id: '1' } as User

      const clientService = mockDeep<ClientService>()
      clientService.graphAuthenticated.permissions.updatePermission
        .mockRejectedValueOnce(parentConflict409())
        .mockResolvedValueOnce(share)

      const userStore = useUserStore()
      userStore.user = user

      const instance = useSharesStore()
      const inform = vi.fn().mockRejectedValue(new SharingHierarchyConflictRemoveShareError())

      await expect(
        instance.updateShare({
          clientService,
          resource,
          space,
          collaboratorShare: share,
          options: {} as UpdateShareOptions['options'],
          informSharingHierarchyConflict: inform
        })
      ).rejects.toMatchObject({ name: 'SharingHierarchyConflictRemoveShareError' })

      expect(inform).toHaveBeenCalledTimes(1)
      expect(clientService.graphAuthenticated.permissions.updatePermission).toHaveBeenCalledTimes(1)
    })
  })
  describe('updateShare', () => {
    it('updates a collaborator share', () => {
      getWrapper({
        setup: async (instance) => {
          const resource = { id: '1' } as Resource
          const share = mock<CollaboratorShare>({ id: '1' })
          const user = { id: '1' } as User

          const clientService = mockDeep<ClientService>()
          clientService.graphAuthenticated.permissions.updatePermission.mockResolvedValue(share)

          const userStore = useUserStore()
          userStore.user = user

          await instance.updateShare(mock<UpdateShareOptions>({ clientService, resource }))

          expect(
            clientService.graphAuthenticated.permissions.updatePermission
          ).toHaveBeenCalledTimes(1)
        }
      })
    })
  })
  describe('deleteShare', () => {
    it('deletes a collaborator share', () => {
      getWrapper({
        setup: async (instance) => {
          const resource = { id: '1' } as Resource
          const clientService = mockDeep<ClientService>()
          clientService.graphAuthenticated.permissions.deletePermission.mockResolvedValue(undefined)

          await instance.deleteShare(mock<DeleteShareOptions>({ clientService, resource }))

          expect(
            clientService.graphAuthenticated.permissions.deletePermission
          ).toHaveBeenCalledTimes(1)
        }
      })
    })
  })

  describe('addLink', () => {
    it('adds a link share', () => {
      getWrapper({
        setup: async (instance) => {
          const resource = { id: '1' } as Resource
          const link = mock<LinkShare>({ id: '1' })
          const user = { id: '1' } as User

          const clientService = mockDeep<ClientService>()
          clientService.graphAuthenticated.permissions.createLink.mockResolvedValue(link)

          const userStore = useUserStore()
          userStore.user = user

          await instance.addLink(mock<AddLinkOptions>({ clientService, resource }))

          expect(clientService.graphAuthenticated.permissions.createLink).toHaveBeenCalledTimes(1)
          expect(instance.linkShares.length).toBe(1)
        }
      })
    })
  })
  describe('updateLink', () => {
    it('updates a link share', () => {
      getWrapper({
        setup: async (instance) => {
          const resource = { id: '1' } as Resource
          const link = mock<LinkShare>({ id: '1' })
          const user = { id: '1' } as User

          const clientService = mockDeep<ClientService>()
          clientService.graphAuthenticated.permissions.updatePermission.mockResolvedValue(link)

          const userStore = useUserStore()
          userStore.user = user

          await instance.updateLink(mock<UpdateLinkOptions>({ clientService, resource }))

          expect(
            clientService.graphAuthenticated.permissions.updatePermission
          ).toHaveBeenCalledTimes(1)
        }
      })
    })
  })
  describe('deleteLink', () => {
    it('deletes a link share', () => {
      getWrapper({
        setup: async (instance) => {
          const resource = { id: '1' } as Resource
          const clientService = mockDeep<ClientService>()
          clientService.graphAuthenticated.permissions.deletePermission.mockResolvedValue(undefined)

          await instance.deleteLink(mock<DeleteLinkOptions>({ clientService, resource }))

          expect(
            clientService.graphAuthenticated.permissions.deletePermission
          ).toHaveBeenCalledTimes(1)
        }
      })
    })
  })
})

function getWrapper({ setup }: { setup: (instance: ReturnType<typeof useSharesStore>) => void }) {
  return {
    wrapper: getComposableWrapper(
      () => {
        const instance = useSharesStore()
        setup(instance)
      },
      { pluginOptions: { pinia: false } }
    )
  }
}
