import { mock, mockDeep } from 'vitest-mock-extended'
import {
  IncomingShareResource,
  OutgoingShareResource,
  Resource,
  ShareResource,
  ShareRole,
  ShareTypes
} from '../../../../src/helpers'
import {
  buildCollaboratorShare,
  buildIncomingShareResource,
  buildLinkShare,
  buildOutgoingShareResource,
  getShareResourcePermissions,
  getShareResourceRoles,
  isIncomingShareResource,
  isOutgoingShareResource,
  isShareResource
} from '../../../../src/helpers/share/functions'
import {
  DriveItem,
  Identity,
  Permission,
  UnifiedRoleDefinition,
  User
} from '../../../../src/graph/generated'
import { urlJoin } from '../../../../src'
import emptyNameSharedWithMe from './fixtures/received-webapp/empty-name.sharedWithMe.json'
import positiveSharedWithMe from './fixtures/received-webapp/positive.sharedWithMe.json'
import resourceExpectations from './fixtures/received-webapp/resource-expectations.json'
import webdavOnlySharedWithMe from './fixtures/received-webapp/webdav-only.sharedWithMe.json'

describe('share helper functions', () => {
  describe('isShareResource', () => {
    it('returns true for shares based on "sharedWith" property', () => {
      const resource = mock<ShareResource>({ sharedWith: mock<ShareResource['sharedWith']>() })
      expect(isShareResource(resource)).toBeTruthy()
    })
    it('returns false for regular resources based on "sharedWith" property', () => {
      const resource = mock<Resource>()
      expect(isShareResource(resource)).toBeFalsy()
    })
  })

  describe('isOutgoingShareResource', () => {
    it('returns true for outgoing shares', () => {
      const resource = mock<OutgoingShareResource>({
        outgoing: true,
        sharedWith: mock<ShareResource['sharedWith']>()
      })
      expect(isOutgoingShareResource(resource)).toBeTruthy()
    })
    it('returns false for incoming shares', () => {
      const resource = mock<IncomingShareResource>({
        outgoing: false,
        sharedWith: mock<ShareResource['sharedWith']>()
      })
      expect(isOutgoingShareResource(resource)).toBeFalsy()
    })
  })

  describe('isIncomingShareResource', () => {
    it('returns true for incoming shares', () => {
      const resource = mock<IncomingShareResource>({
        outgoing: false,
        sharedWith: mock<ShareResource['sharedWith']>()
      })
      expect(isIncomingShareResource(resource)).toBeTruthy()
    })
    it('returns false for outgoing shares', () => {
      const resource = mock<OutgoingShareResource>({
        outgoing: true,
        sharedWith: mock<ShareResource['sharedWith']>()
      })
      expect(isIncomingShareResource(resource)).toBeFalsy()
    })
  })

  describe('getShareResourceRoles', () => {
    it("returns all roles from a drive item's permissions that are also included in the graphRoles", () => {
      const driveItem = mockDeep<DriveItem>()
      driveItem.remoteItem.permissions = [{ roles: ['1', '2'] }, { roles: ['1', '3'] }]
      const graphRoles = { '1': mock<ShareRole>({ id: '1' }), '4': mock<ShareRole>({ id: '4' }) }

      const result = getShareResourceRoles({ driveItem, graphRoles })

      expect(result.length).toBe(1)
      expect(result[0].id).toEqual('1')
    })
  })

  describe('getShareResourcePermissions', () => {
    it('returns permissions based on the given graph share roles', () => {
      const permissions = ['view', 'edit']
      const shareRoles = [
        { rolePermissions: [{ allowedResourceActions: [permissions[0]] }] },
        { rolePermissions: [{ allowedResourceActions: [permissions[1]] }] }
      ] as UnifiedRoleDefinition[]

      const result = getShareResourcePermissions({ driveItem: undefined, shareRoles })

      expect(result).toEqual(permissions)
    })
    it('returns permissions based on a drive item if no graph share roles given', () => {
      const permissions = ['view', 'edit']
      const driveItem = mockDeep<DriveItem>()
      driveItem.remoteItem.permissions = [
        { '@libre.graph.permissions.actions': [permissions[0]] },
        { '@libre.graph.permissions.actions': [permissions[1]] }
      ]

      const result = getShareResourcePermissions({ driveItem, shareRoles: [] })

      expect(result).toEqual(permissions)
    })
  })

  describe('buildIncomingShareResource', () => {
    const driveItem = mockDeep<DriveItem>({ id: 'driveItemId', name: 'driveItemName' })
    const sharedBy = { id: '1', displayName: 'user1' } as Identity
    const sharedWith = { id: '2', displayName: 'user2' } as Identity
    driveItem.remoteItem.permissions = [
      {
        roles: ['1', '2'],
        invitation: { invitedBy: { user: sharedBy } },
        grantedToV2: { user: sharedWith }
      }
    ]

    const graphRoles = {
      '1': mock<ShareRole>({ id: '1', rolePermissions: [{ allowedResourceActions: ['view'] }] }),
      '2': mock<ShareRole>({ id: '1', rolePermissions: [{ allowedResourceActions: ['view'] }] })
    }

    it('sets ids based on the drive item, its first permission and parent reference', () => {
      const result = buildIncomingShareResource({ driveItem, graphRoles, serverUrl: '' })

      expect(result.id).toEqual(driveItem.id)
      expect(result.fileId).toEqual(driveItem.remoteItem.id)
      expect(result.remoteItemId).toEqual(driveItem.remoteItem.id)
      expect(result.driveId).toEqual(driveItem.parentReference.driveId)
      expect(result.parentFolderId).toEqual(driveItem.parentReference.id)
    })
    it.each([true, false])('correctly detects if the resource is a folder', (isFolder) => {
      const item = { ...driveItem }
      item.folder = isFolder ? mock<DriveItem['folder']>() : undefined
      const result = buildIncomingShareResource({ driveItem: item, graphRoles, serverUrl: '' })

      expect(result.isFolder).toEqual(isFolder)
      expect(result.type).toEqual(isFolder ? 'folder' : 'file')
    })
    it('sets outgoing to false', () => {
      const result = buildIncomingShareResource({ driveItem, graphRoles, serverUrl: '' })
      expect(result.outgoing).toBeFalsy()
    })
    it('sets sharedBy based on the permission invitation', () => {
      const result = buildIncomingShareResource({ driveItem, graphRoles, serverUrl: '' })
      expect(result.sharedBy).toEqual([sharedBy])
    })
    it('sets sharedBy based on the permission invitation', () => {
      const result = buildIncomingShareResource({ driveItem, graphRoles, serverUrl: '' })
      expect(result.sharedWith).toEqual([{ ...sharedWith, shareType: ShareTypes.user.value }])
    })
    it('constructs a private link', () => {
      const serverUrl = 'https://example.com'
      const item = mockDeep<DriveItem>({ id: 'driveItemId', name: 'driveItemName' })
      item.remoteItem.webUrl = null
      item.remoteItem.permissions = driveItem.remoteItem.permissions
      const result = buildIncomingShareResource({ driveItem: item, graphRoles, serverUrl })
      expect(result.privateLink).toEqual(urlJoin(serverUrl, 'f', item.remoteItem.id))
    })

    describe('received webapp metadata', () => {
      const positiveExpectation = expectationFor('positive.sharedWithMe.json')
      const webdavExpectation = expectationFor('webdav-only.sharedWithMe.json')
      const emptyNameExpectation = expectationFor('empty-name.sharedWithMe.json')

      it('locks the recorded synthetic names', () => {
        expect(resourceExpectations.additionalNames.map((entry) => entry.appName)).toEqual([
          'Etherpad',
          ' CodiMD ',
          '   '
        ])
      })

      it.each(resourceExpectations.cases)(
        'projects the locked $response fixture',
        (fixtureCase) => {
          const driveItem = driveItemFromResponse(responseFor(fixtureCase.response))
          const result = mapIncoming(driveItem)

          expect(projectResource(result)).toEqual(fixtureCase.mappedResource)
          expectSoleGrant(driveItem, result, fixtureCase.mappedResource)
          expect(result.ocmWebApp).not.toBeNull()
        }
      )

      it('stores CodiMD from the positive fixture and omits a WebDAV-only share', () => {
        const positive = driveItemFromResponse(positiveSharedWithMe)
        const webdavOnly = driveItemFromResponse(webdavOnlySharedWithMe)
        const key = siblingDescriptorKey(positive, webdavOnly)
        const descriptor = requireRecord(
          requireRecord(positive.remoteItem, 'remoteItem')[key],
          'descriptor'
        )

        expect(descriptor.appName).toBe('CodiMD')
        expect(mapIncoming(positive).ocmWebApp).toEqual({ appName: 'CodiMD' })
        expect(mapIncoming(webdavOnly)).not.toHaveProperty('ocmWebApp')
        expect(projectResource(mapIncoming(webdavOnly))).toEqual(webdavExpectation.mappedResource)
      })

      it('keeps an explicit empty appName', () => {
        const result = mapIncoming(driveItemFromResponse(emptyNameSharedWithMe))

        expect(result.ocmWebApp).toEqual({ appName: '' })
        expect(Object.hasOwn(result, 'ocmWebApp')).toBe(true)
        expect(projectResource(result)).toEqual(emptyNameExpectation.mappedResource)
        expectSoleGrant(
          driveItemFromResponse(emptyNameSharedWithMe),
          result,
          emptyNameExpectation.mappedResource
        )
      })

      it.each(resourceExpectations.additionalNames)('stores appName $appName exactly', (entry) => {
        const driveItem = driveItemFromResponse(positiveSharedWithMe)
        const key = siblingDescriptorKey(driveItem, driveItemFromResponse(webdavOnlySharedWithMe))
        const descriptor = requireRecord(
          requireRecord(driveItem.remoteItem, 'remoteItem')[key],
          'descriptor'
        )
        descriptor.appName = entry.appName
        descriptor.ignored = 'not-copied'
        const result = mapIncoming(driveItem)

        expect(result.ocmWebApp).toEqual({ appName: entry.appName })
        expect(Object.keys(result.ocmWebApp ?? {})).toEqual(['appName'])
        if (entry.appName === 'Etherpad') {
          expect(result.ocmWebApp?.appName).toBe('Etherpad')
        }
        expect(projectResource(result)).toEqual({
          ...requireRecord(positiveExpectation.mappedResource, 'mapped resource'),
          ocmWebApp: { appName: entry.appName }
        })
        expectSoleGrant(driveItem, result, positiveExpectation.mappedResource)
      })

      it.each([
        ['null descriptor', null],
        ['array descriptor', [{ appName: 'CodiMD' }]],
        ['missing appName', {}],
        ['non-string appName', { appName: 4 }],
        ['null appName', { appName: null }],
        ['malformed descriptor', 'CodiMD']
      ] as const)('omits a %s', (label, value) => {
        const driveItem = driveItemWithSibling(value)
        const result = mapIncoming(driveItem)

        expect(label).not.toHaveLength(0)
        expect(result).not.toHaveProperty('ocmWebApp')
        expect(result.ocmWebApp).not.toBeNull()
        expect(projectResource(result)).toEqual(webdavExpectation.mappedResource)
        expectSoleGrant(driveItem, result, webdavExpectation.mappedResource)
      })

      it('omits metadata when the sibling field is missing', () => {
        const driveItem = driveItemFromResponse(positiveSharedWithMe)
        const key = siblingDescriptorKey(driveItem, driveItemFromResponse(webdavOnlySharedWithMe))
        delete requireRecord(driveItem.remoteItem, 'remoteItem')[key]
        const result = mapIncoming(driveItem)

        expect(result).not.toHaveProperty('ocmWebApp')
        expect(projectResource(result)).toEqual(webdavExpectation.mappedResource)
        expectSoleGrant(driveItem, result, webdavExpectation.mappedResource)
      })

      it('ignores an obsolete permission-only annotation', () => {
        const positive = driveItemFromResponse(positiveSharedWithMe)
        const driveItem = driveItemFromResponse(webdavOnlySharedWithMe)
        const key = siblingDescriptorKey(positive, driveItem)
        soleGrant(driveItem)[key] = structuredClone(
          requireRecord(positive.remoteItem, 'remoteItem')[key]
        )
        const result = mapIncoming(driveItem)

        expect(requireRecord(driveItem.remoteItem, 'remoteItem')[key]).toBeUndefined()
        expect(result).not.toHaveProperty('ocmWebApp')
        expect(projectResource(result)).toEqual(webdavExpectation.mappedResource)
        expectSoleGrant(driveItem, result, webdavExpectation.mappedResource)
      })

      it('uses the sibling descriptor when a permission annotation is also present', () => {
        const driveItem = driveItemFromResponse(positiveSharedWithMe)
        const key = siblingDescriptorKey(driveItem, driveItemFromResponse(webdavOnlySharedWithMe))
        const etherpad = resourceExpectations.additionalNames.find(
          (entry) => entry.appName === 'Etherpad'
        )
        if (!etherpad) {
          throw new Error('fixture is missing Etherpad')
        }
        soleGrant(driveItem)[key] = { appName: etherpad.appName }
        const result = mapIncoming(driveItem)

        expect(soleGrant(driveItem)[key]).toEqual({ appName: 'Etherpad' })
        expect(result.ocmWebApp).toEqual({ appName: 'CodiMD' })
        expect(projectResource(result)).toEqual(positiveExpectation.mappedResource)
        expectSoleGrant(driveItem, result, positiveExpectation.mappedResource)
      })

      it('does not fall back to a permission annotation when the sibling is malformed', () => {
        const positive = driveItemFromResponse(positiveSharedWithMe)
        const driveItem = driveItemWithSibling(null)
        const key = siblingDescriptorKey(positive, driveItemFromResponse(webdavOnlySharedWithMe))
        soleGrant(driveItem)[key] = structuredClone(
          requireRecord(positive.remoteItem, 'remoteItem')[key]
        )
        const result = mapIncoming(driveItem)

        expect(result).not.toHaveProperty('ocmWebApp')
        expectSoleGrant(driveItem, result, webdavExpectation.mappedResource)
      })

      it('does not treat permission actions as a webapp name', () => {
        const driveItem = driveItemFromResponse(positiveSharedWithMe)
        soleGrant(driveItem)['@libre.graph.permissions.actions'] = ['NotAWebApp']
        const result = mapIncoming(driveItem)

        expect(result.ocmWebApp).toEqual({ appName: 'CodiMD' })
        expect(result.sharePermissions).toEqual(['libre.graph/driveItem/content/read'])
        expect(result.sharePermissions).not.toContain('NotAWebApp')
        expectSoleGrant(driveItem, result, positiveExpectation.mappedResource)
      })
    })
  })

  describe('buildOutgoingShareResource', () => {
    const driveItem = mockDeep<DriveItem>({ id: 'driveItemId', name: 'driveItemName' })
    driveItem.parentReference.path = ''
    const sharedBy = { id: '1', displayName: 'user1' } as Identity
    const sharedWith = { id: '2', displayName: 'user2' } as Identity
    driveItem.permissions = [
      {
        roles: ['1', '2'],
        invitation: { invitedBy: { user: sharedBy } },
        grantedToV2: { user: sharedWith }
      }
    ]
    const user = { id: '1', displayName: 'user1' } as User

    it('sets ids based on the drive item, its first permission and parent reference', () => {
      const result = buildOutgoingShareResource({ driveItem, user, serverUrl: '' })

      expect(result.id).toEqual(driveItem.id)
      expect(result.fileId).toEqual(driveItem.id)
      expect(result.driveId).toEqual(driveItem.parentReference.driveId)
      expect(result.parentFolderId).toEqual(driveItem.parentReference.id)
    })
    it('sets outgoing to true', () => {
      const result = buildOutgoingShareResource({ driveItem, user, serverUrl: '' })
      expect(result.outgoing).toBeTruthy()
    })
    it('sets the path based on the parent reference path and the drive item name', () => {
      const result = buildOutgoingShareResource({ driveItem, user, serverUrl: '' })
      expect(result.path).toEqual(`${driveItem.parentReference.path}/${driveItem.name}`)
    })
    it.each([true, false])('correctly detects if the resource is a folder', (isFolder) => {
      const item = { ...driveItem }
      item.folder = isFolder ? mock<DriveItem['folder']>() : undefined
      const result = buildOutgoingShareResource({ driveItem: item, user, serverUrl: '' })

      expect(result.isFolder).toEqual(isFolder)
      expect(result.type).toEqual(isFolder ? 'folder' : 'file')
    })
    it('constructs a private link', () => {
      const serverUrl = 'https://example.com'
      const item = mockDeep<DriveItem>({ id: 'driveItemId', name: 'driveItemName' })
      item.webUrl = null
      item.parentReference.path = ''
      item.permissions = driveItem.permissions
      const result = buildOutgoingShareResource({ driveItem: item, user, serverUrl })
      expect(result.privateLink).toEqual(urlJoin(serverUrl, 'f', item.id))
    })
  })

  describe('buildCollaboratorShare', () => {
    const graphRoles = {
      '1': mock<ShareRole>({ id: '1', rolePermissions: [{ allowedResourceActions: ['view'] }] }),
      '2': mock<ShareRole>({ id: '1', rolePermissions: [{ allowedResourceActions: ['view'] }] })
    }

    const resourceId = '1'

    it('sets ids based on the permission and the given resource id', () => {
      const graphPermission = mock<Permission>({ '@libre.graph.permissions.actions': [] })

      const result = buildCollaboratorShare({
        graphPermission,
        graphRoles,
        resourceId
      })

      expect(result.id).toEqual(graphPermission.id)
      expect(result.resourceId).toEqual(resourceId)
    })
    describe('share type', () => {
      it('is user type if grantedToV2 includes a user', () => {
        const graphPermission = mock<Permission>({
          '@libre.graph.permissions.actions': [],
          grantedToV2: { user: {}, group: undefined },
          link: undefined
        })

        const result = buildCollaboratorShare({
          graphPermission,
          graphRoles,
          resourceId
        })

        expect(result.shareType).toEqual(ShareTypes.user.value)
      })
      it('is group type if grantedToV2 includes a group', () => {
        const graphPermission = mock<Permission>({
          '@libre.graph.permissions.actions': [],
          grantedToV2: { user: undefined, group: {} },
          link: undefined
        })

        const result = buildCollaboratorShare({
          graphPermission,
          graphRoles,
          resourceId
        })

        expect(result.shareType).toEqual(ShareTypes.group.value)
      })
      it('is external type if grantedToV2 includes a user that is external', () => {
        const graphPermission = mock<Permission>({
          '@libre.graph.permissions.actions': [],
          grantedToV2: { user: { '@libre.graph.userType': 'Federated' }, group: undefined },
          link: undefined
        })

        const result = buildCollaboratorShare({
          graphPermission,
          graphRoles,
          resourceId
        })

        expect(result.shareType).toEqual(ShareTypes.remote.value)
      })
    })
    describe('permissions', () => {
      it('sets permissions if given directly via property', () => {
        const permissions = ['view', 'edit']
        const graphPermission = mock<Permission>({
          '@libre.graph.permissions.actions': permissions
        })

        const result = buildCollaboratorShare({
          graphPermission,
          graphRoles,
          resourceId
        })

        expect(result.permissions).toEqual(permissions)
      })
      it('sets permissions from the graph roles as fallback', () => {
        const graphPermission = mock<Permission>({
          '@libre.graph.permissions.actions': undefined,
          roles: [graphRoles['1'].id]
        })

        const result = buildCollaboratorShare({
          graphPermission,
          graphRoles,
          resourceId
        })

        expect(result.permissions).toEqual(
          graphRoles['1'].rolePermissions.flatMap(
            ({ allowedResourceActions }) => allowedResourceActions
          )
        )
      })
    })
  })

  describe('buildLinkShare', () => {
    const resourceId = '1'

    it('sets ids based on the permission and the given resource id', () => {
      const graphPermission = mock<Permission>({ '@libre.graph.permissions.actions': [] })
      const result = buildLinkShare({ graphPermission, resourceId })

      expect(result.id).toEqual(graphPermission.id)
      expect(result.resourceId).toEqual(resourceId)
    })
    it('sets the sharing link type', () => {
      const graphPermission = mock<Permission>({ '@libre.graph.permissions.actions': [] })
      const result = buildLinkShare({ graphPermission, resourceId })

      expect(result.shareType).toEqual(ShareTypes.link.value)
    })
  })
})

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isJsonRecord(value)) {
    throw new Error(`${label} is not an object`)
  }
  return value
}

