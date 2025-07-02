import { SpaceResource } from '../helpers'
import { WebDavOptions } from './types'
import { DAV, DAVRequestOptions } from './client'
import { HttpError } from '../errors'
import { ResponseType } from 'axios'
import { getWebDavPath } from './utils'
import { urlJoin } from '../utils'

export type GetFileContentsResponse = {
  body: any
  [key: string]: any
}

export const GetFileContentsFactory = (dav: DAV, { axiosClient }: WebDavOptions) => {
  return {
    async getFileContents(
      space: SpaceResource,
      { fileId, path }: { fileId?: string; path?: string },
      version: string = null,
      {
        responseType = 'text',
        noCache = true,
        headers,
        ...opts
      }: {
        responseType?: ResponseType
        noCache?: boolean
      } & DAVRequestOptions = {}
    ): Promise<GetFileContentsResponse> {
      try {
        const fileUrl = !version
          ? dav.getFileUrl(getWebDavPath(space, { fileId, path }))
          : dav.getFileUrl(urlJoin('meta', fileId, 'v', version))

        const response = await axiosClient.get(fileUrl, {
          responseType,
          headers: {
            ...(noCache && { 'Cache-Control': 'no-cache' }),
            ...(headers || {})
          },
          ...opts
        })
        return {
          response,
          body: response.data,
          headers: {
            ETag: response.headers['etag'],
            'OC-ETag': response.headers['oc-etag'],
            'OC-FileId': response.headers['oc-fileid']
          }
        }
      } catch (error) {
        const { message, response } = error
        throw new HttpError(message, response, response.status)
      }
    }
  }
}
