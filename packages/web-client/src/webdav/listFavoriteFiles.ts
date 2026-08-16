import { urlJoin } from '../utils'
import { WebDavOptions } from './types'
import { DAV, DAVRequestOptions } from './client'
import { DavProperties, DavPropertyValue } from './constants'

export const ListFavoriteFilesFactory = (dav: DAV, options: WebDavOptions) => {
  return {
    listFavoriteFiles({
      davProperties = DavProperties.Default,
      spaceID = '',
      ...opts
    }: { davProperties?: DavPropertyValue[]; spaceID?: string } & DAVRequestOptions = {}) {
      return dav.report(urlJoin('spaces', spaceID), {
        properties: davProperties,
        filterRules: { favorite: 1 },
        ...opts
      })
    }
  }
}
