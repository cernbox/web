import { CapabilityStore } from '../composables/index'

export const getWebVersion = (): string => {
  return `CERNBox Web ${process.env.PACKAGE_VERSION}`
}

export const getBackendVersion = ({
  capabilityStore
}: {
  capabilityStore: CapabilityStore
}): string => {
  const backendStatus = capabilityStore.status
  if (!backendStatus || !backendStatus.versionstring) {
    return undefined
  }
  const product = backendStatus.product || 'Reva'
  const version = backendStatus.productversion || backendStatus.versionstring
  const edition = backendStatus.edition
  return `${product} ${version} ${edition}`
}
