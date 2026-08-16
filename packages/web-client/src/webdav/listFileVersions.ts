import { WebDavOptions } from './types'
import { urlJoin } from '../utils'
import { DAV, DAVRequestOptions } from './client'
import { buildResource } from '../helpers'

export const ListFileVersionsFactory = (dav: DAV, options: WebDavOptions) => {
  return {
    async listFileVersions(id: string, opts: DAVRequestOptions = {}) {
      const webDavPath = urlJoin('meta', id, 'v', { leadingSlash: true })
      // the first entry is the folder itself, not a version
      const [, ...versions] = await dav.propfind(webDavPath, opts)
      return versions.map((v) => buildResource(v, dav.extraProps, webDavPath))
    }
  }
}
