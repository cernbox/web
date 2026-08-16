import { mock, mockDeep } from 'vitest-mock-extended'
import {
  Ability,
  Resource,
  WebDavResponseResource,
  buildResource,
  extractDomSelector,
  extractExtensionFromFile,
  extractNameWithoutExtension
} from '../../../../src/helpers'
import { DavPermission, DavProperty } from '../../../../src/webdav/constants'
import { HIDDEN_FILE_EXTENSIONS } from '@ownclouders/web-client'

describe('extractDomSelector', () => {
  it.each([
    { input: '', expected: '' },
    { input: '1', expected: '1' },
    { input: 'a', expected: 'a' },
    { input: '!=?', expected: '' },
    { input: '-_', expected: '-_' },
    { input: '1a!=?-_', expected: '1a-_' },
    {
      input: 'f2dc18fa-ca05-11ec-8c55-0f9df469d22f',
      expected: 'f2dc18fa-ca05-11ec-8c55-0f9df469d22f'
    }
  ])(
    'creates a string that does not break when being used as query selector',
    ({ input, expected }) => {
      expect(extractDomSelector(input)).toBe(expected)
    }
  )
})

const resourceWithoutExtension = {
  name: 'file'
}
const resourceNameWithExtension = {
  name: 'file.txt',
  extension: 'txt'
}
const resourceNameWithExtensionAndDots = {
  name: 'file.dot.txt',
  extension: 'txt'
}

describe('filterResources', () => {
  describe('extractNameWithoutExtension', () => {
    it('should return resource name when there is no extension', () => {
      expect(extractNameWithoutExtension(resourceWithoutExtension as Resource)).toEqual(
        resourceWithoutExtension.name
      )
    })
    it('should return resource name without extension when there is an extension', () => {
      expect(extractNameWithoutExtension(resourceNameWithExtension as Resource)).toEqual('file')
    })
    it('should return resource name with dots without extension when there is an extension', () => {
      expect(extractNameWithoutExtension(resourceNameWithExtensionAndDots as Resource)).toEqual(
        'file.dot'
      )
    })
  })
  describe('extractExtensionFromFile', () => {
    it('should return simple file extension', () => {
      expect(extractExtensionFromFile({ name: 'test.png' } as Resource)).toEqual('png')
    })
    it('should return complex file extension', () => {
      expect(extractExtensionFromFile({ name: 'test.tar.gz' } as Resource)).toEqual('tar.gz')
    })
    it('should return unknown file extension', () => {
      expect(extractExtensionFromFile({ name: 'test.unknown' } as Resource)).toEqual('unknown')
    })
    it('should return no file extension', () => {
      expect(extractExtensionFromFile({ name: 'test' } as Resource)).toEqual('')
    })
    it.each([
      { name: 'afolder', isFolder: true },
      { name: 'afolder', type: 'dir' },
      { name: 'afolder', type: 'folder' }
    ])('should return empty string if folder', (resource) => {
      expect(extractExtensionFromFile(resource as Resource)).toEqual('')
    })
  })
})

const buildMockWebDavResponse = (
  props: Record<string, unknown>,
  basename = 'file.txt'
): WebDavResponseResource =>
  mockDeep<WebDavResponseResource>({
    filename: `/files/user/${basename}`,
    basename,
    props
  })

