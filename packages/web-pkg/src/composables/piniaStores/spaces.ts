import { defineStore } from 'pinia'
import { computed, ref, unref } from 'vue'
import {
  buildShareSpaceResource,
  isMountPointSpaceResource,
  SpaceDeletedState,
  SpaceResource
} from '@ownclouders/web-client'
import { Graph } from '@ownclouders/web-client/graph'
import {
  buildSpace,
  extractStorageId,
  isPersonalSpaceResource,
  isProjectSpaceResource
} from '@ownclouders/web-client'
import type { CollaboratorShare, MountPointSpaceResource, ShareRole } from '@ownclouders/web-client'
import { useUserStore } from './user'
import { ConfigStore, useConfigStore } from './config'
import { useSharesStore } from './shares'

// sort space members with higher permissions (managers) at the top
export const sortSpaceMembers = (shares: CollaboratorShare[]) => {
  return shares.sort((a, b) => b.permissions.length - a.permissions.length)
}

/**
 * Drive types that are fetched from the graph API on demand. Ordered from cheapest/most likely to
 * most expensive, which is also the order the drive resolver tries them in.
 */
export type LoadableDriveType = 'personal' | 'project' | 'mountpoint'
export const LOADABLE_DRIVE_TYPES: LoadableDriveType[] = ['personal', 'project', 'mountpoint']

export const getSpacesByType = async ({
  graphClient,
  driveType,
  configStore,
  graphRoles,
  signal
}: {
  graphClient: Graph
  driveType: string
  configStore: ConfigStore
  graphRoles: Record<string, ShareRole>
  signal?: AbortSignal
}) => {
  const mountpoints = await graphClient.drives.listMyDrives(
    graphRoles,
    {
      orderBy: 'name asc',
      filter: `driveType eq ${driveType}`
    },
    { signal }
  )
  if (!mountpoints.length) {
    return []
  }

  const enabledMountpoints = mountpoints.filter(
    (space) =>
      !isPersonalSpaceResource(space) || space.root.deleted?.state !== SpaceDeletedState.Trashed
  )

  if (driveType !== 'mountpoint' || !configStore.options.routing?.fullShareOwnerPaths) {
    return enabledMountpoints
  }

  const rootSpaceDriveAliasMapping: Record<string, string> = {}
  enabledMountpoints.forEach((space) => {
    const { rootId, driveAlias } = space.root.remoteItem
    rootSpaceDriveAliasMapping[rootId] = driveAlias
  })

  const rootSpaces = Object.entries(rootSpaceDriveAliasMapping).map(([id, driveAlias]) =>
    // FIXME: create proper buildRootSpace (or whatever function)
    buildSpace(
      {
        id: extractStorageId(id),
        name: driveAlias.split('/').pop(),
        driveType: 'share', // FIXME: can we retrieve this from api?
        driveAlias,
        path: '/',
        serverUrl: configStore.serverUrl
      },
      graphRoles
    )
  )

  return [...enabledMountpoints, ...rootSpaces]
}