function isDriveItem(value: unknown): value is DriveItem {
  if (!isJsonRecord(value) || !isJsonRecord(value.remoteItem)) {
    return false
  }
  return Array.isArray(value.remoteItem.permissions)
}

function responseFor(name: string): { value: readonly unknown[] } {
  if (name === 'positive.sharedWithMe.json') {
    return positiveSharedWithMe
  }
  if (name === 'webdav-only.sharedWithMe.json') {
    return webdavOnlySharedWithMe
  }
  if (name === 'empty-name.sharedWithMe.json') {
    return emptyNameSharedWithMe
  }
  throw new Error(`unexpected fixture response ${name}`)
}

function driveItemFromResponse(response: { value: readonly unknown[] }): DriveItem {
  const driveItem = response.value[0]
  if (!isDriveItem(driveItem)) {
    throw new Error('fixture response has no drive item')
  }
  return structuredClone(driveItem)
}

function expectationFor(responseName: string) {
  const fixtureCase = resourceExpectations.cases.find((item) => item.response === responseName)
  if (!fixtureCase) {
    throw new Error(`missing expectation for ${responseName}`)
  }
  return fixtureCase
}

function graphRolesFromFixture(): Record<string, ShareRole> {
  const roles: Record<string, ShareRole> = {}
  for (const [roleId, role] of Object.entries(resourceExpectations.inputs.graphRoles)) {
    roles[roleId] = {
      id: role.id,
      displayName: role.displayName,
      rolePermissions: role.rolePermissions.map((permission) => ({
        allowedResourceActions: [...permission.allowedResourceActions]
      }))
    }
  }
  return roles
}

