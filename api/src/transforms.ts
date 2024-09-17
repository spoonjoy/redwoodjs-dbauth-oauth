import { isFetchApiRequest, PartialRequest } from '@redwoodjs/api'
import { Headers, Request as PonyfillRequest } from '@whatwg-node/fetch'
import { APIGatewayProxyEvent } from 'aws-lambda'

/**
 * Rather than just using JSON.parse, this function will also parse the body if it comes through as QSPs (such as when using Sign in with Apple)
 */
const parseToJson = (str: string) => {
  try {
    return JSON.parse(str)
  } catch {
    const searchParams = new URLSearchParams(str)
    return Object.fromEntries(searchParams)
  }
}

/**
 * The below is from the RedwoodJS API package, with JSON.parse replaced with the above
 * function (parseToJson) to handle bodies that come through as QSPs
 * (original here: https://github.com/redwoodjs/redwood/blob/36fa1dd0b2287f3644313a5439d43dda2dd69863/packages/api/src/transforms.ts)
 */

/**
 * Extracts and parses body payload from event with base64 encoding check
 */
export const parseLambdaEventBody = (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return {}
  }

  if (event.isBase64Encoded) {
    return parseToJson(Buffer.from(event.body, 'base64').toString('utf-8'))
  } else {
    return parseToJson(event.body)
  }
}

/**
 * Extracts and parses body payload from Fetch Request
 * with check for empty body
 *
 * NOTE: whatwg/server expects that you will decode the base64 body yourself
 * see readme here: https://github.com/ardatan/whatwg-node/tree/master/packages/server#aws-lambda
 */
export const parseFetchEventBody = async (event: Request) => {
  if (!event.body) {
    return {}
  }

  const body = await event.text()

  return body ? parseToJson(body) : {}
}

function getQueryStringParams(reqUrl: string) {
  const url = new URL(reqUrl)
  const params = new URLSearchParams(url.search)

  const paramObject: Record<string, string> = {}
  for (const entry of params.entries()) {
    paramObject[entry[0]] = entry[1] // each 'entry' is a [key, value] tuple
  }
  return paramObject
}

/**
 *
 * This function returns a an object that lets you access _some_ of the request properties in a consistent way
 * You can give it either a LambdaEvent or a Fetch API Request
 *
 * NOTE: It does NOT return a full Request object!
 */
export async function normalizeRequest(
  event: APIGatewayProxyEvent | Request
): Promise<PartialRequest> {
  if (isFetchApiRequest(event)) {
    return {
      headers: event.headers,
      method: event.method,
      query: getQueryStringParams(event.url),
      jsonBody: await parseFetchEventBody(event),
    }
  }

  const jsonBody = parseLambdaEventBody(event)

  return {
    headers: new Headers(event.headers as Record<string, string>),
    method: event.httpMethod,
    query: event.queryStringParameters,
    jsonBody,
  }
}
