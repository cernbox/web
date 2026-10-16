import { FolderLoader, FolderLoaderTask, TaskContext } from '../folder'
import { Router } from 'vue-router'
import { useTask } from 'vue-concurrency'
import isEmpty from 'lodash-es/isEmpty'
import {
  isLocationPublicActive,
  isLocationSpacesActive,
  SharesStore,
  SpacesStore,
  UserStore,
  getSharedDriveItem
} from '@ownclouders/web-pkg'
import {
  buildIncomingShareResource,
  call,
  isPersonalSpaceResource,
  isPublicSpaceResource,
  isShareSpaceResource,
  Resource,
  SpaceMember,
  SpaceResource
} from '@ownclouders/web-client'
import type { Graph } from '@ownclouders/web-client/graph'
import { unref } from 'vue'
import { FolderLoaderOptions } from './types'
import { useFileRouteReplace } from '@ownclouders/web-pkg'
import { getIndicators } from '@ownclouders/web-pkg'
import { DriveItem } from '@ownclouders/web-client/graph/generated'

const receivedOcmWebAppMemoTtlMs = 60 * 1000

type ReceivedOcmWebAppMemoEntry = {
  ocmWebApp: Resource['ocmWebApp']
  storedAt: number
}

// performance.now() stays monotonic when the wall clock jumps.
function receivedOcmWebAppMemoNow(): number {
  return performance.now()
}

export class FolderLoaderSpace implements FolderLoader {
  private receivedOcmWebAppMemoUserId: string | undefined
  private readonly receivedOcmWebAppMemo = new Map<string, ReceivedOcmWebAppMemoEntry>()

  public isEnabled(): boolean {
    return true
  }

  public isActive(router: Router): boolean {
    // TODO: remove next check when isLocationSpacesActive doesn't return true for generic route when being on projects overview.
    if (isLocationSpacesActive(router, 'files-spaces-projects')) {
      return false
    }
    return (
      isLocationSpacesActive(router, 'files-spaces-generic') ||
      isLocationPublicActive(router, 'files-public-link')
    )
  }

