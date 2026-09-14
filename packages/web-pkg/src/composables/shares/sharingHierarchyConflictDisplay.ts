import type {
  ShareRole,
  SharingHierarchyConflict,
  SharingHierarchyConflictingShare
} from '@ownclouders/web-client'

export type ShareeConflictGroup = {
  shareeKey: string
  shareeLabel: string
  entries: {
    key: string
    permissionLabel: string
    relativePath: string
  }[]
}

type GettextFn = (msg: string, ctx?: Record<string, unknown>) => string

export function collectConflictingShares(
  conflicts: SharingHierarchyConflict[]
): SharingHierarchyConflictingShare[] {
  const seen = new Set<string>()
  const shares: SharingHierarchyConflictingShare[] = []

  for (const conflict of conflicts) {
    for (const share of conflict.conflictingShares ?? []) {
      const key = [share.id, share.path, share.sharee].filter(Boolean).join('|')
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      shares.push(share)
    }
  }

  return shares
}

export type SharingHierarchyConflictIntroVariant =
  | 'default'
  | 'redundant-direct-share'
  | 'update-share'

export function getSharingHierarchyConflictIntro(
  conflicts: SharingHierarchyConflict[],
  $gettext: GettextFn,
  variant: SharingHierarchyConflictIntroVariant = 'default'
): string {
  const hasChildConflict = conflicts.some(
    (c) => c.errorType === 'child_conflict' || (c.canForce && c.errorType !== 'parent_conflict')
  )
  const hasParentConflict = conflicts.some((c) => c.errorType === 'parent_conflict')

  if (variant === 'redundant-direct-share' && hasParentConflict) {
    return $gettext(
      'This permission change conflicts with access through a parent folder. Remove this direct share if it is no longer needed.'
    )
  }

  if (hasChildConflict && !hasParentConflict) {
    return variant === 'update-share'
      ? $gettext(
          'Updating this share will replace any existing shares on contained subfolders and files. Please confirm to continue.'
        )
      : $gettext(
          'Creating this share will replace any existing shares on contained subfolders and files. Please confirm to continue.'
        )
  }

  if (hasParentConflict && !hasChildConflict) {
    return $gettext(
      'This share cannot be created because access already exists through a parent folder.'
    )
  }

  return $gettext('The following sharing changes conflict with existing shares.')
}

export function formatRelativeSharePath(
  share: SharingHierarchyConflictingShare,
  resourcePath?: string
): string {
  const sharePath = share.path?.replace(/\/+$/, '')
  if (!sharePath) {
    return share.resourceId ?? share.id ?? ''
  }

  const basePath = resourcePath?.replace(/\/+$/, '')
  if (basePath) {
    if (sharePath === basePath) {
      return './'
    }
    if (sharePath.startsWith(`${basePath}/`)) {
      return sharePath.slice(basePath.length + 1)
    }
  }

  const segments = share.path?.split('/').filter(Boolean) ?? []
  const leaf = segments[segments.length - 1]
  return leaf ?? sharePath
}

export function resolveConflictPermissionLabel(
  share: SharingHierarchyConflictingShare,
  graphRoles: Record<string, ShareRole>,
  $gettext: GettextFn
): string {
  const perm = share.permissionType
  if (!perm) {
    return $gettext('Unknown permission')
  }

  const matchedRole = graphRoles[perm]

  return matchedRole?.displayName ? $gettext(matchedRole.displayName) : perm
}

export function groupConflictingSharesBySharee(
  shares: SharingHierarchyConflictingShare[],
  resourcePath: string | undefined,
  graphRoles: Record<string, ShareRole>,
  $gettext: GettextFn
): ShareeConflictGroup[] {
  const groups = new Map<string, ShareeConflictGroup>()

  shares.forEach((share, index) => {
    const shareeKey = share.sharee || `unknown-${index}`
    const shareeLabel = share.sharee || $gettext('Unknown user')

    if (!groups.has(shareeKey)) {
      groups.set(shareeKey, { shareeKey, shareeLabel, entries: [] })
    }

    const group = groups.get(shareeKey)!
    group.entries.push({
      key: `${shareeKey}-${share.id ?? share.path ?? index}`,
      permissionLabel: resolveConflictPermissionLabel(share, graphRoles, $gettext),
      relativePath: formatRelativeSharePath(share, resourcePath)
    })
  })

  return Array.from(groups.values())
}
