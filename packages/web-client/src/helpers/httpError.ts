import { HttpError } from '../errors'

/**
 * Create a HttpError based on a given message, status code and x-request-id.
 */
export const createHttpError = ({
  message,
  statusCode,
  xReqId
}: {
  message: string
  statusCode: number
  xReqId: string
}) => {
  const response = new Response(undefined, {
    headers: { 'x-request-id': xReqId },
    status: statusCode
  })
  return new HttpError(message, response, statusCode)
}

export type HttpErrorLogDetails = {
  message?: string
  statusCode?: number
  xReqId?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readXRequestId = (headers: unknown): string | undefined => {
  if (!isRecord(headers)) {
    return undefined
  }

  const value =
    typeof headers.get === 'function'
      ? headers.get.call(headers, 'x-request-id')
      : headers['x-request-id']

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Safe fields for logging HTTP failures. Log this object instead of the error,
 * because axios errors retain the request config including Authorization.
 */
export const getHttpErrorLogDetails = (error: unknown): HttpErrorLogDetails => {
  if (!isRecord(error)) {
    return {}
  }

  const details: HttpErrorLogDetails = {}
  const response = isRecord(error.response) ? error.response : undefined

  if (typeof error.message === 'string' && error.message.length > 0) {
    details.message = error.message
  }

  if (typeof error.statusCode === 'number') {
    details.statusCode = error.statusCode
  } else if (response !== undefined && typeof response.status === 'number') {
    details.statusCode = response.status
  }

  if (response !== undefined) {
    const xReqId = readXRequestId(response.headers)
    if (xReqId !== undefined) {
      details.xReqId = xReqId
    }
  }

  return details
}