  public getTask(context: TaskContext): FolderLoaderTask {
    const {
      router,
      clientService,
      resourcesStore,
      userStore,
      authService,
      spacesStore,
      sharesStore,
      configStore
    } = context
    const { webdav, graphAuthenticated: graphClient } = clientService
    const { replaceInvalidFileRoute } = useFileRouteReplace({ router })

    const setCurrentUserShareSpacePermissions = this.setCurrentUserShareSpacePermissions
    const syncReceivedOcmWebAppMemoUser = (userId: string | undefined) => {
      this.syncReceivedOcmWebAppMemoUser(userId)
    }
    const readReceivedOcmWebAppMemo = (userId: string | undefined, spaceId: string) => {
      return this.readReceivedOcmWebAppMemo(userId, spaceId)
    }
    const rememberReceivedOcmWebApp = (
      userId: string | undefined,
      spaceId: string,
      ocmWebApp: Resource['ocmWebApp']
    ) => {
      this.rememberReceivedOcmWebApp(userId, spaceId, ocmWebApp)
    }

    return useTask(function* (
      signal1,
      signal2,
      space: SpaceResource,
      path: string = null,
      fileId: string = null,
      options: FolderLoaderOptions = {}
    ) {
      try {
        // Identity is fixed before any abortable request so logout cannot leave another user's memo.
        syncReceivedOcmWebAppMemoUser(receivedOcmWebAppUserId(userStore))
        resourcesStore.clearResourceList()
        const previousShareOcmWebApp = isShareSpaceResource(space) ? space.ocmWebApp : undefined
        if (isShareSpaceResource(space)) {
          clearSpaceOcmWebApp(space, spacesStore)
        }

        // eslint-disable-next-line prefer-const
        let { resource: currentFolder, children: resources } = yield* call(
          webdav.listFiles(space, { path, fileId }, { signal: signal1 })
        )
        // if current folder has no id (= singe file public link) we must not correct the route
        if (currentFolder.id) {
          replaceInvalidFileRoute({ space, resource: currentFolder, path, fileId })
        }

        let sharedDriveItem: DriveItem

        if (path === '/') {
          if (isShareSpaceResource(space)) {
            sharedDriveItem = yield* call(
              getSharedDriveItem({ graphClient, spacesStore, space, signal: signal1 })
            )
            if (sharedDriveItem) {
              currentFolder = buildIncomingShareResource({
                graphRoles: sharesStore.graphRoles,
                driveItem: sharedDriveItem,
                serverUrl: configStore.serverUrl
              })
            }
          } else if (!isPersonalSpaceResource(space) && !isPublicSpaceResource(space)) {
            // note: in the future we might want to show the space as root for personal spaces as well (to show quota and the like). Currently not needed.
            currentFolder = space
          }
        }

        yield resourcesStore.loadAncestorMetaData({
          folder: currentFolder,
          space,
          client: webdav,
          signal: signal1
        })

        if (options.loadShares) {
          const ancestorMetaData = resourcesStore.ancestorMetaData
          for (const file of resources) {
            file.indicators = getIndicators({
              space,
              resource: file,
              ancestorMetaData,
              user: userStore.user
            })
          }
        }

        if (isShareSpaceResource(space)) {
          // Memoized per user and space. A miss does one shared-with-me lookup.
          const userId = receivedOcmWebAppUserId(userStore)
          syncReceivedOcmWebAppMemoUser(userId)
          const cachedReceivedOcmWebApp = readReceivedOcmWebAppMemo(userId, space.id)
          let receivedOcmWebAppLookup: ReceivedOcmWebAppLookupResult
          let storeReceivedOcmWebApp = false
          if (cachedReceivedOcmWebApp) {
            receivedOcmWebAppLookup = cachedReceivedOcmWebApp
          } else {
            receivedOcmWebAppLookup = yield* call(
              loadReceivedOcmWebApp({
                graphClient,
                graphRoles: sharesStore.graphRoles,
                serverUrl: configStore.serverUrl,
                spaceId: space.id,
                signal: signal1
              })
            )
            const userIdAfterLookup = receivedOcmWebAppUserId(userStore)
            if (userIdAfterLookup !== userId) {
              syncReceivedOcmWebAppMemoUser(userIdAfterLookup)
            } else if (
              userId &&
              !isAbortedSignal(signal1) &&
              receivedOcmWebAppLookup.kind === 'resolved'
            ) {
              storeReceivedOcmWebApp = true
            }
          }

          // add current user as space member if not already loaded
          if (isEmpty(space.members)) {
            if (!sharedDriveItem) {
              sharedDriveItem = yield* call(
                getSharedDriveItem({ graphClient, spacesStore, space, signal: signal1 })
              )
            }
            setCurrentUserShareSpacePermissions({
              sharesStore,
              spacesStore,
              userStore,
              space,
              sharedDriveItem
            })
          }

          if (receivedOcmWebAppLookup.kind === 'resolved') {
            if (storeReceivedOcmWebApp) {
              const userIdAtStore = receivedOcmWebAppUserId(userStore)
              if (userIdAtStore !== userId || isAbortedSignal(signal1)) {
                syncReceivedOcmWebAppMemoUser(userIdAtStore)
              } else {
                rememberReceivedOcmWebApp(userId, space.id, receivedOcmWebAppLookup.ocmWebApp)
              }
            }
            // A user switch during the lookup must not publish that user's metadata.
            const userIdAtPublish = receivedOcmWebAppUserId(userStore)
            if (userIdAtPublish === userId) {
              const ocmWebApp = receivedOcmWebAppLookup.ocmWebApp
              space.ocmWebApp = ocmWebApp
              spacesStore.updateSpaceField({
                id: space.id,
                field: 'ocmWebApp',
                value: ocmWebApp
              })

              // TODO: remove when server returns share id for federated shares in propfind response
              resources.forEach((resource) => {
                resource.remoteItemId = space.id
                resource.ocmWebApp = ocmWebApp
              })
              currentFolder.remoteItemId = space.id
              currentFolder.ocmWebApp = ocmWebApp
            }
          } else {
            if (previousShareOcmWebApp !== undefined) {
              space.ocmWebApp = previousShareOcmWebApp
              spacesStore.updateSpaceField({
                id: space.id,
                field: 'ocmWebApp',
                value: previousShareOcmWebApp
              })
            }
            resources.forEach((resource) => {
              resource.remoteItemId = space.id
            })
            currentFolder.remoteItemId = space.id
          }
        } else {
          clearInheritedOcmWebApp(currentFolder, resources)
        }

        resourcesStore.initResourceList({ currentFolder, resources })
      } catch (error) {
        resourcesStore.setCurrentFolder(null)
        console.error('Failed to load folder')

        if (isAuthError(error)) {
          return authService.handleAuthError(unref(router.currentRoute))
        }
      }
    }).restartable()
  }

  /**
   * Since shared spaces are only virtual, they and their permissions can't be fetched from the server.
   * Hence the permissions for the current user need to be set manually via the corresponding drive item.
   */
  private setCurrentUserShareSpacePermissions({
    sharesStore,
    spacesStore,
    userStore,
    space,
    sharedDriveItem
  }: {
    sharesStore: SharesStore
    spacesStore: SpacesStore
    userStore: UserStore
    space: SpaceResource
    sharedDriveItem: DriveItem
  }) {
    const permissions = sharedDriveItem?.remoteItem?.permissions || []
    if (!permissions.length) {
      return
    }

    const allPermissions: string[] = []
    permissions.forEach((permission) => {
      if (permission['@libre.graph.permissions.actions']) {
        allPermissions.push(...permission['@libre.graph.permissions.actions'])
        return
      }
      const role = sharesStore.graphRoles[permission.roles[0]]
      if (!role) {
        return
      }
      const permissions = role.rolePermissions.flatMap((p) => p.allowedResourceActions)
      allPermissions.push(...permissions)
    })

    const uniquePermissions = [...new Set(allPermissions)]
    const spaceMember: SpaceMember = {
      grantedTo: { user: { id: userStore.user.id, displayName: userStore.user.displayName } },
      permissions: uniquePermissions,
      roleId: ''
    }
    spacesStore.updateSpaceField({
      id: space.id,
      field: 'members',
      value: { [userStore.user.id]: spaceMember }
    })
  }

