import { mock, mockDeep } from 'vitest-mock-extended'
import {
  buildIncomingShareResource,
  IncomingShareResource,
  MountPointSpaceResource,
  Resource,
  ShareRole,
  SpaceResource
} from '@ownclouders/web-client'
import { DriveItem } from '@ownclouders/web-client/graph/generated'
import { FolderLoaderSpace } from '../../../../src/services/folder/loaderSpace'
import { TaskContext } from '../../../../src/services/folder'
import emptyNameSharedWithMe from '../../../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/empty-name.sharedWithMe.json'
import positiveSharedWithMe from '../../../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/positive.sharedWithMe.json'
import resourceExpectations from '../../../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/resource-expectations.json'
import webdavOnlySharedWithMe from '../../../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/webdav-only.sharedWithMe.json'

vi.mock('@ownclouders/web-pkg', async () => {
  const actual =
    await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return {
    ...actual,
    useFileRouteReplace: () => ({
      replaceInvalidFileRoute: vi.fn()
    })
  }
})

const serverUrl = resourceExpectations.inputs.serverUrl
const folderSpec = resourceExpectations.inputs.currentFolder
const childSpec = resourceExpectations.inputs.children[0]

describe('FolderLoaderSpace received webapp metadata', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the root mapper and reads metadata once', async () => {
    const harness = createHarness()
    const mountItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(mountItem), {})
    const stored = harness.remember(space)
    const listing = webdavListing()
    harness.useListing(listing)
    harness.useMount(mountItem)
    harness.listSharedWithMe.mockResolvedValue([mountItem])

    await harness.run(space, '/', 'webdav-root-file')

    const published = harness.published()
    const currentFolder = expectIncomingShare(published.currentFolder)
    const mapped = mapIncoming(mountItem)
    expect(currentFolder.id).toBe(mapped.id)
    expect(currentFolder.fileId).toBe(mapped.fileId)
    expect(currentFolder.path).toBe(mapped.path)
    expect(currentFolder.name).toBe(mapped.name)
    expect(currentFolder.shareRoles).toEqual(mapped.shareRoles)
    expect(currentFolder.sharePermissions).toEqual(mapped.sharePermissions)
    expect(currentFolder.remoteItemId).toBe(space.id)
    expect(currentFolder.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(published.currentFolder.id).not.toBe(listing.resource.id)
    expectStamp(published.resources[0], childSpec, { appName: 'CodiMD' })
    expect(stored.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(stored.members?.['user-1']).toBeDefined()
    expect(space.members).toEqual({})
    expect(harness.listSharedWithMe).toHaveBeenCalledTimes(1)
    expect(harness.listSharedWithMe).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
    expect(harness.getDriveItem).toHaveBeenCalledTimes(1)
  })

  it('stamps a direct nested entry without a mount lookup', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(driveItem))
    const stored = harness.remember(space)
    const listing = webdavListing()
    harness.useListing(listing)
    harness.listSharedWithMe.mockResolvedValue([driveItem])

    await harness.run(space)

    const published = harness.published()
    expectStamp(published.currentFolder, folderSpec, { appName: 'CodiMD' })
    expectStamp(published.resources[0], childSpec, { appName: 'CodiMD' })
    expect(published.currentFolder.id).toBe(folderSpec.id)
    expect(stored.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(space.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(stored).not.toBe(space)
    expect(harness.listSharedWithMe).toHaveBeenCalledTimes(1)
    expect(harness.getMountPoint).not.toHaveBeenCalled()
    expect(harness.getDriveItem).not.toHaveBeenCalled()
  })

  it('resolves metadata when members are already populated', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const members = populatedMembers()
    const space = shareSpace(remoteId(driveItem), members)
    const stored = harness.remember(space)
    harness.useListing(webdavListing())
    harness.listSharedWithMe.mockResolvedValue([driveItem])

    await harness.run(space)

    expect(stored.members).toBe(members)
    expect(harness.context.spacesStore.updateSpaceField).not.toHaveBeenCalledWith(
      expect.objectContaining({ field: 'members' })
    )
    expect(harness.published().resources[0].ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(harness.listSharedWithMe).toHaveBeenCalledTimes(1)
  })

  it('uses the list lookup when the mount GET has no metadata', async () => {
    const harness = createHarness()
    const mountItem = driveItemFrom(webdavOnlySharedWithMe)
    mountItem.name = 'mount-name'
    const listed = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(listed), populatedMembers())
    space.ocmWebApp = { appName: 'Cached' }
    const stored = harness.remember(space)
    stored.ocmWebApp = { appName: 'Cached' }
    const listing = webdavListing()
    harness.useListing(listing)
    harness.useMount(mountItem)
    harness.listSharedWithMe.mockResolvedValue([listed])

    await harness.run(space, '/', 'webdav-root-file')

    const currentFolder = expectIncomingShare(harness.published().currentFolder)
    const mapped = mapIncoming(mountItem)
    expect(mapped.ocmWebApp).toBeUndefined()
    expect(currentFolder.name).toBe('mount-name')
    expect(currentFolder.id).toBe(mapped.id)
    expect(currentFolder.fileId).toBe(mapped.fileId)
    expect(currentFolder.path).toBe(mapped.path)
    expect(currentFolder.shareRoles).toEqual(mapped.shareRoles)
    expect(currentFolder.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(currentFolder.remoteItemId).toBe(space.id)
    expect(stored.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(space.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(harness.listSharedWithMe).toHaveBeenCalledTimes(1)
    expect(harness.getDriveItem).toHaveBeenCalledTimes(1)
    expect(listing.resource.id).not.toBe(currentFolder.id)
  })

  it('clears metadata when the remote id is missing or duplicated', async () => {
    const harness = createHarness()
    const listed = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(listed))
    const stored = harness.remember(space)
    const listing = webdavListing()
    listing.resource.ocmWebApp = { appName: 'Stale' }
    listing.children[0].ocmWebApp = { appName: 'Stale' }
    harness.useListing(listing)

    const other = driveItemFrom(positiveSharedWithMe)
    setRemoteId(other, 'other-remote')
    harness.listSharedWithMe.mockResolvedValue([other])
    await harness.run(space)
    expect(stored.ocmWebApp).toBeUndefined()
    expect(listing.resource.ocmWebApp).toBeUndefined()
    expect(listing.children[0].ocmWebApp).toBeUndefined()

    const duplicateA = driveItemFrom(positiveSharedWithMe)
    const duplicateB = driveItemFrom(positiveSharedWithMe)
    listing.resource.ocmWebApp = { appName: 'Stale' }
    harness.listSharedWithMe.mockResolvedValue([duplicateA, duplicateB])
    await harness.run(space)
    expect(stored.ocmWebApp).toBeUndefined()
    expect(listing.children[0].ocmWebApp).toBeUndefined()
    expect(harness.listSharedWithMe).toHaveBeenCalledTimes(2)
  })

  it('does not treat a drive item id as the share id', async () => {
    const harness = createHarness()
    const trap = driveItemFrom(positiveSharedWithMe)
    const spaceId = remoteId(trap)
    trap.id = spaceId
    setRemoteId(trap, 'other-remote')
    const space = shareSpace(spaceId)
    const stored = harness.remember(space)
    harness.useListing(webdavListing())
    harness.listSharedWithMe.mockResolvedValue([trap])

    await harness.run(space)

    expect(stored.ocmWebApp).toBeUndefined()
    expect(harness.published().resources[0].ocmWebApp).toBeUndefined()
    expect(harness.published().resources[0].remoteItemId).toBe(spaceId)
  })

  it('selects the matching remote id when share names are the same', async () => {
    const harness = createHarness()
    const match = driveItemFrom(positiveSharedWithMe)
    const decoy = driveItemFrom(positiveSharedWithMe)
    setRemoteId(decoy, 'other-remote')
    decoy.id = remoteId(match)
    setAppName(decoy, 'Etherpad')
    const space = shareSpace(remoteId(match))
    harness.remember(space)
    harness.useListing(webdavListing())
    harness.listSharedWithMe.mockResolvedValue([decoy, match])

    await harness.run(space)

    expect(harness.published().currentFolder.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(harness.published().resources[0].ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(match.name).toBe(decoy.name)
  })

  it('keeps an explicit empty app name', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(emptyNameSharedWithMe)
    const space = shareSpace(remoteId(driveItem))
    const stored = harness.remember(space)
    harness.useListing(webdavListing())
    harness.listSharedWithMe.mockResolvedValue([driveItem])

    await harness.run(space)

    expect(stored.ocmWebApp).toEqual({ appName: '' })
    expect(harness.published().currentFolder.ocmWebApp).toEqual({ appName: '' })
    expect(harness.published().resources[0].ocmWebApp).toEqual({ appName: '' })
  })

  it('clears metadata when the share is opened again after removal', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(driveItem))
    const stored = harness.remember(space)
    const listing = webdavListing()
    harness.useListing(listing)
    harness.listSharedWithMe.mockResolvedValueOnce([driveItem]).mockResolvedValueOnce([])

    await harness.run(space)
    expect(listing.resource.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(listing.children[0].id).toBe(childSpec.id)

    await harness.run(space)

    expect(stored.ocmWebApp).toBeUndefined()
    expect(space.ocmWebApp).toBeUndefined()
    expect(listing.resource.ocmWebApp).toBeUndefined()
    expect(listing.children[0].ocmWebApp).toBeUndefined()
    expect(listing.children[0].id).toBe(childSpec.id)
    expect(listing.children[0].fileId).toBe(childSpec.fileId)
    expect(listing.children[0].path).toBe(childSpec.path)
    expect(listing.resource.remoteItemId).toBe(space.id)
  })

  it('keeps WebDAV browsing when the metadata request fails', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(driveItem))
    const stored = harness.remember(space)
    const listing = webdavListing()
    listing.resource.ocmWebApp = { appName: 'Stale' }
    listing.children[0].ocmWebApp = { appName: 'Stale' }
    harness.useListing(listing)
    harness.listSharedWithMe.mockRejectedValue(new Error('metadata unavailable'))

    await harness.run(space)

    const published = harness.published()
    expect(published.resources[0].id).toBe(childSpec.id)
    expect(published.resources[0].ocmWebApp).toBeUndefined()
    expect(published.currentFolder.id).toBe(folderSpec.id)
    expect(published.currentFolder.ocmWebApp).toBeUndefined()
    expect(stored.ocmWebApp).toBeUndefined()
    expect(harness.context.authService.handleAuthError).not.toHaveBeenCalled()
  })

  it('clears metadata when the matched item is malformed', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    driveItem.remoteItem.permissions = []
    const space = shareSpace(remoteId(driveItem))
    const stored = harness.remember(space)
    harness.useListing(webdavListing())
    harness.listSharedWithMe.mockResolvedValue([driveItem])

    await harness.run(space)

    expect(stored.ocmWebApp).toBeUndefined()
    expect(harness.published().resources).toHaveLength(1)
    expect(harness.published().resources[0].id).toBe(childSpec.id)
  })

  it('does not publish a list when metadata authentication fails', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(driveItem))
    harness.remember(space)
    harness.useListing(webdavListing())
    harness.listSharedWithMe.mockRejectedValue({ statusCode: 401 })

    await harness.run(space)

    expect(harness.context.resourcesStore.initResourceList).not.toHaveBeenCalled()
    expect(harness.context.resourcesStore.setCurrentFolder).toHaveBeenCalledWith(null)
    expect(harness.context.authService.handleAuthError).toHaveBeenCalled()
  })

  it('does not request sharedWithMe for a non-share load', async () => {
    const harness = createHarness()
    const listing = webdavListing()
    listing.resource.ocmWebApp = { appName: 'CodiMD' }
    listing.children[0].ocmWebApp = { appName: 'CodiMD' }
    listing.children[0].remoteItemId = 'keep-me'
    harness.useListing(listing)
    const space = {
      id: 'personal-space',
      driveType: 'personal',
      members: populatedMembers(),
      ocmWebApp: { appName: 'CodiMD' }
    } as SpaceResource

    await harness.run(space)

    const published = harness.published()
    expect(harness.listSharedWithMe).not.toHaveBeenCalled()
    expect(published.currentFolder.ocmWebApp).toBeUndefined()
    expect(published.resources[0].ocmWebApp).toBeUndefined()
    expect(published.resources[0].remoteItemId).toBe('keep-me')
    expect(published.resources[0].id).toBe(childSpec.id)
    expect(space.ocmWebApp).toEqual({ appName: 'CodiMD' })
  })

  it('drops webapp metadata from a WebDAV-only child after a webapp share', async () => {
    const harness = createHarness()
    const positive = driveItemFrom(positiveSharedWithMe)
    const positiveSpace = shareSpace(remoteId(positive))
    harness.remember(positiveSpace)
    const positiveListing = webdavListing()
    const webdavItem = driveItemFrom(webdavOnlySharedWithMe)
    setRemoteId(webdavItem, 'webdav-only-remote')
    const webdavSpace = shareSpace(remoteId(webdavItem))
    const storedWebdav = harness.remember(webdavSpace)
    const webdavListingResult = webdavListing()
    webdavListingResult.resource.id = 'webdav-folder'
    webdavListingResult.children[0].id = 'webdav-child'
    webdavListingResult.children[0].ocmWebApp = { appName: 'CodiMD' }
    harness.context.clientService.webdav.listFiles.mockImplementation((space) => {
      return Promise.resolve(space.id === positiveSpace.id ? positiveListing : webdavListingResult)
    })
    let sharedWithMeCalls = 0
    harness.listSharedWithMe.mockImplementation(() => {
      sharedWithMeCalls += 1
      return Promise.resolve(sharedWithMeCalls === 1 ? [positive] : [webdavItem])
    })

    await harness.run(positiveSpace)
    expect(positiveListing.children[0].ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(positiveListing.children[0].id).toBe(childSpec.id)

    await harness.run(webdavSpace)

    expect(webdavListingResult.children[0].ocmWebApp).toBeUndefined()
    expect(webdavListingResult.children[0].id).toBe('webdav-child')
    expect(webdavListingResult.resource.ocmWebApp).toBeUndefined()
    expect(storedWebdav.ocmWebApp).toBeUndefined()
    expect(positiveListing.children[0].id).toBe(childSpec.id)
    expect(positiveListing.children[0].remoteItemId).toBe(positiveSpace.id)
  })

  it('does not carry metadata across a share switch', async () => {
    const harness = createHarness()
    const firstItem = driveItemFrom(positiveSharedWithMe)
    const secondItem = driveItemFrom(positiveSharedWithMe)
    setRemoteId(secondItem, 'second-remote')
    setAppName(secondItem, 'Etherpad')
    const firstSpace = shareSpace(remoteId(firstItem))
    const secondSpace = shareSpace(remoteId(secondItem))
    const storedFirst = harness.remember(firstSpace)
    const storedSecond = harness.remember(secondSpace)
    const firstListing = webdavListing()
    const secondListing = webdavListing()
    secondListing.resource.id = 'second-folder'
    secondListing.children[0].id = 'second-child'
    secondListing.children[0].ocmWebApp = { appName: 'CodiMD' }
    harness.context.clientService.webdav.listFiles.mockImplementation((space) => {
      return Promise.resolve(space.id === firstSpace.id ? firstListing : secondListing)
    })
    let sharedWithMeCalls = 0
    harness.listSharedWithMe.mockImplementation(() => {
      sharedWithMeCalls += 1
      return Promise.resolve(sharedWithMeCalls === 1 ? [firstItem] : [secondItem])
    })

    await harness.run(firstSpace)
    await harness.run(secondSpace)

    expect(storedFirst.ocmWebApp).toEqual({ appName: 'CodiMD' })
    expect(storedSecond.ocmWebApp).toEqual({ appName: 'Etherpad' })
    expect(secondListing.resource.ocmWebApp).toEqual({ appName: 'Etherpad' })
    expect(secondListing.children[0].ocmWebApp).toEqual({ appName: 'Etherpad' })
    expect(secondListing.children[0].id).toBe('second-child')
    expect(secondListing.children[0].remoteItemId).toBe(secondSpace.id)
    expect(firstListing.children[0].id).toBe(childSpec.id)
  })

  it('does not publish metadata or the resource list for a cancelled load', async () => {
    const harness = createHarness()
    const firstItem = driveItemFrom(positiveSharedWithMe)
    const secondItem = driveItemFrom(positiveSharedWithMe)
    setRemoteId(secondItem, 'second-remote')
    setAppName(secondItem, 'Etherpad')
    const firstSpace = shareSpace(remoteId(firstItem))
    const secondSpace = shareSpace(remoteId(secondItem))
    const storedFirst = harness.remember(firstSpace)
    const storedSecond = harness.remember(secondSpace)
    storedFirst.ocmWebApp = { appName: 'Stale' }
    firstSpace.ocmWebApp = { appName: 'Stale' }
    const pending: Array<(items: DriveItem[]) => void> = []
    harness.listSharedWithMe.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve)
        })
    )
    harness.context.clientService.webdav.listFiles.mockImplementation((space) => {
      const listing = webdavListing()
      listing.resource.id = space.id === firstSpace.id ? 'folder-a' : 'folder-b'
      listing.children[0].id = space.id === firstSpace.id ? 'child-a' : 'child-b'
      return Promise.resolve(listing)
    })

    const first = harness.task.perform(
      undefined,
      firstSpace,
      folderSpec.path,
      folderSpec.fileId,
      {}
    )
    void first.catch(() => undefined)
    await vi.waitUntil(() => pending.length === 1)
    expect(storedFirst.ocmWebApp).toBeUndefined()

    const second = harness.task.perform(
      undefined,
      secondSpace,
      folderSpec.path,
      folderSpec.fileId,
      {}
    )
    await vi.waitUntil(() => pending.length === 2)
    pending[0]([firstItem])
    await Promise.resolve()
    await Promise.resolve()

    expect(harness.context.resourcesStore.initResourceList).not.toHaveBeenCalled()
    expect(storedFirst.ocmWebApp).toBeUndefined()
    expect(storedSecond.ocmWebApp).toBeUndefined()

    pending[1]([secondItem])
    await second

    const published = harness.published()
    expect(harness.context.resourcesStore.initResourceList).toHaveBeenCalledTimes(1)
    expect(published.currentFolder.id).toBe('folder-b')
    expect(published.currentFolder.ocmWebApp).toEqual({ appName: 'Etherpad' })
    expect(published.resources[0].id).toBe('child-b')
    expect(published.resources[0].ocmWebApp).toEqual({ appName: 'Etherpad' })
    expect(published.resources[0].remoteItemId).toBe(secondSpace.id)
    expect(storedFirst.ocmWebApp).toBeUndefined()
    expect(storedSecond.ocmWebApp).toEqual({ appName: 'Etherpad' })
    expect(firstSpace.ocmWebApp).toBeUndefined()
  })

  it('does not publish metadata or the resource list for a cancelled empty-members nested load', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(driveItem), {})
    const stored = harness.remember(space)
    const listing = webdavListing()
    harness.useListing(listing)
    harness.listSharedWithMe.mockImplementation(() => Promise.resolve([driveItem]))
    harness.getMountPoint.mockResolvedValue(
      mock<MountPointSpaceResource>({ id: 'mount-drive!root-item' })
    )
    const cancelError = new Error('cancelled')
    cancelError.name = 'CanceledError'
    harness.getDriveItem.mockRejectedValue(cancelError)

    await harness.run(space, folderSpec.path, folderSpec.fileId)

    expect(folderSpec.path).not.toBe('/')
    expect(harness.listSharedWithMe).toHaveBeenCalledTimes(1)
    expect(harness.getMountPoint).toHaveBeenCalledTimes(1)
    expect(harness.getDriveItem).toHaveBeenCalledTimes(1)
    expect(space.ocmWebApp).toBeUndefined()
    expect(stored.ocmWebApp).toBeUndefined()
    expect(listing.resource.ocmWebApp).toBeUndefined()
    expect(listing.resource.remoteItemId).toBeUndefined()
    expect(listing.children[0].ocmWebApp).toBeUndefined()
    expect(listing.children[0].remoteItemId).toBeUndefined()
    expect(harness.context.resourcesStore.initResourceList).not.toHaveBeenCalled()
    expect(harness.context.resourcesStore.setCurrentFolder).toHaveBeenCalledWith(null)
    expect(harness.context.spacesStore.updateSpaceField).not.toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'ocmWebApp',
        value: { appName: 'CodiMD' }
      })
    )
  })

  it('does not publish a list when the metadata request is aborted', async () => {
    const harness = createHarness()
    const driveItem = driveItemFrom(positiveSharedWithMe)
    const space = shareSpace(remoteId(driveItem))
    const stored = harness.remember(space)
    harness.useListing(webdavListing())
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    harness.listSharedWithMe.mockRejectedValue(abortError)

    await harness.run(space)

    expect(harness.context.resourcesStore.initResourceList).not.toHaveBeenCalled()
    expect(stored.ocmWebApp).toBeUndefined()
    expect(space.ocmWebApp).toBeUndefined()
  })
})

