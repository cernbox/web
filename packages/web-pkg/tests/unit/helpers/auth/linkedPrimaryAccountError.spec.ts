import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import {
  attachLinkedPrimaryAccountResponseInterceptor,
  isLinkedPrimaryAccountError,
  markLinkedPrimaryAuthHandled,
  wasLinkedPrimaryAuthHandled
} from '../../../../src/helpers/auth/linkedPrimaryAccountError'

function err409(options: {
  url?: string
  baseURL?: string
  data?: unknown
  headers?: Record<string, string>
}): AxiosError {
  return new AxiosError(
    'conflict',
    'ERR_BAD_REQUEST',
    {
      url: options.url ?? '/graph/v1.0/me',
      baseURL: options.baseURL ?? 'https://example.com/',
      headers: {}
    } as InternalAxiosRequestConfig,
    {},
    {
      status: 409,
      statusText: 'Conflict',
      data: options.data ?? { error: { code: 'linkedPrimaryAccount', message: 'x' } },
      headers: options.headers ?? {},
      config: {} as AxiosError['config']
    }
  )
}

describe('isLinkedPrimaryAccountError', () => {
  it('returns false for non-axios errors', () => {
    expect(isLinkedPrimaryAccountError(new Error('oops'))).toBe(false)
  })

  it('returns false for 409 on non-bootstrap URLs', () => {
    const error = err409({
      url: '/remote.php/dav/files/foo',
      data: { error: { code: 'linkedPrimaryAccount' } }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(false)
  })

  it('returns false for bootstrap URL with 409 and body that does not match contract', () => {
    const emptyBody = err409({
      data: {}
    })
    expect(isLinkedPrimaryAccountError(emptyBody)).toBe(false)

    const otherCode = err409({
      data: { error: { code: 'generalException', message: 'something unrelated' } }
    })
    expect(isLinkedPrimaryAccountError(otherCode)).toBe(false)
  })

  it('returns true for 409 on Graph /me with documented error code', () => {
    expect(isLinkedPrimaryAccountError(err409({}))).toBe(true)
  })

  it('returns true when response sets X-Oc-Linked-Primary-Account header', () => {
    const error = err409({
      data: {},
      headers: { 'x-oc-linked-primary-account': 'true' }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(true)
  })

  it('returns true for settings API path with matching code', () => {
    const error = err409({
      url: '/api/v0/settings/roles-list',
      data: { error: { code: 'identity.LinkedPrimaryAccount' } }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(true)
  })

  it('returns true for OCS user-capabilities style path with matching code', () => {
    const error = err409({
      url: '/ocs/v1.php/cloud/users/account-id',
      data: { error: { code: 'linkedPrimaryAccount' } }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(true)
  })

  it('returns true for Graph v1beta1 /me with matching code', () => {
    const error = err409({
      url: '/graph/v1beta1/me',
      data: { error: { code: 'linkedPrimaryAccount' } }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(true)
  })

  it('returns true for singular cloud/user endpoint path with matching code', () => {
    const error = err409({
      url: '/ocs/v1.php/cloud/user',
      data: { error: { code: 'linkedPrimaryAccount' } }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(true)
  })

  it('returns true when only error.message suggests linked primary on bootstrap URL', () => {
    const error = err409({
      data: {
        error: {
          code: 'unknown',
          message: 'Your linked primary account cannot access this application'
        }
      }
    })
    expect(isLinkedPrimaryAccountError(error)).toBe(true)
  })
})

describe('linkedPrimaryAuthHandled marker', () => {
  it('markLinkedPrimaryAuthHandled sets flag readable by wasLinkedPrimaryAuthHandled', () => {
    const error = err409({})
    expect(wasLinkedPrimaryAuthHandled(error)).toBe(false)
    markLinkedPrimaryAuthHandled(error)
    expect(wasLinkedPrimaryAuthHandled(error)).toBe(true)
  })
})

describe('attachLinkedPrimaryAccountResponseInterceptor', () => {
  it('registers a response interceptor that invokes onDetected then marks handled', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const client = axios.create()
    const useSpy = vi.spyOn(client.interceptors.response, 'use')

    attachLinkedPrimaryAccountResponseInterceptor(client, handler)

    expect(useSpy).toHaveBeenCalled()
    const onRejected = useSpy.mock.calls[0][1] as (err: unknown) => Promise<unknown>
    const rejection = err409({})

    await expect(onRejected(rejection)).rejects.toBe(rejection)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(wasLinkedPrimaryAuthHandled(rejection)).toBe(true)
  })

  it('does not invoke handler when error is not linked-primary', async () => {
    const handler = vi.fn()
    const client = axios.create()
    const useSpy = vi.spyOn(client.interceptors.response, 'use')

    attachLinkedPrimaryAccountResponseInterceptor(client, handler)

    const onRejected = useSpy.mock.calls[0][1] as (err: unknown) => Promise<unknown>
    const rejection = err409({
      url: '/remote.php/dav/files/foo',
      data: { error: { code: 'linkedPrimaryAccount' } }
    })

    await expect(onRejected(rejection)).rejects.toBe(rejection)
    expect(handler).not.toHaveBeenCalled()
    expect(wasLinkedPrimaryAuthHandled(rejection)).toBe(false)
  })
})