  private syncReceivedOcmWebAppMemoUser(userId: string | undefined) {
    if (this.receivedOcmWebAppMemoUserId === userId) {
      return
    }
    this.receivedOcmWebAppMemo.clear()
    this.receivedOcmWebAppMemoUserId = userId
  }

  private readReceivedOcmWebAppMemo(
    userId: string | undefined,
    spaceId: string
  ): ReceivedOcmWebAppLookupResult | undefined {
    if (!userId || this.receivedOcmWebAppMemoUserId !== userId) {
      return undefined
    }
    const entry = this.receivedOcmWebAppMemo.get(spaceId)
    if (!entry) {
      return undefined
    }
    const ageMs = receivedOcmWebAppMemoNow() - entry.storedAt
    // Exactly 60s is expired, and a backward clock step must not revive the entry.
    if (ageMs < 0 || ageMs >= receivedOcmWebAppMemoTtlMs) {
      this.receivedOcmWebAppMemo.delete(spaceId)
      return undefined
    }
    return { kind: 'resolved', ocmWebApp: copyOcmWebApp(entry.ocmWebApp) }
  }

  private rememberReceivedOcmWebApp(
    userId: string | undefined,
    spaceId: string,
    ocmWebApp: Resource['ocmWebApp']
  ) {
    if (!userId || this.receivedOcmWebAppMemoUserId !== userId) {
      return
    }
    this.receivedOcmWebAppMemo.set(spaceId, {
      ocmWebApp: copyOcmWebApp(ocmWebApp),
      storedAt: receivedOcmWebAppMemoNow()
    })
  }
}

function clearSpaceOcmWebApp(space: SpaceResource, spacesStore: SpacesStore) {
  space.ocmWebApp = undefined
  spacesStore.updateSpaceField({
    id: space.id,
    field: 'ocmWebApp',
    value: undefined
  })
}

function clearInheritedOcmWebApp(currentFolder: Resource, resources: Resource[]) {
  currentFolder.ocmWebApp = undefined
  resources.forEach((resource) => {
    resource.ocmWebApp = undefined
  })
}

type ReceivedOcmWebAppLookupResult =
  | { kind: 'resolved'; ocmWebApp: Resource['ocmWebApp'] }
  | { kind: 'transient_failure' }

async function loadReceivedOcmWebApp({
  graphClient,
  graphRoles,
  serverUrl,
  spaceId,
  signal
}: {
  graphClient: Graph
  graphRoles: Parameters<typeof buildIncomingShareResource>[0]['graphRoles']
  serverUrl: string
  spaceId: string
  signal?: AbortSignal
}): Promise<ReceivedOcmWebAppLookupResult> {
  let driveItems: Awaited<ReturnType<Graph['driveItems']['listSharedWithMe']>>
  try {
    driveItems = await graphClient.driveItems.listSharedWithMe({ signal })
  } catch (error) {
    if (signal?.aborted || isCancelledLoad(error) || isAuthError(error)) {
      throw error
    }
    console.error('Failed to load received OCM web app metadata')
    return { kind: 'transient_failure' }
  }

  if (!Array.isArray(driveItems)) {
    console.error('Failed to load received OCM web app metadata')
    return { kind: 'transient_failure' }
  }

  if (driveItems.some((driveItem) => !isDriveItemElement(driveItem))) {
    console.error('Failed to load received OCM web app metadata')
    return { kind: 'transient_failure' }
  }

  const matches = driveItems.filter((driveItem) => driveItem.remoteItem?.id === spaceId)
  const match = matches[0]
  if (matches.length !== 1 || !match) {
    return { kind: 'resolved', ocmWebApp: undefined }
  }

  try {
    return {
      kind: 'resolved',
      ocmWebApp: buildIncomingShareResource({
        driveItem: match,
        graphRoles,
        serverUrl
      }).ocmWebApp
    }
  } catch {
    console.error('Failed to map received OCM web app metadata')
    return { kind: 'resolved', ocmWebApp: undefined }
  }
}

function receivedOcmWebAppUserId(userStore: UserStore): string | undefined {
  // A missing or blank id means signed out. Do not require a plain object; only the id string matters.
  const id = userStore.user?.id
  if (typeof id !== 'string' || id.length === 0) {
    return undefined
  }
  return id
}

function copyOcmWebApp(ocmWebApp: Resource['ocmWebApp']): Resource['ocmWebApp'] {
  if (!ocmWebApp) {
    return undefined
  }
  return { appName: ocmWebApp.appName }
}

function isAbortedSignal(signal: unknown): boolean {
  return isRecord(signal) && signal.aborted === true
}

function isAuthError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false
  }
  if (error.statusCode === 401) {
    return true
  }
  const response = error.response
  return isRecord(response) && response.status === 401
}

function isCancelledLoad(error: unknown): boolean {
  if (error === 'cancel') {
    return true
  }
  if (!isRecord(error)) {
    return false
  }
  return (
    error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED'
  )
}

function isDriveItemElement(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
