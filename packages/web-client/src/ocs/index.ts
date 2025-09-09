import { Capabilities, GetCapabilitiesFactory } from './capabilities'
import { AxiosInstance } from 'axios'
import { UrlSign } from './urlSign'
import { UserCapabilities, GetUserCapabilitiesFactory } from './users'

export * from './capabilities'

export interface OCS {
  getCapabilities: () => Promise<Capabilities>
  getUserCapabilities?: (username: string) => Promise<UserCapabilities>
  signUrl: (url: string, username: string) => Promise<string>
}

export const ocs = (baseURI: string, axiosClient: AxiosInstance): OCS => {
  const url = new URL(baseURI)
  url.pathname = [...url.pathname.split('/'), 'ocs', 'v1.php'].filter(Boolean).join('/')
  const ocsV1BaseURI = url.href

  const capabilitiesFactory = GetCapabilitiesFactory(ocsV1BaseURI, axiosClient)

  const userCapabilitiesFactory = GetUserCapabilitiesFactory(ocsV1BaseURI, axiosClient)

  const urlSign = new UrlSign({ baseURI, axiosClient })

  return {
    getCapabilities: () => {
      return capabilitiesFactory.getCapabilities()
    },
    getUserCapabilities(username) {
      return userCapabilitiesFactory.getUserCapabilities(username)
    },
    signUrl: (url: string, username: string) => {
      return urlSign.signUrl(url, username)
    }
  }
}