function mapIncoming(driveItem: DriveItem): IncomingShareResource {
  return buildIncomingShareResource({
    driveItem,
    graphRoles: graphRolesFromFixture(),
    serverUrl: resourceExpectations.inputs.serverUrl
  })
}

function projectResource(resource: IncomingShareResource): Record<string, unknown> {
  const values: Record<string, unknown> = {
    id: resource.id,
    remoteItemId: resource.remoteItemId,
    fileId: resource.fileId,
    storageId: resource.storageId,
    driveId: resource.driveId,
    parentFolderId: resource.parentFolderId,
    name: resource.name,
    path: resource.path,
    isFolder: resource.isFolder,
    type: resource.type,
    mimeType: resource.mimeType,
    size: resource.size,
    sharedBy: resource.sharedBy,
    sharedWith: resource.sharedWith,
    shareTypes: resource.shareTypes,
    shareRoles: resource.shareRoles,
    sharePermissions: resource.sharePermissions,
    syncEnabled: resource.syncEnabled,
    hidden: resource.hidden,
    outgoing: resource.outgoing,
    ocmWebApp: resource.ocmWebApp
  }
  const projected: Record<string, unknown> = {}
  for (const field of resourceExpectations.projectionFields) {
    if (!Object.hasOwn(values, field)) {
      throw new Error(`unexpected projection field ${field}`)
    }
    if (values[field] !== undefined) {
      projected[field] = values[field]
    }
  }
  return projected
}

