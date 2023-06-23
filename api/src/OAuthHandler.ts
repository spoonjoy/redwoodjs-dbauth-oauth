import {
  DbAuthHandler,
  DbAuthHandlerOptions,
  hashPassword,
} from '@redwoodjs/auth-dbauth-api'
import { normalizeRequest } from '@redwoodjs/api'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

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

/**
 * {
  iss: "https://appleid.apple.com",
  aud: "app.spoonjoy.client",
  exp: 1687588464,
  iat: 1687502064,
  sub: "001942.67cefd9e2e494fc9a4daa803dd999ac7.2122",
  at_hash: "cbYgrWy7he1-ixPASGabog",
  email: "ari@mendelow.me",
  email_verified: "true",
  auth_time: 1687502064,
  nonce_supported: true,
}

{
  iss: "https://accounts.google.com",
  azp: "455236264279-qk9tju281evabb70ebfjkms9ru6m5v18.apps.googleusercontent.com",
  aud: "455236264279-qk9tju281evabb70ebfjkms9ru6m5v18.apps.googleusercontent.com",
  sub: "101333747228901268604",
  email: "ari.mendehigh@gmail.com",
  email_verified: true,
  at_hash: "i2JjgVBN7BIk-sLG95matQ",
  name: "Ari Mendelow",
  picture: "https://lh3.googleusercontent.com/a/AAcHTtc6nqbgSpmrixBTrZpTbT_V5U_DsX09N8yxUV-7ow=s96-c",
  given_name: "Ari",
  family_name: "Mendelow",
  locale: "en",
  iat: 1687502139,
  exp: 1687505739,
}

 */

/**
 * The decoded ID token will contain more than this, but this is the minimum
 * of what's needed (and common across providers, ie apple doesn't provide any
 * name information)
 * */
interface DecodedIdToken {
  /** The issuer registered claim identifies the principal that issues the identity token. */
  iss: string
  /** The subject registered claim identifies the principal that’s the subject of the identity token. Because this token is for your app, the value is the unique identifier for the user. */
  sub: string
  /** The audience registered claim identifies the recipient of the identity token. Because the token is for your app, the value is the client_id from your developer account. */
  aud: string
  /** The issued at registered claim indicates the time that Apple issues the identity token, in the number of seconds since the Unix epoch in UTC. */
  iat: number
  /** The expiration time registered claim identifies the time that the identity token expires, in the number of seconds since the Unix epoch in UTC. The value must be greater than the current date and time when verifying the token. */
  exp: number
  /** The user's email address. For Apple, could be a proxy address, and can be empty for Work & School users. */
  email: string
  /** Whether the service verifies the email. */
  email_verified: boolean
  /** The user's full name in displayable form. Not returned by Apple. */
  name?: string
  /** The URL to the user's profile picture. Not returned by Apple. */
  picture?: string
}

