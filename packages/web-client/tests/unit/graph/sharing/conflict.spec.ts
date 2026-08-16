import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import {
  SHARE_HIERARCHY_FORCE_HEADER,
  SharingHierarchyConflictBlockedError,
  SharingHierarchyConflictCancelledError,
  SharingHierarchyConflictPendingError,
  SharingHierarchyConflictRemoveShareError,
  isSharingHierarchyConflictBlockedError,
  isSharingHierarchyConflictCancelledError,
  isSharingHierarchyConflictPendingError,
  isSharingHierarchyConflictRemoveShareError,
  isSharingHierarchyConflictUserAbortError,
  parseSharingHierarchyConflict,
  parseSharingHierarchyConflictPayload,
  shareHierarchyForceRequestOptions
} from '../../../../src/graph/sharing/conflict'

function axios409(data: unknown): AxiosError {
  return new AxiosError(
    'Conflict',
    'ERR_BAD_REQUEST',
    undefined,
    {},
    {
      status: 409,
      statusText: 'Conflict',
      data,
      headers: {},
      config: {} as any
    }
  )
}

describe('shareHierarchyForceRequestOptions', () => {
  it('uses the Reva Force header from feat/share-consistency', () => {
    expect(shareHierarchyForceRequestOptions()).toEqual({
      headers: { [SHARE_HIERARCHY_FORCE_HEADER]: 'true' }
    })
    expect(SHARE_HIERARCHY_FORCE_HEADER).toBe('Force')
  })
})

describe('parseSharingHierarchyConflictPayload', () => {
  it.each([
    {
      name: 'child conflict with conflicting shares',
      data: {
        error_type: 'child_conflict',
        message: 'Child shares will be removed',
        can_force: true,
        conflicting_shares: [
          {
            id: 'share-1',
            resource_id: 'storage!item',
            path: '/project/sub',
            permission_type: 'read'
          }
        ]
      },
      expected: {
        kind: 'hierarchy_conflict',
        errorType: 'child_conflict',
        message: 'Child shares will be removed',
        canForce: true,
        conflictingShares: [
          {
            id: 'share-1',
            resourceId: 'storage!item',
            path: '/project/sub',
            permissionType: 'read'
          }
        ]
      }
    },
    {
      name: 'parent conflict',
      data: {
        error_type: 'parent_conflict',
        message: 'Already shared through parent',
        can_force: false
      },
      expected: {
        kind: 'hierarchy_conflict',
        errorType: 'parent_conflict',
        message: 'Already shared through parent',
        canForce: false,
        conflictingShares: undefined
      }
    },
    {
      name: 'omitted can_force',
      data: {
        error_type: 'parent_conflict',
        message: 'Blocked'
      },
      expected: {
        kind: 'hierarchy_conflict',
        errorType: 'parent_conflict',
        message: 'Blocked',
        canForce: false,
        conflictingShares: undefined
      }
    }
  ])('parses $name', ({ data, expected }) => {
    const r = parseSharingHierarchyConflictPayload(409, data)
    expect(r).toMatchObject(expected)
    expect(r?.raw).toBeDefined()
  })

  it('returns null for non-409', () => {
    expect(
      parseSharingHierarchyConflictPayload(400, {
        error_type: 'parent_conflict',
        message: 'y'
      })
    ).toBeNull()
  })

  it('returns null for legacy Gerard payload shape', () => {
    expect(
      parseSharingHierarchyConflictPayload(409, {
        code: 'SHARING_HIERARCHY_CONFLICT',
        message: 'legacy',
        can_force: true
      })
    ).toBeNull()
  })

  it('parses string JSON body', () => {
    const raw =
      '{"error_type":"child_conflict","message":"M","can_force":true,"conflicting_shares":[{"id":"1","path":"/a"}]}'
    const r = parseSharingHierarchyConflictPayload(409, raw)
    expect(r?.errorType).toBe('child_conflict')
    expect(r?.canForce).toBe(true)
    expect(r?.conflictingShares).toEqual([{ id: '1', path: '/a' }])
  })

  it('parses conflicting share fields from Reva', () => {
    const r = parseSharingHierarchyConflictPayload(409, {
      error_type: 'parent_conflict',
      message: 'Already shared',
      can_force: false,
      conflicting_shares: [
        {
          id: 'share-1',
          resource_id: 'storage!item',
          path: '/folder/doc.txt',
          permission_type: 'ReadWrite',
          sharee: 'tstcbsa2'
        }
      ]
    })

    expect(r?.conflictingShares).toEqual([
      {
        id: 'share-1',
        resourceId: 'storage!item',
        path: '/folder/doc.txt',
        permissionType: 'ReadWrite',
        sharee: 'tstcbsa2'
      }
    ])
  })
})

describe('parseSharingHierarchyConflict', () => {
  it('returns null for non-axios errors', () => {
    expect(parseSharingHierarchyConflict(new Error('x'))).toBeNull()
  })

  it('extracts conflict from axios 409', () => {
    const err = axios409({
      error_type: 'child_conflict',
      message: 'M',
      can_force: true
    })
    expect(parseSharingHierarchyConflict(err)?.message).toBe('M')
    expect(parseSharingHierarchyConflict(err)?.errorType).toBe('child_conflict')
  })
})

describe('SharingHierarchyConflictPendingError', () => {
  it('is detected by type guard', () => {
    const conflict = {
      kind: 'hierarchy_conflict' as const,
      errorType: 'child_conflict',
      message: 'warn',
      canForce: true,
      raw: {}
    }
    const err = new SharingHierarchyConflictPendingError(conflict)
    expect(isSharingHierarchyConflictPendingError(err)).toBe(true)
    expect(isSharingHierarchyConflictPendingError(new Error('x'))).toBe(false)
    expect(err.conflict).toBe(conflict)
  })
})

describe('SharingHierarchyConflict user abort errors', () => {
  it('detects blocked and cancelled errors', () => {
    expect(isSharingHierarchyConflictBlockedError(new SharingHierarchyConflictBlockedError())).toBe(
      true
    )
    expect(
      isSharingHierarchyConflictCancelledError(new SharingHierarchyConflictCancelledError())
    ).toBe(true)
    expect(
      isSharingHierarchyConflictUserAbortError(new SharingHierarchyConflictBlockedError())
    ).toBe(true)
    expect(
      isSharingHierarchyConflictUserAbortError(new SharingHierarchyConflictCancelledError())
    ).toBe(true)
    expect(isSharingHierarchyConflictUserAbortError(new Error('x'))).toBe(false)
  })

  it('detects remove share errors separately from user abort', () => {
    expect(
      isSharingHierarchyConflictRemoveShareError(new SharingHierarchyConflictRemoveShareError())
    ).toBe(true)
    expect(
      isSharingHierarchyConflictUserAbortError(new SharingHierarchyConflictRemoveShareError())
    ).toBe(false)
  })
})
