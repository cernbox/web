import axios from 'axios'

/** HTTP header Reva ocgraph reads on invite/update (see `Force` in feat/share-consistency). */
export const SHARE_HIERARCHY_FORCE_HEADER = 'Force'

export const shareHierarchyForceRequestOptions = (): { headers: Record<string, string> } => ({
  headers: { [SHARE_HIERARCHY_FORCE_HEADER]: 'true' }
})

export type SharingHierarchyConflictingShare = {
  id?: string
  resourceId?: string
  path?: string
  permissionType?: string
  sharee?: string
}

export type SharingHierarchyConflict = {
  kind: 'hierarchy_conflict'
  errorType: string
  message: string
  canForce: boolean
  conflictingShares?: SharingHierarchyConflictingShare[]
  raw: unknown
}

export type ConfirmSharingHierarchyConflict = (
  conflict: SharingHierarchyConflict
) => Promise<boolean>

export type InformSharingHierarchyConflict = (conflict: SharingHierarchyConflict) => Promise<void>

export class SharingHierarchyConflictCancelledError extends Error {
  readonly name = 'SharingHierarchyConflictCancelledError'

  constructor() {
    super('Sharing hierarchy change cancelled')
  }
}

export function isSharingHierarchyConflictCancelledError(e: unknown): boolean {
  return e instanceof SharingHierarchyConflictCancelledError
}

/** Thrown after the user acknowledges a non-forcible hierarchy conflict (`can_force: false`). */
export class SharingHierarchyConflictBlockedError extends Error {
  readonly name = 'SharingHierarchyConflictBlockedError'

  constructor() {
    super('Sharing hierarchy change blocked')
  }
}

export function isSharingHierarchyConflictBlockedError(e: unknown): boolean {
  return e instanceof SharingHierarchyConflictBlockedError
}

/** Thrown when the user chooses to remove a redundant direct share from an inform dialog. */
export class SharingHierarchyConflictRemoveShareError extends Error {
  readonly name = 'SharingHierarchyConflictRemoveShareError'

  constructor() {
    super('Sharing hierarchy change requests share removal')
  }
}

export function isSharingHierarchyConflictRemoveShareError(e: unknown): boolean {
  return e instanceof SharingHierarchyConflictRemoveShareError
}

/** User dismissed or was blocked; do not show a mutation failure toast. */
export function isSharingHierarchyConflictUserAbortError(e: unknown): boolean {
  return isSharingHierarchyConflictCancelledError(e) || isSharingHierarchyConflictBlockedError(e)
}

/** Thrown when `deferSharingHierarchyConflictConfirm` is set and the caller should batch confirmations. */
export class SharingHierarchyConflictPendingError extends Error {
  readonly name = 'SharingHierarchyConflictPendingError'

  constructor(readonly conflict: SharingHierarchyConflict) {
    super(conflict.message || conflict.errorType || 'Sharing hierarchy conflict')
  }
}

export function isSharingHierarchyConflictPendingError(
  e: unknown
): e is SharingHierarchyConflictPendingError {
  return e instanceof SharingHierarchyConflictPendingError
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return null
  }
  return v as Record<string, unknown>
}

function pickPayload(data: unknown): Record<string, unknown> | null {
  const root = asRecord(data)
  if (!root) {
    return null
  }
  if ('error' in root) {
    return asRecord(root.error)
  }
  return root
}

function parseConflictingShare(value: unknown): SharingHierarchyConflictingShare | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  const share: SharingHierarchyConflictingShare = {}
  if (typeof record.id === 'string') {
    share.id = record.id
  }
  if (typeof record.resource_id === 'string') {
    share.resourceId = record.resource_id
  }
  if (typeof record.path === 'string') {
    share.path = record.path
  }
  if (typeof record.permission_type === 'string') {
    share.permissionType = record.permission_type
  }
  if (typeof record.sharee === 'string') {
    share.sharee = record.sharee
  }

  return Object.keys(share).length > 0 ? share : null
}

export function parseSharingHierarchyConflictPayload(
  status: number | undefined,
  data: unknown
): SharingHierarchyConflict | null {
  if (status !== 409) {
    return null
  }

  let parsed: unknown = data
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data)
    } catch {
      return null
    }
  }

  const payload = pickPayload(parsed)
  if (!payload) {
    return null
  }

  const errorType = typeof payload.error_type === 'string' ? payload.error_type : ''
  const message = typeof payload.message === 'string' ? payload.message : ''
  if (!errorType) {
    return null
  }

  const canForce = payload.can_force === true
  let conflictingShares: SharingHierarchyConflictingShare[] | undefined
  if (Array.isArray(payload.conflicting_shares)) {
    conflictingShares = payload.conflicting_shares
      .map(parseConflictingShare)
      .filter((share): share is SharingHierarchyConflictingShare => share !== null)
    if (conflictingShares.length === 0) {
      conflictingShares = undefined
    }
  }

  return {
    kind: 'hierarchy_conflict',
    errorType,
    message,
    canForce,
    conflictingShares,
    raw: parsed
  }
}

/**
 * Parses a Graph/Axios error response for ADR-0005 hierarchy conflicts (HTTP 409 + JSON body).
 * Matches Reva `pkg/sharehierarchy.HierarchyConflictError` on feat/share-consistency.
 */
export function parseSharingHierarchyConflict(error: unknown): SharingHierarchyConflict | null {
  if (!axios.isAxiosError(error)) {
    return null
  }
  return parseSharingHierarchyConflictPayload(error.response?.status, error.response?.data)
}