describe('buildResource', () => {
  describe('canShare', () => {
    it('is true when ability and share permissions are given', () => {
      const webDavResponse = buildMockWebDavResponse({
        [DavProperty.Permissions]: DavPermission.Shareable,
        [DavProperty.Tags]: undefined
      })
      const resource = buildResource(webDavResponse)
      const ability = mock<Ability>()
      ability.can.mockReturnValue(true)
      expect(resource.canShare({ ability })).toBeTruthy()
      expect(ability.can).toHaveBeenCalledWith('create-all', 'Share')
    })
    it('is false when ability is not given', () => {
      const webDavResponse = buildMockWebDavResponse({
        [DavProperty.Permissions]: DavPermission.Shareable,
        [DavProperty.Tags]: undefined
      })
      const resource = buildResource(webDavResponse)
      const ability = mock<Ability>()
      ability.can.mockReturnValue(false)
      expect(resource.canShare({ ability })).toBeFalsy()
      expect(ability.can).toHaveBeenCalledWith('create-all', 'Share')
    })
    it('is false when share permissions are not given', () => {
      const webDavResponse = buildMockWebDavResponse({
        [DavProperty.Permissions]: '',
        [DavProperty.Tags]: undefined
      })
      const resource = buildResource(webDavResponse)
      const ability = mock<Ability>()
      ability.can.mockReturnValue(true)
      expect(resource.canShare({ ability })).toBeFalsy()
      expect(ability.can).toHaveBeenCalledWith('create-all', 'Share')
    })
  })

  it.each(HIDDEN_FILE_EXTENSIONS)(
    'should disable all permission excluding canBeDeleted when extension is %s',
    (extension) => {
      const webDavResponse = buildMockWebDavResponse(
        {
          [DavProperty.Permissions]:
            DavPermission.Shareable +
            DavPermission.Renameable +
            DavPermission.Updateable +
            DavPermission.FileUpdateable +
            DavPermission.Deletable,
          [DavProperty.Tags]: undefined
        },
        `forest.${extension}`
      )
      const resource = buildResource(webDavResponse)
      const ability = mock<Ability>()
      ability.can.mockReturnValue(true)

      expect(resource.canShare({ ability })).toBeFalsy()
      expect(resource.canDownload()).toBeFalsy()
      expect(resource.canBeDeleted()).toBeTruthy()
      expect(resource.canRename()).toBeFalsy()
      expect(resource.canEditTags()).toBeFalsy()
    }
  )

  it('handles extraProps', () => {
    const webDavResponse = mockDeep<WebDavResponseResource>({
      basename: 'file.txt',
      filename: '/files/admin/file.txt',
      props: {
        'first-custom-prop': '1',

        // WebDAV library removes the namespace in responses
        'second-custom-prop': '2',

        // make this explicit because of mockDeep
        'non-existing-prop': undefined
      }
    })
    const resource = buildResource(webDavResponse, [
      'first-custom-prop',
      'x:second-custom-prop',
      'non-existing-prop'
    ])

    expect(resource.extraProps['first-custom-prop']).toBe('1')
    expect(resource.extraProps['x:second-custom-prop']).toBe('2')
    expect(resource.extraProps['non-existing-prop']).toBeUndefined()
  })
  describe('path', () => {
    it('resolves to "/" when the filename is an exact match of webDavBasePath', () => {
      const webDavResponse = mockDeep<WebDavResponseResource>({
        filename: '/spaces/abc',
        basename: 'abc',
        props: {}
      })
      const resource = buildResource(webDavResponse, [], '/spaces/abc')
      expect(resource.path).toBe('/')
    })

    it('strips webDavBasePath as a prefix when the filename is nested underneath it', () => {
      const webDavResponse = mockDeep<WebDavResponseResource>({
        filename: '/spaces/abc/sub/dir/file.txt',
        basename: 'file.txt',
        props: {}
      })
      const resource = buildResource(webDavResponse, [], '/spaces/abc')
      expect(resource.path).toBe('/sub/dir/file.txt')
    })

    it('falls back to the legacy heuristic when webDavBasePath only shares a string prefix, not a real path segment', () => {
      const webDavResponse = mockDeep<WebDavResponseResource>({
        filename: '/spaces/abcdef/foo',
        basename: 'foo',
        props: {}
      })
      const resource = buildResource(webDavResponse, [], '/spaces/abc')
      // '/spaces/abc' doesn't actually match '/spaces/abcdef/foo' (different space id), so this
      // falls through to the legacy heuristic rather than being falsely treated as a prefix match
      expect(resource.path).toBe('/foo')
    })

    it('falls back to the legacy /files-or/space heuristic when no webDavBasePath is given', () => {
      const webDavResponse = buildMockWebDavResponse({})
      const resource = buildResource(webDavResponse)
      expect(resource.path).toBe('/file.txt')
    })
  })

  describe('isShareRoot', () => {
    it('is false when the ShareRoot prop is absent', () => {
      const webDavResponse = mockDeep<WebDavResponseResource>({
        filename: '/spaces/abc',
        basename: 'abc',
        props: { [DavProperty.ShareRoot]: undefined }
      })
      const resource = buildResource(webDavResponse, [], '/spaces/abc')
      expect(resource.isShareRoot()).toBeFalsy()
    })

    it('is true when the ShareRoot prop is present and the resource is the root', () => {
      const webDavResponse = mockDeep<WebDavResponseResource>({
        filename: '/spaces/abc',
        basename: 'abc',
        props: { [DavProperty.ShareRoot]: '/some/remote/path' }
      })
      const resource = buildResource(webDavResponse, [], '/spaces/abc')
      expect(resource.isShareRoot()).toBeTruthy()
    })

    it('is false when the ShareRoot prop is present but the resource is a descendant of the root', () => {
      const webDavResponse = mockDeep<WebDavResponseResource>({
        filename: '/spaces/abc/sub',
        basename: 'sub',
        props: { [DavProperty.ShareRoot]: '/some/remote/path' }
      })
      const resource = buildResource(webDavResponse, [], '/spaces/abc')
      expect(resource.isShareRoot()).toBeFalsy()
    })
  })
})
