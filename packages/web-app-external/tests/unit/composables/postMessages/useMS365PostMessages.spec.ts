import { ref, unref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { useMS365PostMessages } from '../../../../src/composables/postMessages/useMS365PostMessages'
import { useShareDialog } from '../../../../src/composables/useShareDialog'
import { postMessageToIframe } from '../../../../src/composables/postMessages/postMessageToIframe'

vi.mock('../../../../src/composables/useShareDialog')
vi.mock('../../../../src/composables/postMessages/postMessageToIframe')

describe('useMS365PostMessages', () => {
  const getContext = (overrides: Partial<{ switchToWriteMode: () => void }> = {}) => ({
    space: ref(mock<SpaceResource>()),
    resource: ref(mock<Resource>()),
    appIframeRef: ref(null),
    switchToWriteMode: vi.fn(),
    ...overrides
  })

  const createMessageEvent = (messageId: string, values?: Record<string, unknown>) =>
    mock<MessageEvent>({
      data: JSON.stringify({ MessageId: messageId, ...(values && { Values: values }) })
    })

  let openShareDialogMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    openShareDialogMock = vi.fn()
    vi.mocked(useShareDialog).mockReturnValue({ openShareDialog: openShareDialogMock } as any)
  })

  it.each([
    'App_LoadingStatus',
    'UI_Edit',
    'UI_Sharing',
    'UI_Close',
    'UI_FileVersions',
    'File_Rename',
    'Edit_Notification'
  ])('dispatches a %s message without throwing', (messageId) => {
    const { handlePostMessage } = useMS365PostMessages(getContext())
    handlePostMessage(createMessageEvent(messageId))
  })

  it('ignores unknown message ids', () => {
    const { handlePostMessage } = useMS365PostMessages(getContext())
    handlePostMessage(createMessageEvent('Some_Unknown_Message'))
  })

  it('swallows malformed message data', () => {
    const { handlePostMessage } = useMS365PostMessages(getContext())
    handlePostMessage(mock<MessageEvent>({ data: 'not-json' }))
  })

  it('replies with Host_PostmessageReady and marks the app as loaded on App_LoadingStatus', () => {
    const ctx = getContext()
    const { handlePostMessage, isLoaded } = useMS365PostMessages(ctx)

    expect(unref(isLoaded)).toBe(false)
    handlePostMessage(createMessageEvent('App_LoadingStatus'))

    expect(unref(isLoaded)).toBe(true)
    expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Host_PostmessageReady')
  })

  it('switches to write mode on UI_Edit', () => {
    const switchToWriteMode = vi.fn()
    const ctx = getContext({ switchToWriteMode })
    const { handlePostMessage } = useMS365PostMessages(ctx)

    handlePostMessage(createMessageEvent('UI_Edit'))

    expect(switchToWriteMode).toHaveBeenCalled()
  })

  it('opens the share dialog on UI_Sharing', () => {
    const ctx = getContext()
    const { handlePostMessage } = useMS365PostMessages(ctx)

    handlePostMessage(createMessageEvent('UI_Sharing'))

    expect(openShareDialogMock).toHaveBeenCalledWith(ctx.space.value, ctx.resource.value)
  })
})
