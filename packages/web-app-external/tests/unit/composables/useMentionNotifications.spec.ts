import { ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { CollaboratorShare, Resource, ShareRole, SpaceResource } from '@ownclouders/web-client'
import { User } from '@ownclouders/web-client/graph/generated'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { useMentionNotifications } from '../../../src/composables/useMentionNotifications'
import { useMessages, useSharesStore } from '@ownclouders/web-pkg'

describe('useMentionNotifications', () => {
  const getContext = () => ({
    space: ref(mock<SpaceResource>({ id: 'space-1' })),
    resource: ref(
      mock<Resource>({
        id: 'resource-1',
        fileId: 'file-1',
        privateLink: 'https://example.test/f/resource-1'
      })
    ),
    appIframeRef: ref(null)
  })

  const createUser = (overrides: Partial<User> = {}) =>
    mock<User>({
      id: 'alice-id',
      displayName: 'Alice',
      onPremisesSamAccountName: undefined,
      ...overrides
    })

  const createCollaboratorShare = (overrides: Partial<CollaboratorShare> = {}) =>
    mock<CollaboratorShare>({
      indirect: false,
      sharedWith: { id: 'alice-id', displayName: 'Alice' },
      role: mock<ShareRole>(),
      ...overrides
    })

  const getWrapper = ({
    users = [],
    collaboratorShares = [],
    allowedRoles = [mock<ShareRole>({ id: 'role-viewer' })],
    searchMinLength = undefined as number | undefined
  } = {}) => {
    const mocks = defaultComponentMocks()
    mocks.$clientService.graphAuthenticated.users.listUsers.mockResolvedValue(users)
    mocks.$clientService.graphAuthenticated.permissions.listPermissions.mockResolvedValue({
      shares: [],
      allowedActions: [],
      allowedRoles
    })

    let instance: ReturnType<typeof useMentionNotifications>
    let sharesStore: ReturnType<typeof useSharesStore>
    let messagesStore: ReturnType<typeof useMessages>
    getComposableWrapper(
      () => {
        instance = useMentionNotifications(getContext())
        sharesStore = useSharesStore()
        messagesStore = useMessages()
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: {
          piniaOptions: {
            sharesState: { collaboratorShares },
            ...(searchMinLength !== undefined && {
              capabilityState: {
                capabilities: { files_sharing: { search_min_length: searchMinLength } }
              }
            })
          }
        }
      }
    )
    return {
      mocks,
      getInstance: () => instance,
      getSharesStore: () => sharesStore,
      getMessagesStore: () => messagesStore
    }
  }

  describe('resolveMentionCandidates', () => {
    it('searches all users, the same way the invite dialog does', async () => {
      const { getInstance, mocks } = getWrapper({
        users: [createUser({ id: 'alice-id', displayName: 'Alice' })]
      })

      const candidates = await getInstance().resolveMentionCandidates('ali')

      expect(mocks.$clientService.graphAuthenticated.users.listUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: '"ali"' }),
        expect.objectContaining({ signal: expect.anything() })
      )
      expect(candidates).toEqual([
        {
          username: 'alice-id',
          profile: expect.stringContaining('/f/resource-1'),
          label: 'Alice'
        }
      ])
    })

    it('excludes the current user from the results', async () => {
      const { getInstance } = getWrapper({
        // default mocked user id is '1', see defaultComponentMocks/pinia userState
        users: [createUser({ id: '1', displayName: 'Me' })]
      })

      const candidates = await getInstance().resolveMentionCandidates('me')
      expect(candidates).toEqual([])
    })

    it('does not search below the sharing search minimum length', async () => {
      const { getInstance, mocks } = getWrapper({
        users: [createUser()],
        searchMinLength: 3
      })

      const candidates = await getInstance().resolveMentionCandidates('al')

      expect(candidates).toEqual([])
      expect(mocks.$clientService.graphAuthenticated.users.listUsers).not.toHaveBeenCalled()
    })

    it('includes the username in the label so office apps can match on it', async () => {
      const { getInstance } = getWrapper({
        users: [
          createUser({
            id: 'alice-id',
            displayName: 'Alice Smith',
            onPremisesSamAccountName: 'asmith'
          })
        ]
      })

      const candidates = await getInstance().resolveMentionCandidates('ali')

      expect(candidates).toEqual([expect.objectContaining({ label: 'Alice Smith (asmith)' })])
    })

    it('falls back to separate secondary/service account searches when the default search is empty', async () => {
      const { getInstance, mocks } = getWrapper()
      mocks.$clientService.graphAuthenticated.users.listUsers
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          createUser({ id: 'secondary-id', displayName: 'Secondary Account' })
        ])
        .mockResolvedValueOnce([createUser({ id: 'svc-id', displayName: 'Service Account' })])

      const candidates = await getInstance().resolveMentionCandidates('svc')

      expect(mocks.$clientService.graphAuthenticated.users.listUsers).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ search: '"svc"', filter: "userType eq 'Secondary'" }),
        expect.objectContaining({ signal: expect.anything() })
      )
      expect(mocks.$clientService.graphAuthenticated.users.listUsers).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ search: '"svc"', filter: "userType eq 'Service'" }),
        expect.objectContaining({ signal: expect.anything() })
      )
      expect(candidates).toEqual([
        expect.objectContaining({ username: 'secondary-id' }),
        expect.objectContaining({ username: 'svc-id' })
      ])
    })

    it('does not search service/secondary accounts when the default search already found someone', async () => {
      const { getInstance, mocks } = getWrapper({
        users: [createUser({ id: 'alice-id', displayName: 'Alice' })]
      })

      await getInstance().resolveMentionCandidates('ali')

      expect(mocks.$clientService.graphAuthenticated.users.listUsers).toHaveBeenCalledTimes(1)
    })
  })

  describe('queueMention', () => {
    it('does not grant access merely by being selected from autocomplete', async () => {
      const { getInstance, getSharesStore } = getWrapper({
        users: [createUser({ id: 'alice-id', displayName: 'Alice' })],
        allowedRoles: [mock<ShareRole>({ id: 'role-viewer' })]
      })

      await getInstance().resolveMentionCandidates('ali')
      getInstance().queueMention('alice-id')

      expect(getSharesStore().addShare).not.toHaveBeenCalled()
    })

    it('queues a mention only once per user', async () => {
      const { getInstance, getSharesStore, mocks } = getWrapper()
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      const instance = getInstance()

      instance.queueMention('alice-id')
      instance.queueMention('alice-id')
      await instance.notifyMentionedUsers()

      expect(getSharesStore().addShare).toHaveBeenCalledTimes(1)
    })
  })

  describe('access granting on notifyMentionedUsers', () => {
    it('grants the mentioned user access once the comment is finished', async () => {
      const { getInstance, getSharesStore, mocks } = getWrapper({
        users: [createUser({ id: 'alice-id', displayName: 'Alice' })],
        allowedRoles: [mock<ShareRole>({ id: 'role-viewer' })]
      })
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      const instance = getInstance()

      await instance.resolveMentionCandidates('ali')
      instance.queueMention('alice-id')

      expect(getSharesStore().addShare).not.toHaveBeenCalled()

      await instance.notifyMentionedUsers()

      expect(getSharesStore().addShare).toHaveBeenCalledWith(
        expect.objectContaining({
          space: expect.objectContaining({ id: 'space-1' }),
          resource: expect.objectContaining({ id: 'resource-1' }),
          options: {
            roles: ['role-viewer'],
            recipients: [{ objectId: 'alice-id', '@libre.graph.recipient.type': 'user' }]
          }
        })
      )
    })

    it('does not grant access when the user already has a direct share', async () => {
      const { getInstance, getSharesStore, mocks } = getWrapper({
        collaboratorShares: [
          createCollaboratorShare({ sharedWith: { id: 'alice-id', displayName: 'Alice' } })
        ]
      })
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      const instance = getInstance()

      instance.queueMention('alice-id')
      await instance.notifyMentionedUsers()

      expect(getSharesStore().addShare).not.toHaveBeenCalled()
    })

    it('does not grant access when the existing share is only indirect', async () => {
      const { getInstance, getSharesStore, mocks } = getWrapper({
        collaboratorShares: [
          createCollaboratorShare({
            indirect: true,
            sharedWith: { id: 'alice-id', displayName: 'Alice' }
          })
        ]
      })
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      const instance = getInstance()

      instance.queueMention('alice-id')
      await instance.notifyMentionedUsers()

      expect(getSharesStore().addShare).toHaveBeenCalled()
    })

    it('swallows addShare errors', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { getInstance, getSharesStore, mocks } = getWrapper()
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      vi.mocked(getSharesStore().addShare).mockRejectedValue(new Error('network error'))
      const instance = getInstance()

      instance.queueMention('alice-id')
      await expect(instance.notifyMentionedUsers()).resolves.toBeUndefined()
    })
  })

  describe('notifyMentionedUsers', () => {
    it('does nothing when no mentions were queued', async () => {
      const { getInstance, mocks } = getWrapper()
      await getInstance().notifyMentionedUsers()
      expect(mocks.$clientService.httpUnAuthenticated.request).not.toHaveBeenCalled()
    })

    it('posts the queued mentions once and clears the queue', async () => {
      const { getInstance, mocks } = getWrapper()
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({
        data: { accepted: ['alice-id', 'bob-id'], rejected: [] }
      } as any)
      const { queueMention, notifyMentionedUsers } = getInstance()

      queueMention('alice-id')
      queueMention('alice-id')
      queueMention('bob-id')
      await notifyMentionedUsers()

      expect(mocks.$clientService.httpUnAuthenticated.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/app/mentions'),
          data: {
            file_id: 'file-1',
            mentions: [
              { type: 'user', username: 'alice-id' },
              { type: 'user', username: 'bob-id' }
            ],
            event_id: expect.any(String),
            comment_text: '',
            anchor_text: '',
            document_url: 'https://example.test/f/resource-1',
            app_name: 'office'
          }
        })
      )

      vi.mocked(mocks.$clientService.httpUnAuthenticated.request).mockClear()
      await notifyMentionedUsers()
      expect(mocks.$clientService.httpUnAuthenticated.request).not.toHaveBeenCalled()
    })

    it('warns when the backend rejects some mentions', async () => {
      const { getInstance, mocks } = getWrapper()
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({
        data: { accepted: [], rejected: ['alice-id'] }
      } as any)
      const { queueMention, notifyMentionedUsers } = getInstance()

      queueMention('alice-id')
      await notifyMentionedUsers()

      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('rejected'), ['alice-id'])
    })

    it('swallows request errors', async () => {
      const { getInstance, mocks } = getWrapper()
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      mocks.$clientService.httpUnAuthenticated.request.mockRejectedValue(new Error('network error'))
      const { queueMention, notifyMentionedUsers } = getInstance()

      queueMention('alice-id')
      await notifyMentionedUsers()
    })

    it('shows a toast for each user access is granted to', async () => {
      const { getInstance, getMessagesStore, mocks } = getWrapper({
        users: [createUser({ id: 'alice-id', displayName: 'Alice' })],
        allowedRoles: [mock<ShareRole>({ id: 'role-viewer' })]
      })
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      const instance = getInstance()

      await instance.resolveMentionCandidates('ali')
      instance.queueMention('alice-id')
      await instance.notifyMentionedUsers()

      expect(getMessagesStore().showMessage).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Alice') })
      )
    })
  })

  describe('hasPendingMentions', () => {
    it('is false when nothing has been queued', () => {
      const { getInstance } = getWrapper()
      expect(getInstance().hasPendingMentions.value).toBe(false)
    })

    it('is true once a mention is queued', async () => {
      const { getInstance } = getWrapper()
      const instance = getInstance()

      await instance.queueMention('alice-id')

      expect(instance.hasPendingMentions.value).toBe(true)
    })

    it('is false again once notifyMentionedUsers flushes the queue', async () => {
      const { getInstance, mocks } = getWrapper()
      mocks.$clientService.httpUnAuthenticated.request.mockResolvedValue({} as any)
      const instance = getInstance()

      await instance.queueMention('alice-id')
      await instance.notifyMentionedUsers()

      expect(instance.hasPendingMentions.value).toBe(false)
    })
  })
})
