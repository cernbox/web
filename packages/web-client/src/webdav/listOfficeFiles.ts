import { urlJoin } from '../utils'
import { WebDavOptions } from './types'
import { DAV, DAVRequestOptions } from './client'
import { DavProperties, DavPropertyValue } from './constants'

export const ListOfficeFilesFactory = (dav: DAV, options: WebDavOptions) => {
  return {
    listOfficeFiles({
      davProperties = DavProperties.Default,
      spaceID = '',
      fileExtension = '',
      projectName = [],
      ...opts
    }: {
      davProperties?: DavPropertyValue[]
      spaceID?: string
      fileExtension?: string
      projectName?: string[]
    } & DAVRequestOptions = {}) {
      return dav.report(urlJoin('spaces', spaceID), {
        properties: davProperties,
        filterRules: { 'my-office-files': fileExtension, projects: [projectName] },
        ...opts
      })
    }
  }
}
