import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { useEmbedModeDownloadUrl } from '../../../../src/composables/embedMode/useEmbedModeDownloadUrl'

describe('useEmbedModeDownloadUrl', () => {
  const getWrapper = ({ supportUrlSigning = true }: { supportUrlSigning?: boolean } = {}) => {
    const mocks = defaultComponentMocks()

    let instance: ReturnType<typeof useEmbedModeDownloadUrl>
    getComposableWrapper(
      () => {
        instance = useEmbedModeDownloadUrl()
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: {
          piniaOptions: {
            capabilityState: {
              capabilities: { core: { 'support-url-signing': supportUrlSigning } }
            }
          }
        }
      }
    )
    return { mocks, getInstance: () => instance }
  }

  it('leaves the resource untouched when downloadURL is already present', async () => {
    const { mocks, getInstance } = getWrapper()
    const resource = mock<Resource>({
      downloadURL: 'https://example.test/existing',
      isFolder: false
    })

    const result = await getInstance().withDownloadUrl(mock<SpaceResource>(), resource)

    expect(result).toBe(resource)
    expect(mocks.$clientService.webdav.getFileUrl).not.toHaveBeenCalled()
  })

  it('does not sign folders', async () => {
    const { mocks, getInstance } = getWrapper()
    const resource = mock<Resource>({ downloadURL: undefined, isFolder: true })

    const result = await getInstance().withDownloadUrl(mock<SpaceResource>(), resource)

    expect(result).toBe(resource)
    expect(mocks.$clientService.webdav.getFileUrl).not.toHaveBeenCalled()
  })

  it('does not sign when the server does not support url signing', async () => {
    const { mocks, getInstance } = getWrapper({ supportUrlSigning: false })
    const resource = mock<Resource>({ downloadURL: undefined, isFolder: false })

    const result = await getInstance().withDownloadUrl(mock<SpaceResource>(), resource)

    expect(result).toBe(resource)
    expect(mocks.$clientService.webdav.getFileUrl).not.toHaveBeenCalled()
  })

  it('does not sign when no space is given', async () => {
    const { mocks, getInstance } = getWrapper()
    const resource = mock<Resource>({ downloadURL: undefined, isFolder: false })

    const result = await getInstance().withDownloadUrl(undefined, resource)

    expect(result).toBe(resource)
    expect(mocks.$clientService.webdav.getFileUrl).not.toHaveBeenCalled()
  })

  it('signs and sets downloadURL when missing and url signing is supported', async () => {
    const { mocks, getInstance } = getWrapper({ supportUrlSigning: true })
    const space = mock<SpaceResource>()
    const resource = mock<Resource>({ downloadURL: undefined, isFolder: false })
    mocks.$clientService.webdav.getFileUrl.mockResolvedValue('https://example.test/signed')

    const result = await getInstance().withDownloadUrl(space, resource)

    expect(mocks.$clientService.webdav.getFileUrl).toHaveBeenCalledWith(
      space,
      resource,
      expect.objectContaining({ isUrlSigningEnabled: true })
    )
    expect(result).toBe(resource)
    expect(result.downloadURL).toBe('https://example.test/signed')
  })

  it('leaves downloadURL unset when signing fails', async () => {
    const { mocks, getInstance } = getWrapper({ supportUrlSigning: true })
    const resource = mock<Resource>({ downloadURL: undefined, isFolder: false })
    mocks.$clientService.webdav.getFileUrl.mockRejectedValue(new Error('signing failed'))

    const result = await getInstance().withDownloadUrl(mock<SpaceResource>(), resource)

    expect(result).toBe(resource)
    expect(result.downloadURL).toBeUndefined()
  })
})
