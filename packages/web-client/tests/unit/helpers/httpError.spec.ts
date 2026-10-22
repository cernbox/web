import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { DavHttpError } from '../../../src/errors'
import { getHttpErrorLogDetails } from '../../../src/helpers/httpError'

describe('getHttpErrorLogDetails', () => {
  it('extracts message, status, and x-request-id from DavHttpError', () => {
    const response = new Response(undefined, {
      status: 404,
      headers: { 'x-request-id': 'req-dav' }
    })
    const error = new DavHttpError('Not Found', 'ERR_FILE_NOT_FOUND_IN_ROOT', response, 404)

    expect(getHttpErrorLogDetails(error)).toEqual({
      message: 'Not Found',
      statusCode: 404,
      xReqId: 'req-dav'
    })
  })

  it('extracts safe fields from AxiosError without leaking config or response data', () => {
    const error = new AxiosError(
      'Request failed with status code 500',
      AxiosError.ERR_BAD_RESPONSE,
      { headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }) },
      {},
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new AxiosHeaders({ 'X-Request-Id': 'req-axios' }),
        data: { token: 'secret-token' },
        config: { headers: new AxiosHeaders() }
      }
    )

    const result = getHttpErrorLogDetails(error)

    expect(result).toEqual({
      message: 'Request failed with status code 500',
      statusCode: 500,
      xReqId: 'req-axios'
    })
    expect(JSON.stringify(result)).not.toContain('secret-token')
  })

  it('reads x-request-id from plain-object response headers', () => {
    const error = {
      message: 'Bad gateway',
      response: { status: 502, headers: { 'x-request-id': 'req-plain' } }
    }

    expect(getHttpErrorLogDetails(error)).toEqual({
      message: 'Bad gateway',
      statusCode: 502,
      xReqId: 'req-plain'
    })
  })

  it('omits xReqId when the header is missing', () => {
    const error = {
      message: 'Server error',
      response: { status: 500, headers: new Headers() }
    }

    expect(getHttpErrorLogDetails(error)).toStrictEqual({
      message: 'Server error',
      statusCode: 500
    })
    expect(getHttpErrorLogDetails(error)).not.toHaveProperty('xReqId')
  })

  it('returns message only for a plain Error without response', () => {
    expect(getHttpErrorLogDetails(new Error('boom'))).toEqual({ message: 'boom' })
  })

  it('omits message when it is an empty string', () => {
    expect(getHttpErrorLogDetails({ message: '', response: { status: 500 } })).toStrictEqual({
      statusCode: 500
    })
  })

  it.each([undefined, null, 'oops'] as const)(
    'returns an empty object for non-object input (%s)',
    (value) => {
      expect(getHttpErrorLogDetails(value)).toEqual({})
    }
  )
})
