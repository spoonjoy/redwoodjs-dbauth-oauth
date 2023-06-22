import {
  DbAuthHandler,
  DbAuthHandlerOptions,
  hashPassword,
} from '@redwoodjs/auth-dbauth-api'
import { normalizeRequest } from '@redwoodjs/api'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'
import { PrismaClient } from '@prisma/client'

export interface OAuthHandlerOptions {
  /**
   * Provide prisma db client
   */
  db: PrismaClient
  /**
   * The name of the property you'd call on `db` to access your user table.
   * ie. if your Prisma model is named `User` this value would be `user`, as in `db.user`
   */
  userModelAccessor: keyof PrismaClient
  /**
   * Object containing cookie config options
   */
  cookie?: DbAuthHandlerOptions['cookie']
}

interface TokenResponse {
  access_token: string
  expires_in: number
  id_token: string
  refresh_token: string
  scope: string
  token_type: string
}

interface GoogleUserInfo {
  email: string
  family_name: string
  given_name: string
  id: string
  locale: string
  name: string
  picture: string
  verified_email: boolean
}

export type OAuthMethodNames = 'linkGoogleAccount' | 'unlinkAccount'

type Params = {
  code?: string
  method: OAuthMethodNames
  [key: string]: any
}

export class OAuthHandler<
  TUser extends Record<string | number, any>,
  TIdType = any
