import { DbAuthHandler } from '@redwoodjs/auth-dbauth-api'
import { normalizeRequest } from '@redwoodjs/api'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'

export class OAuthHandler<
  TUser extends Record<string | number, any>,
  TIdType = any
> {
  event: APIGatewayProxyEvent
  context: LambdaContext
  dbAuthHandlerInstance: DbAuthHandler<TUser, TIdType>

  constructor(
    event: APIGatewayProxyEvent,
    context: LambdaContext,
    dbAuthHandlerInstance: DbAuthHandler<TUser, TIdType>
  ) {
    this.event = event
    this.context = context
    this.dbAuthHandlerInstance = dbAuthHandlerInstance
  }

  async invoke() {
    const request = normalizeRequest(this.event)

    console.log('OAuthHandler: request', request)
  }
}