function createHarness() {
  const storedSpaces = new Map<string, SpaceResource>()
  const context = mockDeep<TaskContext>()
  context.userStore.user.id = 'user-1'
  context.userStore.user.displayName = 'User One'
  Reflect.set(context.configStore, 'serverUrl', serverUrl)
  context.sharesStore.graphRoles = graphRolesFromFixture()
  context.resourcesStore.loadAncestorMetaData.mockResolvedValue(undefined)
  context.spacesStore.updateSpaceField.mockImplementation((update) => {
    const stored = storedSpaces.get(update.id)
    if (!stored) {
      return
    }
    Reflect.set(stored, update.field, update.value)
  })

  const loader = new FolderLoaderSpace()
  const task = loader.getTask(context)
  const listSharedWithMe = context.clientService.graphAuthenticated.driveItems.listSharedWithMe
  const getDriveItem = context.clientService.graphAuthenticated.driveItems.getDriveItem
  const getMountPoint = context.spacesStore.getMountPointForSpace

  return {
    context,
    task,
    listSharedWithMe,
    getDriveItem,
    getMountPoint,
    remember(space: SpaceResource) {
      const stored = {
        id: space.id,
        driveType: space.driveType,
        members: space.members,
        ocmWebApp: space.ocmWebApp ? { appName: space.ocmWebApp.appName } : undefined
      } as SpaceResource
      storedSpaces.set(space.id, stored)
      return stored
    },
    useListing(listing: { resource: Resource; children: Resource[] }) {
      context.clientService.webdav.listFiles.mockResolvedValue(listing)
    },
    useMount(driveItem: DriveItem) {
      getMountPoint.mockResolvedValue(
        mock<MountPointSpaceResource>({ id: 'mount-drive!root-item' })
      )
      getDriveItem.mockResolvedValue(driveItem)
    },
    async run(space: SpaceResource, path = folderSpec.path, fileId = folderSpec.fileId) {
      // The inner task receives the outer cancel token before the space.
      await task.perform(undefined, space, path, fileId, {})
    },
    published() {
      const last = context.resourcesStore.initResourceList.mock.calls.at(-1)?.[0] as
        | { currentFolder: Resource; resources: Resource[] }
        | undefined
      if (!last) {
        throw new Error('resource list was not published')
      }
      return last
    }
  }
}

