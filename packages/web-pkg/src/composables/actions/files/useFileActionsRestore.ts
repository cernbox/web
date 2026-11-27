import { basename, dirname } from 'path'
import { isLocationTrashActive } from '../../../router'

import {
  Resource,
  isProjectSpaceResource,
  SpaceResource,
  isTrashResource
} from '@ownclouders/web-client'
import type { RestoreCollision } from '@ownclouders/web-client/webdav'
import { ResolveStrategy, ResolveConflict, ConflictDialog } from '../../../helpers/resource'
import { urlJoin } from '@ownclouders/web-client'
import { useClientService } from '../../clientService'
import { useRouter } from '../../router'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { FileAction, FileActionOptions } from '../types'
import {
  useMessages,
  useSpacesStore,
  useUserStore,
  useResourcesStore,
  useSharesStore
} from '../../piniaStores'
import { useRestoreWorker } from '../../webWorkers/restoreWorker'
import { eventBus } from '../../../services'

export const useFileActionsRestore = () => {
  const { showMessage, showErrorMessage } = useMessages()
  const userStore = useUserStore()
  const router = useRouter()
  const { $gettext, $ngettext } = useGettext()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const sharesStore = useSharesStore()
  const resourcesStore = useResourcesStore()
  const { startWorker } = useRestoreWorker()

  // FIXME: use ConflictDialog class for this
  const collectConflicts = async (space: SpaceResource, sortedResources: Resource[]) => {
    const existingResourcesCache: Record<string, Resource[]> = {}
    const conflicts: Resource[] = []
    const resolvedResources: Resource[] = []
    const missingFolderPaths: string[] = []
    for (const resource of sortedResources) {
      const parentPath = dirname(resource.path)

      let existingResources: Resource[] = []
      if (parentPath in existingResourcesCache) {
        existingResources = existingResourcesCache[parentPath]
      } else {
        try {
          existingResources = (
            await clientService.webdav.listFiles(space, {
              path: parentPath
            })
          ).children
        } catch {
          missingFolderPaths.push(parentPath)
        }
        existingResourcesCache[parentPath] = existingResources
      }
      // Check for naming conflict in parent folder and between resources batch
      const hasConflict =
        existingResources.some((r) => r.name === resource.name) ||
        resolvedResources.filter((r) => r.id !== resource.id).some((r) => r.path === resource.path)
      if (hasConflict) {
        conflicts.push(resource)
      } else {
        resolvedResources.push(resource)
      }
    }
    return {
      existingResourcesByPath: existingResourcesCache,
      conflicts,
      resolvedResources,
      missingFolderPaths: missingFolderPaths.filter((path) => !existingResourcesCache[path]?.length)
    }
  }

  // FIXME: use ConflictDialog class for this
  const collectResolveStrategies = async (conflicts: Resource[]) => {
    let count = 0
    const resolvedConflicts = []
    const allConflictsCount = conflicts.length
    let doForAllConflicts = false
    let allConflictsStrategy: ResolveStrategy
    for (const conflict of conflicts) {
      const isFolder = conflict.type === 'folder'
      if (doForAllConflicts) {
        resolvedConflicts.push({
          resource: conflict,
          strategy: allConflictsStrategy
        })
        continue
      }
      const remainingConflictCount = allConflictsCount - count
      const conflictDialog = new ConflictDialog($gettext, $ngettext)
      const resolvedConflict: ResolveConflict = await conflictDialog.resolveFileExists(
        { name: conflict.name, isFolder } as Resource,
        remainingConflictCount,
        false,
        false,
        false
      )
      count++
      if (resolvedConflict.doForAllConflicts) {
        doForAllConflicts = true
        allConflictsStrategy = resolvedConflict.strategy
      }
      resolvedConflicts.push({
        resource: conflict,
        strategy: resolvedConflict.strategy
      })
    }
    return resolvedConflicts
  }

  // The user decides for each collision to skip it, or to restore it with overwrite, which keeps both.
  const restoreCollisions = async (
    space: SpaceResource,
    collided: { resource: Resource; collisions?: RestoreCollision[] }[]
  ) => {
    // Without a list from the server, the collision is the resource of the request.
    const conflicts = collided.flatMap(({ resource, collisions }) =>
      collisions?.length
        ? collisions.map(
            ({ key, path }) =>
              ({
                id: key,
                path: urlJoin(path, { leadingSlash: true }),
                name: basename(path),
                type: 'file'
              }) as Resource
          )
        : [resource]
    )
    const keepBoth = (await collectResolveStrategies(conflicts))
      .filter(({ strategy }) => strategy === ResolveStrategy.KEEP_BOTH)
      .map(({ resource }) => resource)
    if (keepBoth.length) {
      return restoreResources(space, keepBoth, [], true)
    }
    // The restore can have put back the part of a folder that did not collide.
    eventBus.publish('app.files.list.load')
  }

  const restoreResources = (
    space: SpaceResource,
    resources: Resource[],
    missingFolderPaths: string[],
    overwrite = false,
    collidedResources: Resource[] = []
  ) => {
    const originalRoute = unref(router.currentRoute)

    startWorker(
      { space, resources, missingFolderPaths, overwrite },
      async ({ successful, failed }) => {
        const collided = [
          ...failed.filter(({ error }) => !overwrite && error.statusCode === 412),
          ...collidedResources.map((resource) => ({ resource }))
        ]
        const otherFailures = failed.filter(({ error }) => overwrite || error.statusCode !== 412)

        if (successful.length) {
          let title: string
          if (successful.length === 1) {
            title = $gettext('%{resource} was restored successfully', {
              resource: successful[0].name
            })
          } else {
            title = $gettext('%{resourceCount} files restored successfully', {
              resourceCount: successful.length.toString()
            })
          }
          showMessage({ title })
          eventBus.publish('app.files.trash.restored', { count: successful.length })

          // user hasn't navigated to another location meanwhile
          if (
            originalRoute.name === unref(router.currentRoute).name &&
            originalRoute.query?.fileId === unref(router.currentRoute).query?.fileId
          ) {
            resourcesStore.removeResources(successful)
            resourcesStore.resetSelection()
          }

          // Reload quota
          const graphClient = clientService.graphAuthenticated
          const updatedSpace = await graphClient.drives.getDrive(space.id, sharesStore.graphRoles)
          spacesStore.updateSpaceField({
            id: updatedSpace.id,
            field: 'spaceQuota',
            value: updatedSpace.spaceQuota
          })
        }

        if (otherFailures.length) {
          let translated: string
          const translateParams: Record<string, string> = {}
          if (otherFailures.length === 1) {
            translateParams.resource = otherFailures[0].resource.name
            translated = $gettext('Failed to restore "%{resource}"', translateParams, true)
          } else {
            translateParams.resourceCount = otherFailures.length.toString()
            translated = $gettext('Failed to restore %{resourceCount} files', translateParams, true)
          }
          showErrorMessage({ title: translated, errors: otherFailures.map(({ error }) => error) })
        }

        if (collided.length) {
          await restoreCollisions(space, collided)
        } else if (overwrite) {
          // A forced restore of an item in a folder changes that folder in the trash bin.
          eventBus.publish('app.files.list.load')
        }
      }
    )
  }

  const handler = async ({ space, resources }: FileActionOptions) => {
    // resources need to be sorted by path ASC to recover the parents first in case of deep nested folder structure
    const sortedResources = resources.sort((a, b) => a.path.length - b.path.length)

    // The server reports the collisions, but the parent folder of each resource must exist.
    const { missingFolderPaths } = await collectConflicts(space, sortedResources)

    // Copies of one path go back one at a time, so the copies after the first collide with it.
    const paths = new Set<string>()
    const first: Resource[] = []
    const again: Resource[] = []
    for (const resource of sortedResources) {
      if (paths.has(resource.path)) {
        again.push(resource)
      } else {
        first.push(resource)
        paths.add(resource.path)
      }
    }

    return restoreResources(space, first, missingFolderPaths, false, again)
  }

  const actions = computed((): FileAction[] => [
    {
      name: 'restore',
      icon: 'arrow-go-back',
      label: () => $gettext('Restore'),
      handler,
      isVisible: ({ space, resources }) => {
        if (!isLocationTrashActive(router, 'files-trash-generic')) {
          return false
        }
        if (!resources.every((r) => isTrashResource(r) && r.canBeRestored())) {
          return false
        }

        if (
          isProjectSpaceResource(space) &&
          !space.canRestoreFromTrashbin({ user: userStore.user })
        ) {
          return false
        }

        return resources.length > 0
      },
      class: 'oc-files-actions-restore-trigger'
    }
  ])

  return {
    actions,
    // HACK: exported for unit tests:
    restoreResources,
    collectConflicts
  }
}