> {
  event: APIGatewayProxyEvent
  context: LambdaContext
  dbAuthHandlerInstance: DbAuthHandler<TUser, TIdType>

  params: Params

  dbUserAccessor: any
  dbOAuthAccessor: any

  // below are from options
  db: PrismaClient
  cookie: OAuthHandlerOptions['cookie']

  // class constant: list of methods that are supported
  static get METHODS(): OAuthMethodNames[] {
    return ['linkGoogleAccount', 'unlinkAccount']
  }

  // class constant: maps the functions to their required HTTP verb for access
  static get VERBS() {
    return {
      linkGoogleAccount: 'GET',
      unlinkAccount: 'DELETE',
    }
  }

  // based on the one from DbAuthHandler
  _getOAuthMethod() {
    // try getting it from the query string, /.redwood/functions/auth?method=[methodName]
    let methodName = this.event.queryStringParameters
      ?.method as OAuthMethodNames

    if (!OAuthHandler.METHODS.includes(methodName) && this.params) {
      // try getting it from the body in JSON: { method: [methodName] }
      try {
        methodName = this.params.method
      } catch (e) {
        // there's no body, or it's not JSON, `handler` will return a 404
      }
    }

    return methodName
  }

  constructor(
    event: APIGatewayProxyEvent,
    context: LambdaContext,
    dbAuthHandlerInstance: DbAuthHandler<TUser, TIdType>,
    options: OAuthHandlerOptions
  ) {
    this.event = event
    this.context = context
    this.dbAuthHandlerInstance = dbAuthHandlerInstance

    this.db = options.db
    this.dbUserAccessor = this.db[options.userModelAccessor]
    this.dbOAuthAccessor = this.db['oAuth']

    this.params = this.dbAuthHandlerInstance._parseBody()
  }

  _getCodeParam() {
    const code = this.params.code || this.event.queryStringParameters?.code

    if (!code || String(code).trim() === '') {
      throw new Error('No code provided')
    }

    return code
  }

  _getProviderParam() {
    const provider = this.params.provider

    if (!provider || String(provider).trim() === '') {
      throw new Error('No provider provided')
    }

    return provider
  }

  async _getGoogleTokens(): Promise<TokenResponse> {
    const code = this._getCodeParam()

    const url = 'https://oauth2.googleapis.com/token'
    const values = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=linkGoogleAccount&provider=google`,
      grant_type: 'authorization_code',
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },

      body: new URLSearchParams(values).toString(),
    }).then((res) => res.json())

    if (response.access_token) {
      return response as TokenResponse
    } else {
      throw new Error(
        `Unable to get Google tokens, got: ${JSON.stringify(response)}`
      )
    }
  }

  async _getGoogleUserInfo(): Promise<GoogleUserInfo> {
    const code = this._getCodeParam()

    const { id_token, access_token } = await this._getGoogleTokens()

    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      }
    ).then((res) => res.json())

    if (response.id) {
      return response as GoogleUserInfo
    } else {
      throw new Error(
        `Unable to get Google user info, got: ${JSON.stringify(response)}`
      )
    }
  }

  async linkGoogleAccount() {
    const googleUserInfo = await this._getGoogleUserInfo()

    let currentUser

    try {
      currentUser = await this.dbAuthHandlerInstance._getCurrentUser()
    } catch {
      currentUser = null
    }

    // check if there is already a user with this email.
    const maybeExistingUser = await this.dbUserAccessor.findUnique({
      where: { email: googleUserInfo.email },
    })

    // if NOT logged in:
    if (!currentUser) {
      // if there's already a user with this email, link to that user.
      if (maybeExistingUser) {
        const newOAuthRecord = await this.dbOAuthAccessor.create({
          data: {
            provider: 'GOOGLE',
            providerUserId: googleUserInfo.id,
            userId: maybeExistingUser.id,
          },
        })

        return [newOAuthRecord]
      }
      // if there isn't, create a new user and link to that user.
      else {
        const generatedPass = new Crypto()
          .getRandomValues(new Uint8Array(32))
          .toString()
        const [hashedPassword, salt] = hashPassword(generatedPass)
        const newUser = await this.dbUserAccessor.create({
          data: {
            email: googleUserInfo.email,
            username: googleUserInfo.name,
            hashedPassword,
            salt,
          },
        })

        const newOAuthRecord = await this.dbOAuthAccessor.create({
          data: {
            provider: 'GOOGLE',
            providerUserId: googleUserInfo.id,
            userId: newUser.id,
          },
        })

        return [newOAuthRecord]
      }
    }

    // if logged in:
    else {
      // if there's already a user with this email, check if it's the same as the user that's logged in - if it's not, throw an error that there's already an account using this email.
      if (maybeExistingUser && maybeExistingUser.email !== currentUser.email) {
        throw new Error('There is already an account using this email.')
      }
      // otherwise, link it to the current account.
      else {
        const newOAuthRecord = await this.dbOAuthAccessor.create({
          data: {
            provider: 'GOOGLE',
            providerUserId: googleUserInfo.id,
            userId: currentUser.id,
          },
        })
        return [newOAuthRecord]
      }
    }
  }

  async unlinkAccount() {
    const provider = this._getProviderParam()

    const currentUser = await this.dbAuthHandlerInstance._getCurrentUser()

    return await this.dbOAuthAccessor.deleteMany({
      where: {
        userId: currentUser.id,
        provider,
      },
    })
  }

  async invoke() {
    const request = normalizeRequest(this.event)
    console.log('request', request)

    const corsHeaders = {}

    try {
      const method = this._getOAuthMethod()

      // get the method the incoming request is trying to call
      if (!OAuthHandler.METHODS.includes(method)) {
        return this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
          this.dbAuthHandlerInstance._notFound(),
          corsHeaders
        )
      }

      // make sure it's using the correct verb, GET vs POST
      if (this.event.httpMethod !== OAuthHandler.VERBS[method]) {
        return this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
          this.dbAuthHandlerInstance._notFound(),
          corsHeaders
        )
      }

      // call whatever auth method was requested and return the body and headers
      const [body, headers, options = { statusCode: 200 }] = await this[
        method
      ]()

      return this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
        this.dbAuthHandlerInstance._ok(body, headers, options),
        corsHeaders
      )
    } catch (e: any) {
      return this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
        this.dbAuthHandlerInstance._badRequest(e.message || e),
        corsHeaders
      )
    }
  }
}