function shareSpace(
  id: string,
  members: SpaceResource['members'] = populatedMembers()
): SpaceResource {
  return {
    id,
    driveType: 'share',
    name: 'shared-folder',
    members,
    ocmWebApp: { appName: 'Stale' }
  } as SpaceResource
}

function populatedMembers(): SpaceResource['members'] {
  return {
    'user-1': {
      grantedTo: { user: { id: 'user-1', displayName: 'User One' } },
      permissions: ['read'],
      roleId: 'role'
    }
  }
}

function webdavListing(): { resource: Resource; children: Resource[] } {
  return {
    resource: {
      id: folderSpec.id,
      fileId: folderSpec.fileId,
      path: folderSpec.path,
      type: folderSpec.type,
      isFolder: folderSpec.isFolder
    },
    children: [
      {
        id: childSpec.id,
        fileId: childSpec.fileId,
        path: childSpec.path,
        name: childSpec.name,
        type: childSpec.type,
        isFolder: childSpec.isFolder
      }
    ]
  }
}

function expectIncomingShare(resource: Resource): IncomingShareResource {
  if (!isIncomingShare(resource)) {
    throw new Error('root folder was not mapped as an incoming share')
  }
  return resource
}

function isIncomingShare(resource: Resource): resource is IncomingShareResource {
  return 'shareRoles' in resource && 'sharePermissions' in resource
}