export type OAuthMethodNames =
  | 'linkGoogleAccount'
  | 'linkAppleAccount'
  | 'unlinkAccount'

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
    return ['linkGoogleAccount', 'linkAppleAccount', 'unlinkAccount']
  }

  // class constant: maps the functions to their required HTTP verb for access
  static get VERBS() {
    return {
      linkGoogleAccount: 'GET',
      linkAppleAccount: 'POST',
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

  _getStateParam() {
    const state = this.params.state || this.event.queryStringParameters?.state

    if (!state || String(state).trim() === '') {
      console.log('No state provided')
      return null
    }

    return state
  }

  _getProviderParam() {
    const provider = this.params.provider

    if (!provider || String(provider).trim() === '') {
      throw new Error('No provider provided')
    }

    return provider
  }

  /**
   *  Verifies a decoded ID token
   *  @returns the decoded token if it's valid, otherwise throws an error
   * */
  _verifyIdToken(token: DecodedIdToken): DecodedIdToken {
    /**
     * TODO: To verify the identity token, your app server must:
     * - Verify the JWS E256 signature using the server’s public key
     * - Verify the nonce for the authentication
     * - Verify that the iss field contains https://appleid.apple.com
     * - Verify that the aud field is the developer’s client_id
     * - Verify that the time is earlier than the exp value of the token
     */
    return token
  }

  async _getTokenFromProvider(
    provider: 'apple' | 'google'
  ): Promise<DecodedIdToken> {
    const code = this._getCodeParam()

    let url
    let client_id
    let client_secret
    let redirectMethod

    switch (provider) {
      case 'apple':
        url = 'https://appleid.apple.com/auth/token'
        client_id = process.env.APPLE_CLIENT_ID || ''
        client_secret = this._getAppleAuthClientSecret()
        redirectMethod = 'linkAppleAccount'
        break
      case 'google':
        url = 'https://oauth2.googleapis.com/token'
        client_id = process.env.GOOGLE_CLIENT_ID || ''
        client_secret = process.env.GOOGLE_CLIENT_SECRET || ''
        redirectMethod = 'linkGoogleAccount'
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
    const values = {
      code,
      client_id,
      client_secret,
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=${redirectMethod}`,
      grant_type: 'authorization_code',
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },

      body: new URLSearchParams(values).toString(),
    }).then((res) => res.json())

    if (response.id_token) {
      const idTokenDecoded = jwt.decode(response.id_token) as DecodedIdToken
      return this._verifyIdToken(idTokenDecoded)
    } else {
      throw new Error(
        `Unable to get ${provider} token from endpoint, got: ${JSON.stringify(
          response
        )}`
      )
    }
  }

  // based on https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
  _getAppleAuthClientSecret() {
    const timeInSeconds = new Date().getTime() / 1000
    const payload = {
      iss: process.env.APPLE_TEAM_ID || '',
      iat: timeInSeconds,
      exp: timeInSeconds + 86400, // 1 day
      aud: 'https://appleid.apple.com',
      sub: process.env.APPLE_CLIENT_ID || '',
    }
    const secret: jwt.Secret = process.env.APPLE_PRIVATE_KEY || ''
    const options: jwt.SignOptions = {
      algorithm: 'ES256',
      keyid: process.env.APPLE_KEY_ID || '',
    }
    const token = jwt.sign(payload, secret, options)
    return token
  }

  _createLinkAccountResponse(oAuthRecord: any) {
    // If this exists, it should be a redirect back to the app
    const redirectBackUrl = this._getStateParam()
    return [
      oAuthRecord,
      {
        location: redirectBackUrl,
      },
      {
        statusCode: 303,
      },
    ]
  }

  async _linkProviderAccount(provider: 'apple' | 'google') {
    const userToken = await this._getTokenFromProvider(provider)

    let currentUser

    try {
      currentUser = await this.dbAuthHandlerInstance._getCurrentUser()
    } catch {
      currentUser = null
    }

    // check if there is already a user with this email.
    const maybeExistingUser = await this.dbUserAccessor.findUnique({
      where: { email: userToken.email },
    })

    // if NOT logged in:
    if (!currentUser) {
      // if there's already a user with this email, link to that user.
      if (maybeExistingUser) {
        const newOAuthRecord = await this.dbOAuthAccessor.create({
          data: {
            provider: provider.toUpperCase(),
            providerUserId: userToken.sub,
            userId: maybeExistingUser.id,
          },
        })

        return this._createLinkAccountResponse(newOAuthRecord)
      }
      // if there isn't, create a new user and link to that user.
      else {
        const generatedPass = new Crypto()
          .getRandomValues(new Uint8Array(32))
          .toString()
        const [hashedPassword, salt] = hashPassword(generatedPass)
        const newUser = await this.dbUserAccessor.create({
          data: {
            email: userToken.email,
            username: userToken.email,
            hashedPassword,
            salt,
          },
        })

        const newOAuthRecord = await this.dbOAuthAccessor.create({
          data: {
            provider: provider.toUpperCase(),
            providerUserId: userToken.sub,
            userId: newUser.id,
          },
        })

        return this._createLinkAccountResponse(newOAuthRecord)
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
            provider: provider.toUpperCase(),
            providerUserId: userToken.sub,
            userId: currentUser.id,
          },
        })
        return this._createLinkAccountResponse(newOAuthRecord)
      }
    }
  }

  async linkGoogleAccount() {
    return this._linkProviderAccount('google')
  }

  async linkAppleAccount() {
    return this._linkProviderAccount('apple')
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

      const response = this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
        this.dbAuthHandlerInstance._ok(body, headers, options),
        corsHeaders
      )
      console.log('response', response)
      return response
    } catch (e: any) {
      return this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
        this.dbAuthHandlerInstance._badRequest(e.message || e),
        corsHeaders
      )
    }
  }
}
