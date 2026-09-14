import { describe, expect, it } from 'vitest'
import type { ShareRole } from '@ownclouders/web-client'
import {
  collectConflictingShares,
  formatRelativeSharePath,
  getSharingHierarchyConflictIntro,
  groupConflictingSharesBySharee,
  resolveConflictPermissionLabel
} from '../../../../src/composables/shares/sharingHierarchyConflictDisplay'

const $gettext = (msg: string) => msg

const graphRoles: Record<string, ShareRole> = {
  viewer: { id: 'viewer', displayName: 'Can view', description: '' },
  editor: { id: 'editor', displayName: 'Can edit', description: '' },
  denied: { id: 'denied', displayName: 'Cannot access', description: '' }
}

describe('sharingHierarchyConflictDisplay', () => {
  describe('getSharingHierarchyConflictIntro', () => {
    it('uses child conflict copy when only child conflicts exist', () => {
      const intro = getSharingHierarchyConflictIntro(
        [
          {
            kind: 'hierarchy_conflict',
            errorType: 'child_conflict',
            message: '',
            canForce: true,
            raw: {}
          }
        ],
        $gettext
      )

      expect(intro).toContain('replace any existing shares')
    })

  it('uses parent conflict copy when only parent conflicts exist', () => {
    const intro = getSharingHierarchyConflictIntro(
      [
        {
          kind: 'hierarchy_conflict',
          errorType: 'parent_conflict',
          message: '',
          canForce: false,
          raw: {}
        }
      ],
      $gettext
    )

    expect(intro).toContain('cannot be created')
  })

  it('uses redundant direct share copy for role update conflicts', () => {
    const intro = getSharingHierarchyConflictIntro(
      [
        {
          kind: 'hierarchy_conflict',
          errorType: 'parent_conflict',
          message: '',
          canForce: false,
          raw: {}
        }
      ],
      $gettext,
      'redundant-direct-share'
    )

    expect(intro).toContain('Remove this direct share')
  })

  it('uses "Updating" copy for a forcible child conflict with the update-share variant', () => {
    const intro = getSharingHierarchyConflictIntro(
      [
        {
          kind: 'hierarchy_conflict',
          errorType: 'child_conflict',
          message: '',
          canForce: true,
          raw: {}
        }
      ],
      $gettext,
      'update-share'
    )

    expect(intro).toContain('Updating this share will replace any existing shares')
  })
  })

  describe('formatRelativeSharePath', () => {
    it('strips resource path prefix from absolute path', () => {
      expect(
        formatRelativeSharePath(
          { path: '/spaces/project/myfolder' },
          '/spaces/project'
        )
      ).toBe('myfolder')
    })

    it('does not append a trailing slash for a file share', () => {
      expect(
        formatRelativeSharePath(
          { path: '/spaces/project/myfile.txt' },
          '/spaces/project'
        )
      ).toBe('myfile.txt')
    })
  })

  describe('resolveConflictPermissionLabel', () => {
    it('matches the configured role by id (permission_type is a graphRoles key)', () => {
      expect(
        resolveConflictPermissionLabel({ permissionType: 'viewer' }, graphRoles, $gettext)
      ).toBe('Can view')
    })

    it('matches a different configured role by id', () => {
      expect(
        resolveConflictPermissionLabel({ permissionType: 'editor' }, graphRoles, $gettext)
      ).toBe('Can edit')
    })

    it('matches the denied role by id', () => {
      expect(
        resolveConflictPermissionLabel({ permissionType: 'denied' }, graphRoles, $gettext)
      ).toBe('Cannot access')
    })

    it('falls back to the raw permission_type when no configured role matches', () => {
      expect(
        resolveConflictPermissionLabel({ permissionType: 'unknown-role-id' }, graphRoles, $gettext)
      ).toBe('unknown-role-id')
    })

    it('returns "Unknown permission" when no permission_type is given', () => {
      expect(resolveConflictPermissionLabel({}, graphRoles, $gettext)).toBe('Unknown permission')
    })
  })

  describe('groupConflictingSharesBySharee', () => {
    it('groups entries under sharee labels', () => {
      const groups = groupConflictingSharesBySharee(
        [
          {
            sharee: 'userA',
            path: '/spaces/project/myfolder',
            permissionType: 'viewer'
          },
          {
            sharee: 'userA',
            path: '/spaces/project/other',
            permissionType: 'editor'
          },
          {
            sharee: 'userB',
            path: '/spaces/project/docs',
            permissionType: 'viewer'
          }
        ],
        '/spaces/project',
        graphRoles,
        $gettext
      )

      expect(groups).toHaveLength(2)
      expect(groups[0].shareeLabel).toBe('userA')
      expect(groups[0].entries).toHaveLength(2)
      expect(groups[1].shareeLabel).toBe('userB')
      expect(groups[1].entries[0].permissionLabel).toBe('Can view')
    })
  })

  describe('collectConflictingShares', () => {
    it('deduplicates shares across conflicts', () => {
      const share = { id: '1', path: '/a', sharee: 'user' }
      const collected = collectConflictingShares([
        {
          kind: 'hierarchy_conflict',
          errorType: 'child_conflict',
          message: '',
          canForce: true,
          conflictingShares: [share],
          raw: {}
        },
        {
          kind: 'hierarchy_conflict',
          errorType: 'child_conflict',
          message: '',
          canForce: true,
          conflictingShares: [share],
          raw: {}
        }
      ])

      expect(collected).toHaveLength(1)
    })
  })
})
