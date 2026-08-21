import { computed, ref, unref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { useEuroOfficePostMessages } from '../../../../src/composables/postMessages/useEuroOfficePostMessages'
import { useShareDialog } from '../../../../src/composables/useShareDialog'
import { useMentionNotifications } from '../../../../src/composables/useMentionNotifications'
import { useOfficeFileOperations } from '../../../../src/composables/useOfficeFileOperations'
import { postMessageToIframe } from '../../../../src/composables/postMessages/postMessageToIframe'

vi.mock('../../../../src/composables/useShareDialog')
vi.mock('../../../../src/composables/useMentionNotifications')
vi.mock('../../../../src/composables/useOfficeFileOperations')
vi.mock('../../../../src/composables/postMessages/postMessageToIframe')

describe('useEuroOfficePostMessages', () => {
  const getContext = () => ({
    space: ref(mock<SpaceResource>()),
    resource: ref(mock<Resource>({ privateLink: 'https://cernbox.cern.ch/f/123' })),
    appIframeRef: ref(null)
  })

  const createMessageEvent = (messageId: string, values?: Record<string, unknown>) =>
    mock<MessageEvent>({
      data: JSON.stringify({ MessageId: messageId, ...(values && { Values: values }) })
    })

  const createMentionsMock = () => ({
    resolveMentionCandidates: vi.fn().mockResolvedValue([]),
    resolveMentionUsers: vi.fn().mockResolvedValue([]),
    resolveUserIdsForEmails: vi.fn().mockResolvedValue([]),
    queueMention: vi.fn(),
    notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
    resetMentionState: vi.fn(),
    hasPendingMentions: computed(() => false)
  })

  let openShareDialogMock: ReturnType<typeof vi.fn>
  let mentionsMock: ReturnType<typeof createMentionsMock>

  beforeEach(() => {
    openShareDialogMock = vi.fn()
    mentionsMock = createMentionsMock()
    vi.mocked(useShareDialog).mockReturnValue({ openShareDialog: openShareDialogMock })
    vi.mocked(useMentionNotifications).mockReturnValue(mentionsMock)
    vi.mocked(useOfficeFileOperations).mockReturnValue({
      saveAs: vi.fn().mockResolvedValue(undefined),
      insertGraphic: vi.fn().mockResolvedValue(undefined),
      insertFile: vi.fn().mockResolvedValue(undefined),
      insertLink: vi.fn().mockResolvedValue(undefined)
    })
  })

  it.each([
    'App_LoadingStatus',
    'UI_Close',
    'UI_Sharing',
    'UI_InsertGraphic',
    'UI_FileVersions',
    'UI_RequestUsers',
    'UI_SendNotify',
    'UI_MakeActionLink',
    'File_Rename',
    'Edit_Notification'
  ])('dispatches a %s message without throwing', async (messageId) => {
    const { handlePostMessage } = useEuroOfficePostMessages(getContext())
    await handlePostMessage(createMessageEvent(messageId))
  })

  it('ignores unknown message ids', async () => {
    const { handlePostMessage } = useEuroOfficePostMessages(getContext())
    await handlePostMessage(createMessageEvent('Some_Unknown_Message'))
  })

  it('swallows malformed message data', async () => {
    const { handlePostMessage } = useEuroOfficePostMessages(getContext())
    await handlePostMessage(mock<MessageEvent>({ data: 'not-json' }))
  })

  it('replies with Host_PostmessageReady and marks the app as loaded on App_LoadingStatus', async () => {
    const ctx = getContext()
    const { handlePostMessage, isLoaded } = useEuroOfficePostMessages(ctx)

    expect(unref(isLoaded)).toBe(false)
    await handlePostMessage(createMessageEvent('App_LoadingStatus'))

    expect(unref(isLoaded)).toBe(true)
    expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Host_PostmessageReady')
  })

  it('opens the share dialog on UI_Sharing', async () => {
    const ctx = getContext()
    const { handlePostMessage } = useEuroOfficePostMessages(ctx)

    await handlePostMessage(createMessageEvent('UI_Sharing'))

    expect(openShareDialogMock).toHaveBeenCalledWith(ctx.space.value, ctx.resource.value)
  })

  describe('UI_RequestUsers', () => {
    it('answers a mention search with the resolved users, echoing c and paginating', async () => {
      const ctx = getContext()
      const users = [
        { id: '1', name: 'Alice', email: 'alice@cern.ch', hasAccess: true },
        { id: '2', name: 'Bob', email: 'bob@cern.ch', hasAccess: false }
      ]
      mentionsMock.resolveMentionUsers.mockResolvedValue(users)
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(
        createMessageEvent('UI_RequestUsers', { c: 'mention', from: 0, count: 100, search: 'al' })
      )

      expect(mentionsMock.resolveMentionUsers).toHaveBeenCalledWith('al')
      expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Action_SetUsers', {
        c: 'mention',
        users,
        isPaginated: true
      })
    })

    it('returns the page the editor asked for', async () => {
      const ctx = getContext()
      mentionsMock.resolveMentionUsers.mockResolvedValue([
        { id: '1', name: 'Alice', email: 'alice@cern.ch', hasAccess: false },
        { id: '2', name: 'Bob', email: 'bob@cern.ch', hasAccess: false }
      ])
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(
        createMessageEvent('UI_RequestUsers', { c: 'mention', from: 1, count: 1, search: 'b' })
      )

      expect(postMessageToIframe).toHaveBeenCalledWith(
        ctx.appIframeRef,
        'Action_SetUsers',
        expect.objectContaining({
          users: [{ id: '2', name: 'Bob', email: 'bob@cern.ch', hasAccess: false }]
        })
      )
    })

    // the editor drops any request made while one is still in flight, so an unanswered
    // request it holds the lock for wedges the mention dropdown for good
    it('still answers a search it cannot serve, so the editor is not left waiting', async () => {
      const ctx = getContext()
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(createMessageEvent('UI_RequestUsers', { c: 'protect' }))

      expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Action_SetUsers', {
        c: 'protect',
        users: [],
        isPaginated: true
      })
    })

    // avatars aren't a thing in CERNBox, and 'info' takes no in-flight lock, so ignoring it
    // is safe - the editor falls back to the author names stored in the document
    it('ignores author-info lookups', async () => {
      const ctx = getContext()
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(createMessageEvent('UI_RequestUsers', { c: 'info', id: ['1', '2'] }))

      expect(postMessageToIframe).not.toHaveBeenCalled()
      expect(mentionsMock.resolveMentionUsers).not.toHaveBeenCalled()
    })
  })

  describe('UI_MakeActionLink', () => {
    it('answers with the document link carrying the anchor', async () => {
      const ctx = getContext()
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(
        createMessageEvent('UI_MakeActionLink', {
          config: { action: { type: 'comment', data: '1_1' } }
        })
      )

      expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Action_SetActionLink', {
        url: 'https://cernbox.cern.ch/f/123?actionLink=%7B%22action%22%3A%7B%22type%22%3A%22comment%22%2C%22data%22%3A%221_1%22%7D%7D'
      })
    })

    // the editor's link button blocks until it gets a reply
    it('still answers when the anchor cannot be attached', async () => {
      const ctx = getContext()
      ctx.resource.value.privateLink = 'not-a-url'
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(createMessageEvent('UI_MakeActionLink', { config: {} }))

      expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Action_SetActionLink', {
        url: 'not-a-url'
      })
    })
  })

  describe('UI_SendNotify', () => {
    it('resolves the mentioned emails and flushes the notification', async () => {
      const ctx = getContext()
      mentionsMock.resolveUserIdsForEmails.mockResolvedValue(['1', '2'])
      const { handlePostMessage } = useEuroOfficePostMessages(ctx)

      await handlePostMessage(
        createMessageEvent('UI_SendNotify', {
          emails: ['alice@cern.ch', 'bob@cern.ch'],
          message: 'have a look +alice@cern.ch',
          actionLink: { action: { type: 'comment', data: '1_1' } }
        })
      )

      expect(mentionsMock.resolveUserIdsForEmails).toHaveBeenCalledWith([
        'alice@cern.ch',
        'bob@cern.ch'
      ])
      expect(mentionsMock.queueMention).toHaveBeenCalledWith('1')
      expect(mentionsMock.queueMention).toHaveBeenCalledWith('2')
      expect(mentionsMock.notifyMentionedUsers).toHaveBeenCalledWith({
        commentText: 'have a look +alice@cern.ch',
        documentUrl:
          'https://cernbox.cern.ch/f/123?actionLink=%7B%22action%22%3A%7B%22type%22%3A%22comment%22%2C%22data%22%3A%221_1%22%7D%7D'
      })
    })

    it('does nothing when no emails were mentioned', async () => {
      const { handlePostMessage } = useEuroOfficePostMessages(getContext())

      await handlePostMessage(createMessageEvent('UI_SendNotify', { emails: [] }))

      expect(mentionsMock.notifyMentionedUsers).not.toHaveBeenCalled()
    })
  })
})
