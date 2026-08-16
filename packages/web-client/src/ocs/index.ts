import { Capabilities, GetCapabilitiesFactory } from './capabilities'
import { AxiosInstance } from 'axios'
import { SignUrlPayload, UrlSign } from './urlSign'
import { UserCapabilities, GetUserCapabilitiesFactory } from './users'

export * from './capabilities'

export interface OCS {
  getCapabilities: () => Promise<Capabilities>
  getUserCapabilities?: (username: string) => Promise<UserCapabilities>
  signUrl: (payload: SignUrlPayload) => Promise<string>
}

export const ocs = (baseURI: string, axiosClient: AxiosInstance): OCS => {
  const url = new URL(baseURI)
  url.pathname = [...url.pathname.split('/'), 'ocs', 'v2.php'].filter(Boolean).join('/')
  const ocsV2BaseURI = url.href

  const v1url = new URL(baseURI)
  v1url.pathname = [...v1url.pathname.split('/'), 'ocs', 'v1.php'].filter(Boolean).join('/')
  const ocsV1BaseURI = v1url.href

  const capabilitiesFactory = GetCapabilitiesFactory(ocsV2BaseURI, axiosClient)

  const userCapabilitiesFactory = GetUserCapabilitiesFactory(ocsV1BaseURI, axiosClient)

  const urlSign = new UrlSign({ baseURI, axiosClient })

  return {
    getCapabilities: () => {
      return capabilitiesFactory.getCapabilities()
    },
    getUserCapabilities(username) {
      return userCapabilitiesFactory.getUserCapabilities(username)
    },
    signUrl: (payload: SignUrlPayload) => {
      return urlSign.signUrl(payload)
    }
  }
}
