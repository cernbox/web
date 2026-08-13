import { getComposableWrapper } from '@ownclouders/web-test-helpers'
import {
  useSpacesStore,
  sortSpaceMembers,
  useSharesStore,
  useConfigStore,
  useUserStore
} from '../../../../src/composables/piniaStores'
import { createPinia, setActivePinia } from 'pinia'
import { mock, mockDeep } from 'vitest-mock-extended'
import { CollaboratorShare, GraphSharePermission, SpaceResource } from '@ownclouders/web-client'
import { Graph } from '@ownclouders/web-client/graph'
import { User } from '@ownclouders/web-client/graph/generated'

describe('spaces', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('method "sortSpaceMembers"', () => {
    it('sorts space members by amount of permissions', () => {
      const members = [
        mock<CollaboratorShare>({
          permissions: [],
          sharedWith: { displayName: 'user1' }
        }),
        mock<CollaboratorShare>({
          permissions: [GraphSharePermission.updatePermissions],
          sharedWith: { displayName: 'user2' }
        })
      ]

      const sortedMembers = sortSpaceMembers(members)
      expect(
        sortedMembers[0].permissions.includes(GraphSharePermission.updatePermissions)
      ).toBeTruthy()
    })
  })

  describe('computed "personalSpace"', () => {
    it('returns the personal space of a user', () => {
      getWrapper({
        setup: (instance) => {
          instance.spaces = [
            mock<SpaceResource>({ id: '1', isOwner: () => false, driveType: 'project' }),
            mock<SpaceResource>({ id: '2', isOwner: () => true, driveType: 'personal' })
          ]

          expect(instance.personalSpace.id).toEqual('2')
        }
      })
    })
  })

  describe('method "setSpacesInitialized"', () => {
    it('correctly sets spacesInitialized', () => {
      getWrapper({
        setup: (instance) => {
          instance.setSpacesInitialized(true)
          expect(instance.spacesInitialized).toEqual(true)

          instance.setSpacesInitialized(false)
          expect(instance.spacesInitialized).toEqual(false)
        }
      })
    })
  })
  describe('method "setMountPointsInitialized"', () => {
    it('correctly sets mountPointsInitialized', () => {
      getWrapper({
        setup: (instance) => {
          instance.setMountPointsInitialized(true)
          expect(instance.mountPointsInitialized).toEqual(true)

          instance.setMountPointsInitialized(false)
          expect(instance.mountPointsInitialized).toEqual(false)
        }
      })
    })
  })
  describe('method "setSpacesLoading"', () => {
    it('correctly sets spacesLoading', () => {
      getWrapper({
        setup: (instance) => {
          instance.setSpacesLoading(true)
          expect(instance.spacesLoading).toEqual(true)

          instance.setSpacesLoading(false)
          expect(instance.spacesLoading).toEqual(false)
        }
      })
    })
    it('is not flipped by on-demand loads', async () => {
      // the application layout swaps the whole router view for a spinner while this is true, so an
      // on-demand load must not toggle it - a view refreshing spaces on mount would remount itself
      // in a loop
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([mock<SpaceResource>({ id: '1' })])

          const load = instance.loadSpacesByType('project', { graphClient })
          expect(instance.spacesLoading).toEqual(false)
          await load
          expect(instance.spacesLoading).toEqual(false)
        }
      })
    })
  })
  describe('method "setCurrentSpace"', () => {
    it('correctly sets the current space', () => {
      getWrapper({
        setup: (instance) => {
          expect(instance.currentSpace).not.toBeDefined()

          const space = mock<SpaceResource>()
          instance.setCurrentSpace(space)
          expect(instance.currentSpace).toEqual(space)
        }
      })
    })
  })
  describe('method "addSpaces"', () => {
    it('correctly adds given spaces', () => {
      getWrapper({
        setup: (instance) => {
          expect(instance.spaces.length).toBe(0)

          const spaces = [mock<SpaceResource>({ id: '1' }), mock<SpaceResource>({ id: '2' })]
          instance.addSpaces(spaces)
          expect(instance.spaces).toEqual(spaces)
        }
      })
    })
  })
  describe('method "removeSpace"', () => {
    it('correctly removes a given space', () => {
      getWrapper({
        setup: (instance) => {
          const spaces = [mock<SpaceResource>({ id: '1' })]
          instance.addSpaces(spaces)
          expect(instance.spaces).toEqual(spaces)

          instance.removeSpace(spaces[0])
          expect(instance.spaces.length).toBe(0)
        }
      })
    })
  })
  describe('method "upsertSpace"', () => {
    it('updates a given space if it exsits', () => {
      getWrapper({
        setup: (instance) => {
          const space = mock<SpaceResource>({ id: '1', name: 'foo' })
          instance.addSpaces([space])
          expect(instance.spaces.length).toBe(1)
          expect(instance.spaces[0].name).toEqual('foo')

          instance.upsertSpace({ ...space, name: 'bar' })
          expect(instance.spaces.length).toBe(1)
          expect(instance.spaces[0].name).toEqual('bar')
        }
      })
    })
    it('adds a given space if it does not exsit', () => {
      getWrapper({
        setup: (instance) => {
          const space = mock<SpaceResource>({ id: '1', name: 'foo' })
          instance.addSpaces([space])
          expect(instance.spaces.length).toBe(1)
          expect(instance.spaces[0].name).toEqual('foo')

          instance.upsertSpace(mock<SpaceResource>({ id: '2', name: 'bar' }))
          expect(instance.spaces.length).toBe(2)
        }
      })
    })
  })
  describe('method "updateSpaceField"', () => {
    it('correctly updates a field of a space', () => {
      getWrapper({
        setup: (instance) => {
          const space = mock<SpaceResource>({ id: '1', name: 'foo' })
          instance.addSpaces([space])
          expect(instance.spaces.length).toBe(1)
          expect(instance.spaces[0].name).toEqual('foo')

          instance.updateSpaceField({ id: space.id, field: 'name', value: 'bar' })
          expect(instance.spaces[0].name).toEqual('bar')
        }
      })
    })
  })
  describe('method "loadSpaces"', () => {
    it('loads personal spaces only - project and mount points are loaded on demand', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([mock<SpaceResource>({ id: '1' })])
          await instance.loadSpaces({ graphClient })

          expect(graphClient.drives.listMyDrives).toHaveBeenCalledTimes(1)
          expect(graphClient.drives.listMyDrives).toHaveBeenCalledWith(
            {},
            { orderBy: 'name asc', filter: 'driveType eq personal' },
            expect.anything()
          )
          expect(instance.spacesInitialized).toBeTruthy()
          expect(instance.initializedTypes.personal).toBeTruthy()
          expect(instance.initializedTypes.project).toBeFalsy()
          expect(instance.initializedTypes.mountpoint).toBeFalsy()
        }
      })
    })
    it('does not add an eos explorer space when runningOnEos is disabled', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([])
          const configStore = useConfigStore()
          configStore.options.runningOnEos = false

          await instance.loadSpaces({ graphClient })

          expect(instance.spaces.some((s) => s.driveType === 'explorer')).toBeFalsy()
        }
      })
    })
    it('adds an eos explorer space when runningOnEos is enabled', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([])
          const configStore = useConfigStore()
          configStore.options.runningOnEos = true
          const userStore = useUserStore()
          userStore.setUser(mock<User>({ onPremisesSamAccountName: 'jdoe' }))

          await instance.loadSpaces({ graphClient })

          const explorerSpace = instance.spaces.find((s) => s.driveType === 'explorer')
          expect(explorerSpace).toBeDefined()
          expect(explorerSpace.driveAlias).toBe('eos')
          expect(explorerSpace.webDavPath).toBe('/files/jdoe/eos')
        }
      })
    })
    it('does not add the eos explorer space twice', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([])
          const configStore = useConfigStore()
          configStore.options.runningOnEos = true
          const userStore = useUserStore()
          userStore.setUser(mock<User>({ onPremisesSamAccountName: 'jdoe' }))

          await instance.loadSpaces({ graphClient })
          await instance.loadSpaces({ graphClient })

          expect(instance.spaces.filter((s) => s.driveType === 'explorer').length).toBe(1)
        }
      })
    })
  })
  describe('method "loadSpacesByType"', () => {
    it('loads a drive type once and shares in-flight requests', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([mock<SpaceResource>({ id: '1' })])

          // concurrent callers must not produce two requests
          await Promise.all([
            instance.loadSpacesByType('project', { graphClient }),
            instance.loadSpacesByType('project', { graphClient })
          ])
          // and neither must a later one, once initialized
          await instance.loadSpacesByType('project', { graphClient })

          expect(graphClient.drives.listMyDrives).toHaveBeenCalledTimes(1)
          expect(graphClient.drives.listMyDrives).toHaveBeenCalledWith(
            {},
            { orderBy: 'name asc', filter: 'driveType eq project' },
            expect.anything()
          )
          expect(instance.initializedTypes.project).toBeTruthy()
          expect(instance.spaces.length).toBe(1)
        }
      })
    })
    it('refetches a drive type when forced', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([
            mock<SpaceResource>({ id: '1', driveAlias: 'a' })
          ])
          await instance.loadSpacesByType('mountpoint', { graphClient })
          await instance.loadSpacesByType('mountpoint', { graphClient })
          expect(graphClient.drives.listMyDrives).toHaveBeenCalledTimes(1)

          graphClient.drives.listMyDrives.mockResolvedValue([
            mock<SpaceResource>({ id: '1', driveAlias: 'a' }),
            mock<SpaceResource>({ id: '2', driveAlias: 'b' })
          ])
          await instance.loadSpacesByType('mountpoint', { graphClient, force: true })

          expect(graphClient.drives.listMyDrives).toHaveBeenCalledTimes(2)
          // the newly available space shows up, the known one isn't duplicated
          expect(instance.spaces.length).toBe(2)
        }
      })
    })
    it('does not add a space that is already known', async () => {
      await getWrapper({
        setup: async (instance) => {
          const existing = mock<SpaceResource>({ id: '1', driveAlias: 'eos/project/c/cernbox' })
          instance.addSpaces([existing])

          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([
            mock<SpaceResource>({ id: '1', driveAlias: 'eos/project/c/cernbox' })
          ])
          await instance.loadSpacesByType('project', { graphClient })

          expect(instance.spaces.length).toBe(1)
        }
      })
    })
  })
  describe('method "loadMountPoints"', () => {
    it('correctly loads mount points', async () => {
      await getWrapper({
        setup: async (instance) => {
          const spaces = [mock<SpaceResource>({ id: '1' })]
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue(spaces)
          await instance.loadMountPoints({ graphClient })

          expect(graphClient.drives.listMyDrives).toHaveBeenCalledTimes(1)
          expect(graphClient.drives.listMyDrives).toHaveBeenCalledWith(
            {},
            {
              orderBy: 'name asc',
              filter: 'driveType eq mountpoint'
            },
            expect.anything()
          )
          expect(instance.spaces.length).toBe(1)
          expect(instance.mountPointsInitialized).toBeTruthy()
        }
      })
    })
  })
  describe('method "reloadProjectSpaces"', () => {
    it('correctly reloads project spaces', async () => {
      await getWrapper({
        setup: async (instance) => {
          const spaces = [mock<SpaceResource>({ id: '1' })]
          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue(spaces)
          await instance.reloadProjectSpaces({ graphClient })

          expect(graphClient.drives.listMyDrives).toHaveBeenCalledTimes(1)
          expect(graphClient.drives.listMyDrives).toHaveBeenCalledWith(
            {},
            {
              orderBy: 'name asc',
              filter: 'driveType eq project'
            },
            expect.anything()
          )
          expect(instance.spaces.length).toBe(1)
        }
      })
    })
    it('keeps the catch-all fallback space', async () => {
      await getWrapper({
        setup: async (instance) => {
          const fallbackSpace = mock<SpaceResource>({ id: 'fallback', driveType: 'explorer' })
          instance.spaces = [mock<SpaceResource>({ id: 'old', driveType: 'project' }), fallbackSpace]

          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([
            mock<SpaceResource>({ id: 'fresh', driveType: 'project' })
          ])
          await instance.reloadProjectSpaces({ graphClient })

          expect(instance.spaces.some((s) => s.driveType === 'explorer')).toBeTruthy()
          expect(instance.spaces.some(({ id }) => id === 'old')).toBeFalsy()
          expect(instance.spaces.some(({ id }) => id === 'fresh')).toBeTruthy()
        }
      })
    })
    it('keeps other non-project spaces', async () => {
      await getWrapper({
        setup: async (instance) => {
          instance.spaces = [
            mock<SpaceResource>({ id: 'mp', driveType: 'mountpoint' }),
            mock<SpaceResource>({ id: 'personal', driveType: 'personal' })
          ]

          const graphClient = mockDeep<Graph>()
          graphClient.drives.listMyDrives.mockResolvedValue([])
          await instance.reloadProjectSpaces({ graphClient })

          expect(instance.spaces.some(({ id }) => id === 'mp')).toBeTruthy()
          expect(instance.spaces.some(({ id }) => id === 'personal')).toBeTruthy()
        }
      })
    })
  })
  describe('method "getSpaceMembers"', () => {
    it('correctly returns members for project spaces', () => {
      getWrapper({
        setup: (instance) => {
          const space = mock<SpaceResource>({ id: '1', driveType: 'project' })
          const sharesStore = useSharesStore()
          sharesStore.collaboratorShares = [mock<CollaboratorShare>({ resourceId: space.id })]
          const members = instance.getSpaceMembers(space)

          expect(members.length).toBe(1)
        }
      })
    })
    it('does not return members for personal space', () => {
      getWrapper({
        setup: (instance) => {
          const space = mock<SpaceResource>({ id: '1', driveType: 'personal' })
          const sharesStore = useSharesStore()
          sharesStore.collaboratorShares = [mock<CollaboratorShare>({ resourceId: space.id })]
          const members = instance.getSpaceMembers(space)

          expect(members.length).toBe(0)
        }
      })
    })
  })
  describe('method "getMountPointForSpace"', () => {
    it('returns a matching mount point', async () => {
      await getWrapper({
        setup: async (instance) => {
          const graphClient = mockDeep<Graph>()
          const space = mock<SpaceResource>({ id: '1', driveType: 'project' })
          const mountpoints = [
            mock<SpaceResource>({
              id: '2',
              driveType: 'mountpoint',
              root: { remoteItem: { id: space.id } }
            })
          ]
          instance.spaces = mountpoints
          instance.setMountPointsInitialized(true)
          const mountPoint = await instance.getMountPointForSpace({ graphClient, space })

          expect(mountPoint).toEqual(mountpoints[0])
        }
      })
    })
  })
})

async function getWrapper({
  setup
}: {
  setup: (instance: ReturnType<typeof useSpacesStore>) => void | Promise<void>
}) {
  // the setup runs synchronously inside `mount`, so synchronous tests can still call this without
  // awaiting. Async setups must be awaited though - otherwise their assertions run after the test
  // has already returned and failures never get attributed to it.
  let result: void | Promise<void>
  const wrapper = getComposableWrapper(
    () => {
      const instance = useSpacesStore()
      result = setup(instance)
    },
    { pluginOptions: { pinia: false } }
  )
  await result
  return { wrapper }
}
