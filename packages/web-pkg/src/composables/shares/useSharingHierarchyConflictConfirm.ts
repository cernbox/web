import type { ShareRole, SharingHierarchyConflict } from '@ownclouders/web-client'
import { SharingHierarchyConflictRemoveShareError } from '@ownclouders/web-client'
import { storeToRefs } from 'pinia'
import { inject, unref, type Ref } from 'vue'
import { Resource } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'
import SharingHierarchyConflictModal, {
  type SharingHierarchyConflictModalResult
} from '../../components/Modals/SharingHierarchyConflictModal.vue'
import { useModals } from '../piniaStores/modals'
import type { SharingHierarchyConflictIntroVariant } from './sharingHierarchyConflictDisplay'

async function loadGraphRoles(): Promise<Record<string, ShareRole>> {
  const { useSharesStore } = await import('../piniaStores/shares/shares')
  const { graphRoles } = storeToRefs(useSharesStore())
  return unref(graphRoles)
}

function dispatchSharingHierarchyConflictModal(
  modalsStore: ReturnType<typeof useModals>,
  {
    title,
    variation,
    conflicts,
    mode,
    introVariant,
    resourcePath,
    graphRoles
  }: {
    title: string
    variation: string
    conflicts: SharingHierarchyConflict[]
    mode: 'confirm' | 'inform' | 'inform-remove'
    introVariant?: SharingHierarchyConflictIntroVariant
    resourcePath?: string
    graphRoles: Record<string, ShareRole>
  }
): Promise<SharingHierarchyConflictModalResult> {
  return new Promise<SharingHierarchyConflictModalResult>((resolve, reject) => {
    modalsStore.dispatchModal({
      variation,
      title,
      hideActions: true,
      customComponent: SharingHierarchyConflictModal,
      customComponentAttrs: () => ({
        conflicts,
        mode,
        introVariant: introVariant ?? 'default',
        resourcePath,
        graphRoles,
        callbackFn: (result: SharingHierarchyConflictModalResult) => {
          if (result === 'remove') {
            reject(new SharingHierarchyConflictRemoveShareError())
            return
          }

          resolve(mode === 'inform' || mode === 'inform-remove' ? false : result)
        }
      })
    })
  })
}

function resolveResourcePath(resource: Resource | Ref<Resource> | undefined): string | undefined {
  if (!resource) {
    return undefined
  }

  return unref(resource)?.path
}

function resolveInformMode(
  conflict: SharingHierarchyConflict,
  offerRemoveShare: boolean
): 'inform' | 'inform-remove' {
  if (offerRemoveShare && conflict.errorType === 'parent_conflict') {
    return 'inform-remove'
  }

  return 'inform'
}

export type SharingHierarchyConflictConfirmOptions = {
  /** Which copy to show for a forcible (child_conflict) confirmation. Defaults to 'default' (create wording). */
  introVariant?: SharingHierarchyConflictIntroVariant
}

/**
 * Shows a confirmation dialog when the server returns 409 with `can_force: true` for share mutations.
 */
export function useSharingHierarchyConflictConfirm(
  options: SharingHierarchyConflictConfirmOptions = {}
): (conflict: SharingHierarchyConflict) => Promise<boolean> {
  const { $gettext } = useGettext()
  const modalsStore = useModals()
  const resource = inject<Resource | Ref<Resource>>('resource')
  const { introVariant = 'default' } = options

  return async (conflict: SharingHierarchyConflict) =>
    dispatchSharingHierarchyConflictModal(modalsStore, {
      title: $gettext('Sharing conflicts'),
      variation: 'warning',
      conflicts: [conflict],
      mode: 'confirm',
      introVariant,
      resourcePath: resolveResourcePath(resource),
      graphRoles: await loadGraphRoles()
    }) as Promise<boolean>
}

/**
 * Shows one confirmation dialog for multiple deferred hierarchy conflicts (e.g. batch invite).
 */
export function useSharingHierarchyConflictsConfirm(): (
  conflicts: SharingHierarchyConflict[]
) => Promise<boolean> {
  const { $gettext } = useGettext()
  const modalsStore = useModals()
  const resource = inject<Resource | Ref<Resource>>('resource')
  const confirmOne = useSharingHierarchyConflictConfirm()

  return async (conflicts: SharingHierarchyConflict[]) => {
    if (conflicts.length === 0) {
      return true
    }

    if (conflicts.length === 1) {
      return confirmOne(conflicts[0])
    }

    return dispatchSharingHierarchyConflictModal(modalsStore, {
      title: $gettext('Sharing conflicts'),
      variation: 'warning',
      conflicts,
      mode: 'confirm',
      resourcePath: resolveResourcePath(resource),
      graphRoles: await loadGraphRoles()
    }) as Promise<boolean>
  }
}

export type SharingHierarchyConflictInformOptions = {
  /** Offer to remove a redundant direct share on `parent_conflict`. */
  offerRemoveShare?: boolean
}

/**
 * Shows an informational dialog when the server returns 409 with `can_force: false`.
 */
export function useSharingHierarchyConflictInform(
  options: SharingHierarchyConflictInformOptions = {}
): (conflict: SharingHierarchyConflict) => Promise<void> {
  const { $gettext } = useGettext()
  const modalsStore = useModals()
  const resource = inject<Resource | Ref<Resource>>('resource')
  const { offerRemoveShare = false } = options

  return async (conflict: SharingHierarchyConflict) => {
    const mode = resolveInformMode(conflict, offerRemoveShare)

    await dispatchSharingHierarchyConflictModal(modalsStore, {
      title: $gettext('Cannot share'),
      variation: 'passive',
      conflicts: [conflict],
      mode,
      introVariant: mode === 'inform-remove' ? 'redundant-direct-share' : 'default',
      resourcePath: resolveResourcePath(resource),
      graphRoles: await loadGraphRoles()
    })
  }
}
