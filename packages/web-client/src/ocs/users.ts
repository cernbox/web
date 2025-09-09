import { AxiosInstance } from 'axios'
import get from 'lodash-es/get'

export interface UserCapabilities {
  quota?: {
    free?: number
    used?: number
    total?: number
    relative?: number
    definition?: string
  }
  email?: string
  displayname?: string
  'user-type'?: string
  two_factor_auth_enabled?: boolean
  'group-capabilities'?: string[]
}

export const GetUserCapabilitiesFactory = (baseURI: string, axios: AxiosInstance) => {
  const url = new URL(baseURI)
  url.pathname = [...url.pathname.split('/'), 'cloud', 'users', 'user-id'].filter(Boolean).join('/')
  url.searchParams.append('format', 'json')
  const endpoint = url.href

  return {
    async getUserCapabilities(username: string): Promise<UserCapabilities> {
      const response = await axios.get(endpoint.replace('user-id', encodeURIComponent(username)))
      return get(response, 'data.ocs.data', {
        quota: null,
        email: null,
        displayname: null,
        'user-type': null,
        two_factor_auth_enabled: null,
        'group-capabilities': null
      })
    }
  }
}
