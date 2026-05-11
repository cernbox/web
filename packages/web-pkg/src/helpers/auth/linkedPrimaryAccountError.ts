import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'

/**
 * LOCAL 4348: Linked primary account detection on identity bootstrap routes only for matching HTTP responses.
 *
 * Post-bootstrap behaviour relies on Axios response interceptors wired from runtime (`ClientService.attachLinkedPrimaryAccountHandling`)
 * on Graph, OCS, and authenticated HTTP stacks only. WebDAV and other non-Axios transports are out of scope unless backends expose the same Axios-shaped errors there.
 */

/**
 * Machine-readable codes backends may return for "linked primary account"
 * on identity bootstrap routes (Graph `/me`, settings, OCS user/capabilities).
 * Align error payloads with your deployment; do not treat arbitrary 409 as this case.
 */
const LINKED_PRIMARY_ERROR_CODES = new Set([
  'linkedPrimaryAccount',
  'LinkedPrimaryAccount',
  'identity.LinkedPrimaryAccount',
  'Identity.LinkedPrimaryAccount',
  'notAllowedLinkedPrimaryAccount'
])

const LINKED_PRIMARY_HEADER = 'x-oc-linked-primary-account'

/** Last resort only; prefer `error.code` or `X-Oc-Linked-Primary-Account` header from backend. */
const MESSAGE_FRAGMENTS = ['linked primary account', 'linked primary']

export const LINKED_PRIMARY_AUTH_HANDLED_CONFIG_KEY = 'linkedPrimaryAuthHandled'

function resolveRequestPath(config: AxiosError['config']): string {
  if (!config?.url) {
    return ''
  }
  try {
    const base = config.baseURL || 'http://localhost'
    return new URL(config.url, base).pathname.toLowerCase()
  } catch {
    return config.url.split('?')[0].toLowerCase()
  }
}

export function isIdentityBootstrapRequestUrl(pathOrFullUrl: string): boolean {
  const path = pathOrFullUrl.toLowerCase()
  return (
    path.includes('/graph/v1.0/me') ||
    path.includes('/graph/v1beta/me') ||
    path.includes('/graph/v1beta1/me') ||
    path.includes('/api/v0/settings/') ||
    path.includes('/ocs/v1.php/cloud/capabilities') ||
    path.includes('/ocs/v1.php/cloud/users/') ||
    path.endsWith('/ocs/v1.php/cloud/user')
  )
}

function readGraphStyleErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const root = data as Record<string, unknown>
  const err = root.error
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function readLinkedPrimaryHeader(headers: AxiosResponse['headers']): boolean {
  if (!headers) {
    return false
  }
  let raw: string | undefined
  if (typeof (headers as { get?: (n: string) => unknown }).get === 'function') {
    const get = (headers as { get: (n: string) => unknown }).get
    raw = get(LINKED_PRIMARY_HEADER) as string | undefined
    if (raw === undefined || raw === '') {
      raw = get('X-Oc-Linked-Primary-Account') as string | undefined
    }
  } else {
    const h = headers as Record<string, string | undefined>
    raw =
      h[LINKED_PRIMARY_HEADER] ??
      h['X-Oc-Linked-Primary-Account'] ??
      h['x-oc-linked-primary-account']
  }
  return raw !== undefined && String(raw).toLowerCase() === 'true'
}

function messageSuggestsLinkedPrimary(data: unknown): boolean {
  const msg = readGraphStyleMessage(data)
  if (!msg) {
    return false
  }
  const lower = msg.toLowerCase()
  return MESSAGE_FRAGMENTS.some((f) => lower.includes(f))
}

function readGraphStyleMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const root = data as Record<string, unknown>
  const err = root.error
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
  }
  return undefined
}

export function markLinkedPrimaryAuthHandled(error: unknown): void {
  if (!axios.isAxiosError(error) || !error.config) {
    return
  }
  ;(error.config as unknown as Record<string, unknown>)[LINKED_PRIMARY_AUTH_HANDLED_CONFIG_KEY] = true
}

export function wasLinkedPrimaryAuthHandled(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.config) {
    return false
  }
  return !!(error.config as unknown as Record<string, unknown>)[LINKED_PRIMARY_AUTH_HANDLED_CONFIG_KEY]
}

/**
 * Registers an Axios response interceptor: linked-primary 409 on bootstrap URLs invokes `onDetected`, then marks the error so duplicate `handleAuthError(..., { cause })` calls no-op.
 */
export function attachLinkedPrimaryAccountResponseInterceptor(
  axiosInstance: AxiosInstance,
  onDetected: (error: unknown) => void | Promise<void>
): number {
  return axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (isLinkedPrimaryAccountError(error)) {
        await onDetected(error)
        markLinkedPrimaryAuthHandled(error)
      }
      return Promise.reject(error)
    }
  )
}

/**
 * True when the response matches the linked-primary contract on an identity
 * bootstrap URL (so unrelated WebDAV or editor 409s are excluded).
 */
export function isLinkedPrimaryAccountError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false
  }
  const ae = err as AxiosError
  if (ae.response?.status !== 409) {
    return false
  }
  const path = resolveRequestPath(ae.config)
  if (!isIdentityBootstrapRequestUrl(path)) {
    return false
  }
  if (readLinkedPrimaryHeader(ae.response.headers)) {
    return true
  }
  const code = readGraphStyleErrorCode(ae.response.data)
  if (code && LINKED_PRIMARY_ERROR_CODES.has(code)) {
    return true
  }
  return messageSuggestsLinkedPrimary(ae.response.data)
}
