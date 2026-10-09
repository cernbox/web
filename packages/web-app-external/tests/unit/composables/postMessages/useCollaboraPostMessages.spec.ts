import { computed, ref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { RouteLocation } from 'vue-router'
import { useCollaboraPostMessages } from '../../../../src/composables/postMessages/useCollaboraPostMessages'
import { useMentionNotifications } from '../../../../src/composables/useMentionNotifications'
import { useOfficeFileOperations } from '../../../../src/composables/useOfficeFileOperations'
import { postMessageToIframe } from '../../../../src/composables/postMessages/postMessageToIframe'

vi.mock('../../../../src/composables/useMentionNotifications')
vi.mock('../../../../src/composables/useOfficeFileOperations')
vi.mock('../../../../src/composables/postMessages/postMessageToIframe')

describe('useCollaboraPostMessages', () => {
  const getContext = () => ({
    space: ref(mock<SpaceResource>()),
    resource: ref(
      mock<Resource>({ name: 'document.odt', path: '/folder/document.odt', fileId: 'old-id' })
    ),
    appIframeRef: ref(null)
  })

  const createMessageEvent = (messageId: string, values?: Record<string, unknown>) =>
    mock<MessageEvent>({
      data: JSON.stringify({ MessageId: messageId, ...(values && { Values: values }) })
    })

  const createMentionsMock = () => ({
    resolveMentionCandidates: vi.fn().mockResolvedValue([]),
    // EuroOffice-only, but mockReturnValue needs the whole composable's shape
    resolveMentionUsers: vi.fn().mockResolvedValue([]),
    resolveUserIdsForEmails: vi.fn().mockResolvedValue([]),
    queueMention: vi.fn(),
    notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
    resetMentionState: vi.fn(),
    hasPendingMentions: computed(() => false)
  })

  const createFileOpsMock = () => ({
    saveAs: vi.fn().mockResolvedValue(undefined),
    insertGraphic: vi.fn().mockResolvedValue(undefined),
    insertFile: vi.fn().mockResolvedValue(undefined),
    insertLink: vi.fn().mockResolvedValue(undefined)
  })

  let mentionsMock: ReturnType<typeof createMentionsMock>
  let fileOpsMock: ReturnType<typeof createFileOpsMock>

  beforeEach(() => {
    mentionsMock = createMentionsMock()
    fileOpsMock = createFileOpsMock()
    vi.mocked(useMentionNotifications).mockReturnValue(mentionsMock)
    vi.mocked(useOfficeFileOperations).mockReturnValue(fileOpsMock)
  })

  const getWrapper = (ctx = getContext()) => {
    const mocks = defaultComponentMocks({
      currentRoute: mock<RouteLocation>({
        name: 'external-collabora-apps',
        params: { driveAliasAndItem: 'personal/admin/document.odt' },
        query: {}
      })
    })

    let instance: ReturnType<typeof useCollaboraPostMessages>
    getComposableWrapper(
      () => {
        instance = useCollaboraPostMessages(ctx)
      },
      { mocks, provide: mocks }
    )
    return { ctx, mocks, getInstance: () => instance }
  }

  it.each([
    'App_LoadingStatus',
    'Doc_ModifiedStatus',
    'UI_Close',
    'UI_SaveAs',
    'Action_Save_Resp',
    'UI_InsertGraphic',
    'UI_InsertFile',
    'UI_Mention',
    'UI_PickLink'
  ])('dispatches a %s message without throwing', async (messageId) => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent(messageId))
  })

  it('ignores unknown message ids', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent('Some_Unknown_Message'))
  })

  it('swallows malformed message data', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(mock<MessageEvent>({ data: 'not-json' }))
  })

  it('flushes mentions when Doc_ModifiedStatus reports the doc was saved', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(
      createMessageEvent('Doc_ModifiedStatus', { Modified: false })
    )
    expect(mentionsMock.notifyMentionedUsers).toHaveBeenCalled()
  })

  it('does not flush mentions while the doc is still modified', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(
      createMessageEvent('Doc_ModifiedStatus', { Modified: true })
    )
    expect(mentionsMock.notifyMentionedUsers).not.toHaveBeenCalled()
  })

  it('flushes mentions on UI_Close', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent('UI_Close'))
    expect(mentionsMock.notifyMentionedUsers).toHaveBeenCalled()
  })

  it('delegates UI_SaveAs to saveAs and replies with Action_SaveAs on confirm', async () => {
    fileOpsMock.saveAs.mockImplementation(async ({ onConfirm }) => onConfirm('new-name.odt'))
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent('UI_SaveAs', { format: 'odt' }))

    expect(fileOpsMock.saveAs).toHaveBeenCalledWith(
      expect.objectContaining({ fileExtension: 'odt' })
    )
    expect(postMessageToIframe).toHaveBeenCalledWith(expect.anything(), 'Action_SaveAs', {
      Filename: 'new-name.odt',
      Notify: true
    })
  })

  it('delegates UI_InsertGraphic to insertGraphic and replies with Action_InsertGraphic', async () => {
    fileOpsMock.insertGraphic.mockImplementation(async ({ onPicked }) =>
      onPicked('https://example.test/image.png')
    )
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent('UI_InsertGraphic'))

    expect(postMessageToIframe).toHaveBeenCalledWith(expect.anything(), 'Action_InsertGraphic', {
      url: 'https://example.test/image.png'
    })
  })

  it('delegates UI_InsertFile to insertFile and replies with the requested callback message', async () => {
    fileOpsMock.insertFile.mockImplementation(async ({ onPicked }) =>
      onPicked('https://example.test/doc.docx', 'doc.docx')
    )
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(
      createMessageEvent('UI_InsertFile', {
        callback: 'Action_CompareDocuments',
        mimeTypeFilter: ['docx']
      })
    )

    expect(fileOpsMock.insertFile).toHaveBeenCalledWith(
      expect.objectContaining({ mimeTypeFilter: ['docx'] })
    )
    expect(postMessageToIframe).toHaveBeenCalledWith(expect.anything(), 'Action_CompareDocuments', {
      url: 'https://example.test/doc.docx',
      filename: 'doc.docx'
    })
  })

  it('ignores UI_InsertFile without a callback name', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent('UI_InsertFile', {}))
    expect(fileOpsMock.insertFile).not.toHaveBeenCalled()
  })

  it('resolves mention autocomplete candidates and replies with Action_Mention', async () => {
    mentionsMock.resolveMentionCandidates.mockResolvedValue([
      { username: 'alice', profile: 'https://example.test/f/1', label: 'Alice' }
    ])
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(
      createMessageEvent('UI_Mention', { type: 'autocomplete', text: 'ali' })
    )

    expect(mentionsMock.resolveMentionCandidates).toHaveBeenCalledWith('ali')
    expect(postMessageToIframe).toHaveBeenCalledWith(expect.anything(), 'Action_Mention', {
      list: [{ username: 'alice', profile: 'https://example.test/f/1', label: 'Alice' }]
    })
  })

  it('queues a selected mention', async () => {
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(
      createMessageEvent('UI_Mention', { type: 'selected', username: 'alice' })
    )
    expect(mentionsMock.queueMention).toHaveBeenCalledWith('alice')
  })

  it('delegates UI_PickLink to insertLink and replies with Action_InsertLink', async () => {
    fileOpsMock.insertLink.mockImplementation(async ({ onPicked }) =>
      onPicked('https://example.test/f/2', 'file.txt')
    )
    const { getInstance } = getWrapper()
    await getInstance().handlePostMessage(createMessageEvent('UI_PickLink'))

    expect(postMessageToIframe).toHaveBeenCalledWith(expect.anything(), 'Action_InsertLink', {
      url: 'https://example.test/f/2',
      text: 'file.txt'
    })
  })

  it('resets mention state when the resource changes', () => {
    const { getInstance } = getWrapper()
    getInstance().onResourceChanged()
    expect(mentionsMock.resetMentionState).toHaveBeenCalled()
  })

  it("exposes useMentionNotifications' hasPendingMentions as-is", () => {
    const { getInstance } = getWrapper()
    expect(getInstance().hasPendingMentions).toBe(mentionsMock.hasPendingMentions)
  })

  describe('Action_Save_Resp', () => {
    it('does nothing without a fileName in the response', async () => {
      const { getInstance, mocks } = getWrapper()
      await getInstance().handlePostMessage(createMessageEvent('Action_Save_Resp', {}))
      expect(mocks.$clientService.webdav.getFileInfo).not.toHaveBeenCalled()
      expect(mocks.$router.push).not.toHaveBeenCalled()
    })

    it('navigates to the renamed file once Collabora confirms the save', async () => {
      const { getInstance, mocks } = getWrapper()
      mocks.$clientService.webdav.getFileInfo.mockResolvedValue(
        mock<Resource>({ name: 'renamed.odt', fileId: 'new-id' })
      )

      await getInstance().handlePostMessage(
        createMessageEvent('Action_Save_Resp', { fileName: 'renamed.odt' })
      )

      expect(mocks.$clientService.webdav.getFileInfo).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ path: '/folder/renamed.odt' })
      )
      expect(mocks.$router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            driveAliasAndItem: 'personal/admin/renamed.odt'
          }),
          query: expect.objectContaining({ fileId: 'new-id' })
        })
      )
    })
  })
})
