import { APIGatewayProxyEvent } from 'aws-lambda'

// sometimes body is an empty string, sometimes it's a JSON string, sometimes it's query string params for some reason
export const parseEventBodyAsString = (
  event: APIGatewayProxyEvent | Request
): APIGatewayProxyEvent | Request => {
  if (!event.body) {
    return event
  }
  const newEvent: APIGatewayProxyEvent | Request = { ...event }
  let newBody = ''

  if ('isBase64Encoded' in event && event.isBase64Encoded) {
    newBody = Buffer.from(event.body, 'base64').toString('utf-8')
  } else {
    newBody = event.body
  }

  // Check if the body is already valid JSON
  try {
    JSON.parse(newBody)
  } catch (error) {
    // If it's not valid JSON, try parsing as query string and convert to JSON string
    const searchParams = new URLSearchParams(newBody)
    const result = Object.fromEntries(searchParams)

    newBody = JSON.stringify(result)
  }

  newEvent.body = newBody

  return newEvent
}