function soleGrant(driveItem: DriveItem): Record<string, unknown> {
  const remoteItem = requireRecord(driveItem.remoteItem, 'remoteItem')
  if (!Array.isArray(remoteItem.permissions) || !isJsonRecord(remoteItem.permissions[0])) {
    throw new Error('fixture grant missing')
  }
  return remoteItem.permissions[0]
}

function siblingDescriptorKey(positive: DriveItem, webdavOnly: DriveItem): string {
  const positiveRemote = requireRecord(positive.remoteItem, 'positive remoteItem')
  const webdavRemote = requireRecord(webdavOnly.remoteItem, 'webdav remoteItem')
  const baseline = new Set(Object.keys(webdavRemote))
  const extra = Object.keys(positiveRemote).filter((key) => !baseline.has(key))
  if (extra.length !== 1) {
    throw new Error(`expected one received webapp field, found ${extra.join(', ')}`)
  }
  return extra[0]
}

function driveItemWithSibling(value: unknown): DriveItem {
  const driveItem = driveItemFromResponse(positiveSharedWithMe)
  const key = siblingDescriptorKey(driveItem, driveItemFromResponse(webdavOnlySharedWithMe))
  requireRecord(driveItem.remoteItem, 'remoteItem')[key] = value
  return driveItem
}

function expectSoleGrant(
  driveItem: DriveItem,
  result: IncomingShareResource,
  mapped: {
    id: string
    remoteItemId: string
    fileId: string
    sharedBy: unknown
    sharedWith: unknown
    shareRoles: unknown
    sharePermissions: unknown
  }
) {
  const remoteItem = requireRecord(driveItem.remoteItem, 'remoteItem')
  if (!Array.isArray(remoteItem.permissions)) {
    throw new Error('fixture grant is not an array')
  }
  expect(remoteItem.permissions).toHaveLength(1)
  expect(result.sharedWith).toHaveLength(1)
  expect(result.sharedBy).toHaveLength(1)
  expect(result.shareRoles).toHaveLength(1)
  expect(result.id).toEqual(mapped.id)
  expect(result.remoteItemId).toEqual(mapped.remoteItemId)
  expect(result.fileId).toEqual(mapped.fileId)
  expect(result.sharedBy).toEqual(mapped.sharedBy)
  expect(result.sharedWith).toEqual(mapped.sharedWith)
  expect(result.shareRoles).toEqual(mapped.shareRoles)
  expect(result.sharePermissions).toEqual(mapped.sharePermissions)
}
