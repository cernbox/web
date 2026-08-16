import { ref, unref } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { useEuroOfficePostMessages } from '../../../../src/composables/postMessages/useEuroOfficePostMessages'
import { useShareDialog } from '../../../../src/composables/useShareDialog'
import { postMessageToIframe } from '../../../../src/composables/postMessages/postMessageToIframe'

vi.mock('../../../../src/composables/useShareDialog')
vi.mock('../../../../src/composables/postMessages/postMessageToIframe')
// pulls in useGettext, which cannot resolve outside a component context; it has its own spec
vi.mock('../../../../src/composables/useOfficeFileOperations', () => ({
  useOfficeFileOperations: vi.fn(() => ({
    insertGraphic: vi.fn(),
    insertFile: vi.fn(),
    saveAs: vi.fn()
  }))
}))

describe('useEuroOfficePostMessages', () => {
  const getContext = () => ({
    space: ref(mock<SpaceResource>()),
    resource: ref(mock<Resource>()),
    appIframeRef: ref(null)
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
    'UI_Close',
    'UI_Sharing',
    'UI_FileVersions',
    'File_Rename',
    'Edit_Notification'
  ])('dispatches a %s message without throwing', (messageId) => {
    const { handlePostMessage } = useEuroOfficePostMessages(getContext())
    handlePostMessage(createMessageEvent(messageId))
  })

  it('ignores unknown message ids', () => {
    const { handlePostMessage } = useEuroOfficePostMessages(getContext())
    handlePostMessage(createMessageEvent('Some_Unknown_Message'))
  })

  it('swallows malformed message data', () => {
    const { handlePostMessage } = useEuroOfficePostMessages(getContext())
    handlePostMessage(mock<MessageEvent>({ data: 'not-json' }))
  })

  it('replies with Host_PostmessageReady and marks the app as loaded on App_LoadingStatus', () => {
    const ctx = getContext()
    const { handlePostMessage, isLoaded } = useEuroOfficePostMessages(ctx)

    expect(unref(isLoaded)).toBe(false)
    handlePostMessage(createMessageEvent('App_LoadingStatus'))

    expect(unref(isLoaded)).toBe(true)
    expect(postMessageToIframe).toHaveBeenCalledWith(ctx.appIframeRef, 'Host_PostmessageReady')
  })

  it('opens the share dialog on UI_Sharing', () => {
    const ctx = getContext()
    const { handlePostMessage } = useEuroOfficePostMessages(ctx)

    handlePostMessage(createMessageEvent('UI_Sharing'))

    expect(openShareDialogMock).toHaveBeenCalledWith(ctx.space.value, ctx.resource.value)
  })
})
