import { AxiosInstance } from 'axios'
import { urlJoin } from '../utils'
import convert from 'xml-js'
import { pbkdf2Sync } from 'crypto'

export interface UrlSignOptions {
  axiosClient: AxiosInstance
  baseURI: string
}

export class UrlSign {
  private axiosClient: AxiosInstance
  private baseURI: string

  private ALGORITHM = 'sha512'
  private TTL = 1200
  private HASH_LENGTH = 32
  private ITERATION_COUNT = 10000

  constructor({ axiosClient, baseURI }: UrlSignOptions) {
    this.axiosClient = axiosClient
    this.baseURI = baseURI
  }

  public async signUrl(url: string, username: string) {
    const now = new Date().toISOString()
    const signedUrl = new URL(url)
    signedUrl.searchParams.set('OC-Credential', username)
    signedUrl.searchParams.set('OC-Date', now)
    signedUrl.searchParams.set('OC-Expires', this.TTL.toString())
    signedUrl.searchParams.set('OC-Verb', 'GET')

    const signignKey = await this.getSignKey(now)
    const hashedKey = this.createHashedKey(signedUrl.toString(), signignKey)

    signedUrl.searchParams.set('OC-Algo', `PBKDF2/${this.ITERATION_COUNT}-SHA512`)
    signedUrl.searchParams.set('OC-Signature', hashedKey)

    return signedUrl.toString()
  }

  // The key is bound to the date sent along with the request, so it cannot be
  // cached across calls.
  private async getSignKey(date: string) {
    const data = await this.axiosClient.get(
      urlJoin(this.baseURI, `ocs/v1.php/cloud/user/signing-key?OC-Date=${date}`),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    )

    const parsedXML = convert.xml2js(data.data, { compact: true }) as any
    return parsedXML.ocs.data['signing-key']._text
  }

  private createHashedKey(url: string, signignKey: string) {
    const hashedKey = pbkdf2Sync(
      url,
      signignKey,
      this.ITERATION_COUNT,
      this.HASH_LENGTH,
      this.ALGORITHM
    )

    return hashedKey.toString('hex')
  }
}
