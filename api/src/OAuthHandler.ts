import {
  DbAuthHandler,
  DbAuthHandlerOptions,
  hashPassword,
} from '@redwoodjs/auth-dbauth-api'
import { normalizeRequest } from '@redwoodjs/api'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

import md5 from 'md5'
import { v4 as uuidv4 } from 'uuid'
import { getRandomValues } from 'crypto'

import * as OAuthError from './errors'

type Provider = 'apple' | 'google'

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
  | 'linkAppleAccount'
  | 'linkGoogleAccount'
  | 'unlinkAccount'
  | 'loginWithApple'
  | 'loginWithGoogle'
  | 'signupWithApple'
  | 'signupWithGoogle'

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
    return [
      'linkAppleAccount',
      'linkGoogleAccount',
      'unlinkAccount',
      'loginWithApple',
      'loginWithGoogle',
      'signupWithApple',
      'signupWithGoogle',
    ]
  }

  // class constant: maps the functions to their required HTTP verb for access
  static get VERBS() {
    return {
      linkAppleAccount: 'GET',
      linkGoogleAccount: 'GET',
      unlinkAccount: 'DELETE',
      loginWithApple: 'GET',
      loginWithGoogle: 'GET',
      signupWithApple: 'GET',
      signupWithGoogle: 'GET',
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

  _getProviderParam(): Provider {
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

  async _getTokenFromProvider(): Promise<DecodedIdToken> {
    const code = this._getCodeParam()
    const provider = this._getProviderParam()

    let url
    let client_id
    let client_secret

    switch (provider) {
      case 'apple':
        url = 'https://appleid.apple.com/auth/token'
        client_id = process.env.APPLE_CLIENT_ID || ''
        client_secret = this._getAppleAuthClientSecret()
        break
      case 'google':
        url = 'https://oauth2.googleapis.com/token'
        client_id = process.env.GOOGLE_CLIENT_ID || ''
        client_secret = process.env.GOOGLE_CLIENT_SECRET || ''
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
    const values = {
      code,
      client_id,
      client_secret,
      redirect_uri: `${
        process.env.RWJS_API_URL
      }/auth/oauth?method=${this._getOAuthMethod()}`, // this needs to be the exact same as the one used to get the code
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

  _redirectToSite(
    body: unknown,
    headers: Record<string, unknown> = {},
    queryParams: Record<string, string> = {}
  ) {
    // If this exists, it should be a redirect back to the app
    const redirectBackUrl = this._getStateParam() || process.env.FE_URL

    const queryString = new URLSearchParams(queryParams).toString()
    return [
      body,
      {
        location: `${redirectBackUrl}${queryString && '?'}${queryString}`,
        ...headers,
      },
      {
        statusCode: 303,
      },
    ]
  }

  _linkAccountResponse(oAuthRecord: { provider: string }) {
    return this._redirectToSite(
      oAuthRecord,
      {},
      { linkedAccount: oAuthRecord.provider.toLowerCase() }
    )
  }

  _loginResponseWithRedirect(user: Record<string, any>) {
    const sessionData = {
      id: user[this.dbAuthHandlerInstance.options.authFields.id],
    }

    const csrfToken = DbAuthHandler.CSRF_TOKEN

    return this._redirectToSite(sessionData, {
      'csrf-token': csrfToken,
      ...this.dbAuthHandlerInstance._createSessionHeader(
        sessionData,
        csrfToken
      ),
    })
  }

  _createUnlinkAccountResponse(oAuthRecord: any) {
    return [
      oAuthRecord,
      {},
      {
        statusCode: 200,
      },
    ]
  }

  /**
   * In case the user model records the email, either as the configured username
   * field or as an explicit 'email' field, we need
   * to check if the email is already claimed by another user.
   */
  async _getUserByEmail(email: string): Promise<Record<string, any> | null> {
    let maybeExistingUser

    maybeExistingUser = await this.dbUserAccessor.findFirst({
      where: {
        [this.dbAuthHandlerInstance.options.authFields.username]: email,
      },
    })

    if (maybeExistingUser) {
      return maybeExistingUser
    }

    // if that didn't work, try to find a user with an explicit email field
    // do this in a try/catch because the email field might not exist
    try {
      maybeExistingUser = await this.dbUserAccessor.findFirst({
        where: { email: email },
      })
    } catch {
      maybeExistingUser = null
    }
    return maybeExistingUser
  }

  async _getUserByProviderUserId(
    providerUserId: string
  ): Promise<Record<string, any> | null> {
    const provider = this._getProviderParam()

    const oAuthRecord = await this.dbOAuthAccessor.findFirst({
      where: {
        provider: provider.toUpperCase(),
        providerUserId: providerUserId,
      },
    })

    if (oAuthRecord) {
      const user = await this.dbUserAccessor.findUnique({
        where: {
          [this.dbAuthHandlerInstance.options.authFields.id]:
            oAuthRecord.userId,
        },
      })

      return user
    }

    return null
  }

  async _linkProviderToUser(
    idToken: DecodedIdToken,
    user: Record<string, any>
  ) {
    const provider = this._getProviderParam()

    const newOAuthRecord = await this.dbOAuthAccessor.create({
      data: {
        provider: provider.toUpperCase(),
        providerUserId: idToken.sub,
        userId: user[this.dbAuthHandlerInstance.options.authFields.id],
      },
    })

    return this._linkAccountResponse(newOAuthRecord)
  }

  async _createUserLinkProviderAndLogIn(idToken: DecodedIdToken) {
    const generatedPass = getRandomValues(new Uint8Array(32)).toString()
    const [hashedPassword, salt] = hashPassword(generatedPass)

    const usesEmailAsUsername =
      this.dbAuthHandlerInstance.options.authFields.username === 'email'

    let newUser: Record<string, any>
    if (usesEmailAsUsername) {
      newUser = await this.dbUserAccessor.create({
        data: {
          email: idToken.email,
          hashedPassword,
          salt,
        },
      })
    } else {
      const username_uniquifier = md5(uuidv4())
      const newUsername =
        idToken.email.split('@')[0] + '_' + username_uniquifier

      // try to save the user's email as a field on the user model, which might not exist
      try {
        newUser = await this.dbUserAccessor.create({
          data: {
            [this.dbAuthHandlerInstance.options.authFields.username]:
              newUsername,
            email: idToken.email,
            hashedPassword,
            salt,
          },
        })
      } catch {
        // if that didn't work, just save the username
        newUser = await this.dbUserAccessor.create({
          data: {
            [this.dbAuthHandlerInstance.options.authFields.username]:
              newUsername,
            hashedPassword,
            salt,
          },
        })
      }
    }
    if (!newUser) {
      throw new Error('Unable to create new user')
    }

    // this is normally used just to link account to the user, but we want to log the user in
    await this._linkProviderToUser(idToken, newUser)

    return this._loginResponse(newUser)
  }

  async _linkProviderAccount() {
    const idToken = await this._getTokenFromProvider()

    let currentUser

    // this is handled the same way as DbAuthHandler.getToken()
    try {
      currentUser = await this.dbAuthHandlerInstance._getCurrentUser()
    } catch (e: any) {
      if (e.name === 'NotLoggedInError') {
        return this.dbAuthHandlerInstance._logoutResponse()
      } else {
        return this.dbAuthHandlerInstance._logoutResponse({ error: e.message })
      }
    }

    // check if there is already a user with this email.
    const maybeExistingUser = await this._getUserByEmail(idToken.email)

    // if there's already a user with this email, check if it's the same as the user that's logged in - if it's not, throw an error that there's already an account using this email.
    if (maybeExistingUser && maybeExistingUser.email !== currentUser.email) {
      throw new Error('There is already an account using this email.')
    }
    // otherwise, link it to the current account.
    else {
      return await this._linkProviderToUser(idToken, currentUser)
    }
  }

  async linkAppleAccount() {
    this.params.provider = 'apple'
    return this._linkProviderAccount()
  }

  async linkGoogleAccount() {
    this.params.provider = 'google'
    return this._linkProviderAccount()
  }

  async unlinkAccount() {
    const provider = this._getProviderParam()

    const currentUser = await this.dbAuthHandlerInstance._getCurrentUser()

    const deletedRecord = await this.dbOAuthAccessor.delete({
      where: {
        userId_provider: {
          userId: currentUser.id,
          provider: provider.toUpperCase(),
        },
      },
    })

    return this._createUnlinkAccountResponse(deletedRecord)
  }

  async _loginResponse(user: Record<string, any>) {
    if (this.dbAuthHandlerInstance.options.login.enabled === false) {
      throw new Error('Login is not enabled')
    }

    // the below is straight from the DBAuthHandler's login() method
    const handlerUser = await this.dbAuthHandlerInstance.options.login.handler(
      user as TUser
    )

    if (
      handlerUser == null ||
      handlerUser[this.dbAuthHandlerInstance.options.authFields.id] == null
    ) {
      throw new OAuthError.NoUserIdError()
    }

    return this._loginResponseWithRedirect(handlerUser)
  }

  async _loginWithProvider() {
    const idToken = await this._getTokenFromProvider()
    const user = await this._getUserByProviderUserId(idToken.sub)

    if (!user) {
      throw new Error('No user found for this provider user id')
    }

    return this._loginResponse(user)
  }

  async _signupWithProvider() {
    const idToken = await this._getTokenFromProvider()

    // check if there is already a user with this email.
    const maybeExistingUser = await this._getUserByEmail(idToken.email)

    // if there's already a user with this email, but no user is currently logged in, throw an error that there's already an account using this email.
    if (maybeExistingUser) {
      throw new Error(
        "There is already an account using this email. If that's you, please log in and link your account."
      )
    }
    // if there isn't, create a new user and link to that user.
    else {
      return await this._createUserLinkProviderAndLogIn(idToken)
    }
  }

  async signupWithApple() {
    this.params.provider = 'apple'
    return this._signupWithProvider()
  }

  async signupWithGoogle() {
    this.params.provider = 'google'
    return this._signupWithProvider()
  }

  async loginWithApple() {
    this.params.provider = 'apple'
    return this._loginWithProvider()
  }

  async loginWithGoogle() {
    this.params.provider = 'google'
    return this._loginWithProvider()
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