export const useSpacesStore = defineStore('spaces', () => {
  const userStore = useUserStore()
  const configStore = useConfigStore()
  const sharesStore = useSharesStore()

  const spaces = ref<SpaceResource[]>([])
  const currentSpace = ref<SpaceResource>()
  const spacesInitialized = ref(false)
  const initializedTypes = ref<Record<LoadableDriveType, boolean>>({
    personal: false,
    project: false,
    mountpoint: false
  })
  // in-flight loads, keyed by drive type, so concurrent callers share one promise and a type is
  // never fetched twice
  const pendingLoads = new Map<LoadableDriveType, Promise<void>>()

  /**
   * Whether the initial bootstrap is still running. This deliberately does NOT track on-demand
   * loads: the application layout swaps the whole router view for a spinner while it is true, so
   * letting a per-view refresh flip it would unmount and remount that view - and any view that
   * refreshes spaces on mount would loop forever.
   */
  const spacesLoading = ref(false)
  const isTypeInitialized = (driveType: LoadableDriveType) => unref(initializedTypes)[driveType]
  const mountPointsInitialized = computed(() => isTypeInitialized('mountpoint'))

  const personalSpace = computed(() => {
    return unref(spaces).find((s) => isPersonalSpaceResource(s) && s.isOwner(userStore.user))
  })

  const setSpacesInitialized = (value: boolean) => {
    spacesInitialized.value = value
  }

  const setTypeInitialized = (driveType: LoadableDriveType, value: boolean) => {
    initializedTypes.value = { ...unref(initializedTypes), [driveType]: value }
  }

  const setMountPointsInitialized = (value: boolean) => {
    setTypeInitialized('mountpoint', value)
  }

  const setSpacesLoading = (value: boolean) => {
    spacesLoading.value = value
  }

  const setCurrentSpace = (space: SpaceResource) => {
    currentSpace.value = space
  }

  const getSpaceMembers = (space: SpaceResource) => {
    // only project spaces have members
    if (!isProjectSpaceResource(space)) {
      return []
    }
    const members = sharesStore.collaboratorShares.filter((c) => c.resourceId === space.id)
    return sortSpaceMembers(members)
  }

  const addSpaces = (s: SpaceResource[]) => {
    unref(spaces).push(...s)
  }

  const removeSpace = (space: SpaceResource) => {
    spaces.value = unref(spaces).filter(({ id }) => id !== space.id)
  }

  const getSpace = (id: string) => {
    return unref(spaces).find((s) => id == s.id)
  }

  const getMountPointForSpace = async ({
    graphClient,
    space,
    signal
  }: {
    graphClient: Graph
    space: SpaceResource
    signal?: AbortSignal
  }): Promise<MountPointSpaceResource> => {
    await loadMountPoints({ graphClient, signal })

    // even if the resource has been shared via multiple permissions (e.g. directly via user and a group)
    // we only care about one matching mount point since the remote item contains all permissions
    return unref(spaces).find(
      (s) => isMountPointSpaceResource(s) && s.root?.remoteItem?.id === space.id
    )
  }

  const createShareSpace = ({
    driveAliasPrefix,
    id,
    shareName
  }: {
    driveAliasPrefix: 'share' | 'ocm-share'
    id: string
    shareName: string
  }) => {
    const space = buildShareSpaceResource({
      driveAliasPrefix,
      id,
      shareName,
      serverUrl: configStore.serverUrl
    })
    addSpaces([space])
    return space
  }

  const upsertSpace = (space: SpaceResource) => {
    const existingSpace = unref(spaces).find(({ id }) => id === space.id)
    if (existingSpace) {
      Object.assign(existingSpace, space)
      return
    }
    addSpaces([space])
  }

  const updateSpaceField = <T extends SpaceResource>({
    id,
    field,
    value
  }: {
    id: T['id']
    field: keyof T
    value: T[keyof T]
  }) => {
    const space = unref(spaces).find((space) => id === space.id) as T
    if (space) {
      space[field] = value
    }
  }

  /**
   * Loads all spaces of a single drive type, once per session unless `force` is given. Concurrent
   * callers share the same request. Spaces are deduplicated by id and driveAlias, so a type that
   * arrives late can't shadow an already loaded one, and a forced refresh picks up newly available
   * spaces without duplicating the known ones.
   */
  const loadSpacesByType = (
    driveType: LoadableDriveType,
    {
      graphClient,
      signal,
      force = false
    }: { graphClient: Graph; signal?: AbortSignal; force?: boolean }
  ): Promise<void> => {
    if (!force && isTypeInitialized(driveType)) {
      return Promise.resolve()
    }
    if (pendingLoads.has(driveType)) {
      return pendingLoads.get(driveType)
    }

    const promise = (async () => {
      try {
        const loadedSpaces = await getSpacesByType({
          graphClient,
          driveType,
          configStore,
          graphRoles: sharesStore.graphRoles,
          signal
        })
        const existingAliases = new Set(unref(spaces).map((s) => s.driveAlias))
        const existingIds = new Set(unref(spaces).map((s) => s.id))
        addSpaces(
          loadedSpaces.filter((s) => !existingAliases.has(s.driveAlias) && !existingIds.has(s.id))
        )
        setTypeInitialized(driveType, true)
      } finally {
        pendingLoads.delete(driveType)
      }
    })()

    pendingLoads.set(driveType, promise)
    return promise
  }

  /**
   * Bootstraps the store. The personal space is the one drive type virtually every part of the app
   * needs, so it is loaded up front; project and mount point spaces are fetched on demand by
   * `loadSpacesByType`, so a session never pays for listing potentially hundreds of project drives
   * it doesn't touch.
   */
  const loadSpaces = async ({
    graphClient,
    isInVault
  }: {
    graphClient: Graph
    isInVault: boolean
  }) => {
    spacesLoading.value = true
    try {
      await loadSpacesByType('personal', { graphClient })
      spacesInitialized.value = true
    } finally {
      spacesLoading.value = false
    }
  }

  const loadMountPoints = ({
    graphClient,
    signal,
    force
  }: {
    graphClient: Graph
    signal?: AbortSignal
    force?: boolean
  }) => loadSpacesByType('mountpoint', { graphClient, signal, force })

  const reloadProjectSpaces = async ({
    graphClient,
    isInVault,
    signal
  }: {
    graphClient: Graph
    isInVault: boolean
    signal?: AbortSignal
  }) => {
    const projectSpaces = await getSpacesByType({
      graphClient,
      driveType: 'project',
      configStore,
      graphRoles: sharesStore.graphRoles,
      signal
    })
    // only project spaces are being replaced here. The fallback space is not a project space and
    // is only ever constructed once - dropping it would destroy it for the rest of the session.
    // Same-alias share/mountpoint entries are dropped too: with lazy loading those can be fetched
    // before the project spaces are, and a synthesized share root must never shadow the real
    // project space it was derived from.
    const projectAliases = new Set(projectSpaces.map((s) => s.driveAlias))
    spaces.value = unref(spaces).filter(
      (s) => !isProjectSpaceResource(s) && !projectAliases.has(s.driveAlias)
    )
    addSpaces(projectSpaces)
    setTypeInitialized('project', true)
  }

  const getSpacesByName = (name: string): SpaceResource[] => {
    const matchingSpaces = unref(spaces).filter((s) => s.name === name)
    return matchingSpaces
  }

  return {
    spaces,
    spacesInitialized,
    mountPointsInitialized,
    spacesLoading,
    currentSpace,
    personalSpace,

    // exposed as state rather than through `isTypeInitialized` so that consumers keep working
    // under `createTestingPinia`, which stubs every function a store returns
    initializedTypes,

    getSpace,
    createShareSpace,
    setSpacesInitialized,
    setMountPointsInitialized,
    setTypeInitialized,
    setSpacesLoading,
    isTypeInitialized,
    setCurrentSpace,
    getSpaceMembers,
    getMountPointForSpace,

    addSpaces,
    removeSpace,
    upsertSpace,
    updateSpaceField,
    loadSpaces,
    loadSpacesByType,
    loadMountPoints,
    reloadProjectSpaces,
    getSpacesByName
  }
})

export type SpacesStore = ReturnType<typeof useSpacesStore>
