import { SpaceResource } from '../helpers'
import { WebDavOptions } from './types'
import { urlJoin } from '../utils'
import { DAV, DAVRequestOptions } from './client'
import { getWebDavPath } from './utils'

export const RestoreFileVersionFactory = (dav: DAV, options: WebDavOptions) => {
  return {
    restoreFileVersion(
      space: SpaceResource,
      { id, name, path }: { id?: string; name?: string; path?: string },
      versionId: string,
      opts: DAVRequestOptions = {}
    ) {
      // FIXME: using the actual resource is a workaround to avoid using the parentFolderId
      // TBD best way to handle this
      const webDavPath = getWebDavPath(space, { path, fileId: id, name })
      const source = urlJoin('meta', id, 'v', versionId, { leadingSlash: true })
      const target = urlJoin('files', webDavPath, { leadingSlash: true })
      return dav.copy(source, target, opts)
    }
  }
}
