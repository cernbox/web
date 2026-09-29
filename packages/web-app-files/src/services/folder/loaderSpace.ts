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

export class FolderLoaderSpace implements FolderLoader {
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

    return useTask(function* (
      signal1,
      signal2,
      space: SpaceResource,
      path: string = null,
      fileId: string = null,
      options: FolderLoaderOptions = {}
    ) {
      try {
        resourcesStore.clearResourceList()
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
          // One shared-with-me lookup is authoritative for received webapp metadata.
          const ocmWebApp = yield* call(
            loadReceivedOcmWebApp({
              graphClient,
              graphRoles: sharesStore.graphRoles,
              serverUrl: configStore.serverUrl,
              spaceId: space.id,
              signal: signal1
            })
          )

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
        } else {
          clearInheritedOcmWebApp(currentFolder, resources)
        }

        resourcesStore.initResourceList({ currentFolder, resources })
      } catch (error) {
        resourcesStore.setCurrentFolder(null)
        console.error(error)

        if (error.statusCode === 401) {
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
}): Promise<Resource['ocmWebApp']> {
  try {
    const driveItems = await graphClient.driveItems.listSharedWithMe({ signal })
    const matches = driveItems.filter((driveItem) => driveItem.remoteItem?.id === spaceId)
    const match = matches[0]
    if (matches.length !== 1 || !match) {
      return undefined
    }

    return buildIncomingShareResource({
      driveItem: match,
      graphRoles,
      serverUrl
    }).ocmWebApp
  } catch (error) {
    if (signal?.aborted || isCancelledLoad(error) || isAuthError(error)) {
      throw error
    }
    console.error(error)
    return undefined
  }
}

function isAuthError(error: unknown): boolean {
  return isRecord(error) && error.statusCode === 401
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
