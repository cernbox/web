import { RuntimeError } from '../errors'
import { ClientService } from '../services'
import { HttpError, SignatureAuth, urlJoin } from '@ownclouders/web-client'
import { triggerDownloadWithFilename } from '../helpers/download'

import { Ref, ref, computed, unref } from 'vue'
import { ArchiverCapability } from '@ownclouders/web-client/ocs'
import { UserStore } from '../composables'

interface TriggerDownloadOptions {
  dir?: string
  files?: string[]
  fileIds?: string[]
  downloadSecret?: string
  publicToken?: string
  publicLinkPassword?: string
  publicLinkShareOwner?: string
  signatureAuth?: SignatureAuth
}

function sortArchivers(a: ArchiverCapability, b: ArchiverCapability): number {
  const va = a.version.startsWith('v') ? a.version.slice(1) : a.version
  const vb = b.version.startsWith('v') ? b.version.slice(1) : b.version

  const [releaseA, preReleaseA] = va.split('-') || []
  const [releaseB, preReleaseB] = vb.split('-') || []

  const releaseCompare = releaseB.localeCompare(releaseA)

  if (releaseCompare !== 0) {
    return releaseCompare
  }

  if (preReleaseA && !preReleaseB) {
    return 1
  }

  if (!preReleaseA && preReleaseB) {
    return -1
  }

  return preReleaseB.localeCompare(preReleaseA)
}

export class ArchiverService {
  clientService: ClientService
  userStore: UserStore
  serverUrl: string
  capability: Ref<ArchiverCapability>
  available: Ref<boolean>
  fileIdsSupported = true

  constructor(
    clientService: ClientService,
    userStore: UserStore,
    serverUrl: string,
    archiverCapabilities: Ref<ArchiverCapability[]> = ref([])
  ) {
    this.clientService = clientService
    this.userStore = userStore
    this.serverUrl = serverUrl
    this.capability = computed(() => {
      const archivers = unref(archiverCapabilities)
        .filter((a) => a.enabled)
        .sort(sortArchivers)
      return archivers.length ? archivers[0] : null
    })

    this.available = computed(() => {
      return !!unref(this.capability)?.version
    })
  }

  public async triggerDownload(options: TriggerDownloadOptions): Promise<string> {
    if (!unref(this.available)) {
      throw new RuntimeError('no archiver available')
    }

    if ((options.fileIds?.length || 0) + (options.files?.length || 0) === 0) {
      throw new RuntimeError('requested archive with empty list of resources')
    }

    const downloadUrl = this.buildDownloadUrl({ ...options })
    if (!downloadUrl) {
      throw new RuntimeError('download url could not be built')
    }

    // A password-protected link cannot be signed, so the archive has to be
    // fetched with basic auth and handed to the browser as a blob.
    if (options.publicLinkPassword) {
      return this.fetchAndDownload(downloadUrl, options.publicLinkPassword)
    }

    const url = options.publicToken
      ? downloadUrl
      : await this.clientService.ocs.signUrl(
          downloadUrl,
          this.userStore.user?.onPremisesSamAccountName
        )

    triggerDownloadWithFilename(url, 'download')
    return url
  }

  private async fetchAndDownload(url: string, password: string): Promise<string> {
    try {
      const response = await this.clientService.httpUnAuthenticated.get<ArrayBuffer>(url, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`public:${password}`).toString('base64')
        },
        responseType: 'arraybuffer'
      })

      const blob = new Blob([response.data], { type: 'application/octet-stream' })
      const objectUrl = URL.createObjectURL(blob)
      const fileName = (response.headers as Record<string, string>)['content-disposition']?.split(
        '"'
      )[1]
      triggerDownloadWithFilename(objectUrl, fileName ? decodeURI(fileName) : 'download')
      return url
    } catch (e) {
      throw new HttpError('archive could not be fetched', e.response)
    }
  }

  private buildDownloadUrl(options: TriggerDownloadOptions): string {
    const url = new URL(this.url)

    // password-protected links are authenticated with basic auth in fetchAndDownload
    // rather than a signature, so the token is always needed
    if (options.publicToken) {
      url.searchParams.set('public-token', options.publicToken)
    }

    if (options.publicLinkPassword && options.signatureAuth) {
      url.searchParams.set('signature', options.signatureAuth.signature)
      url.searchParams.set('expiration', options.signatureAuth.expiration.toISOString())
    }

    for (const fileId of options.fileIds) {
      url.searchParams.append('id', fileId)
    }

    return url.toString()
  }

  private get url(): string {
    if (!this.available) {
      throw new RuntimeError('no archiver available')
    }
    const capability = unref(this.capability)
    if (/^https?:\/\//i.test(capability.archiver_url)) {
      return capability.archiver_url
    }
    return urlJoin(this.serverUrl, capability.archiver_url)
  }
}