function expectStamp(
  resource: Resource,
  expected: { id: string; fileId?: string; path: string },
  ocmWebApp: { appName: string }
) {
  expect(resource.id).toBe(expected.id)
  expect(resource.fileId).toBe(expected.fileId)
  expect(resource.path).toBe(expected.path)
  expect(resource.remoteItemId).toBe(resourceExpectations.inputs.shareSpace.id)
  expect(resource.ocmWebApp).toEqual(ocmWebApp)
}

function mapIncoming(driveItem: DriveItem) {
  return buildIncomingShareResource({
    driveItem,
    graphRoles: graphRolesFromFixture(),
    serverUrl
  })
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

function driveItemFrom(response: { value: readonly unknown[] }): DriveItem {
  const driveItem = response.value[0]
  if (!isDriveItem(driveItem)) {
    throw new Error('fixture response has no drive item')
  }
  return structuredClone(driveItem)
}

function remoteId(driveItem: DriveItem): string {
  const id = driveItem.remoteItem?.id
  if (!id) {
    throw new Error('fixture remote id missing')
  }
  return id
}

function setRemoteId(driveItem: DriveItem, id: string) {
  if (!driveItem.remoteItem) {
    throw new Error('fixture remote item missing')
  }
  driveItem.remoteItem.id = id
}

function setAppName(driveItem: DriveItem, appName: string) {
  const remoteItem: unknown = driveItem.remoteItem
  if (!isRecord(remoteItem)) {
    throw new Error('fixture remote item missing')
  }
  remoteItem['@ocm.webApp'] = { appName }
}

function isDriveItem(value: unknown): value is DriveItem {
  return (
    isRecord(value) && isRecord(value.remoteItem) && Array.isArray(value.remoteItem.permissions)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
