import {
  ArchiverService,
  archiverService as defaultArchiverService,
  ClientService,
  clientService as defaultClientService
} from '../../services'
import { major } from 'semver'
import { RuntimeError } from 'web-runtime/src/container/error'

interface TriggerDownloadAsArchiveOptions {
  fileIds: string[]
  archiverService?: ArchiverService
  clientService?: ClientService
}

export const triggerDownloadAsArchive = async (
  options: TriggerDownloadAsArchiveOptions
): Promise<void> => {
  const archiverService = options.archiverService || defaultArchiverService
  const clientService = options.clientService || defaultClientService
  if (!isDownloadAsArchiveAvailable(archiverService)) {
    throw new RuntimeError('no archiver capability available')
  }
  if (options.fileIds.length === 0) {
    throw new RuntimeError('requested archive with empty list of resources')
  }
  const majorVersion = major(archiverService.capability.version)
  if (majorVersion === 2) {
    const queryParams = [...options.fileIds.map((id) => `id=${id}`)]
    const archiverUrl = archiverService.url + '?' + queryParams.join('&')
    if (archiverService.urlSigningEnabled) {
      window.location = await clientService.owncloudSdk.signUrl(archiverUrl)
    } else {
      // Get token and append as '?access_token='
    }
  }
}

export const isDownloadAsArchiveAvailable = (
  service: ArchiverService = defaultArchiverService
): boolean => {
  return service.available
}
