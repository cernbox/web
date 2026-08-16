import { computed } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, ShareResource, SpaceResource } from '@ownclouders/web-client'
import { FileAction, useCanShare, useFileActionsShowShares } from '@ownclouders/web-pkg'
import { useShareDialog } from '../../../src/composables/useShareDialog'

vi.mock('@ownclouders/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useCanShare: vi.fn(),
  useFileActionsShowShares: vi.fn()
}))

describe('useShareDialog', () => {
  let shareHandler: ReturnType<typeof vi.fn>
  let canShareMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    shareHandler = vi.fn()
    canShareMock = vi.fn().mockReturnValue(true)
    vi.mocked(useCanShare).mockReturnValue({ canShare: canShareMock } as any)
    vi.mocked(useFileActionsShowShares).mockReturnValue({
      actions: computed(() => [mock<FileAction<ShareResource>>({ handler: shareHandler as any })])
    } as any)
  })

  it('opens the share dialog when the resource is shareable', () => {
    const space = mock<SpaceResource>()
    const resource = mock<Resource>()
    const { openShareDialog } = useShareDialog()

    openShareDialog(space, resource)

    expect(canShareMock).toHaveBeenCalledWith({ space, resource })
    expect(shareHandler).toHaveBeenCalledWith({ space, resources: [resource] })
  })

  it('does not open the share dialog when the resource is not shareable', () => {
    canShareMock.mockReturnValue(false)
    const { openShareDialog } = useShareDialog()

    openShareDialog(mock<SpaceResource>(), mock<Resource>())

    expect(shareHandler).not.toHaveBeenCalled()
  })
})
