import { DbAuthHandler, hashPassword } from '@redwoodjs/auth-dbauth-api'
import { normalizeRequest } from '@redwoodjs/api'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

import md5 from 'md5'
import { v4 as uuidv4 } from 'uuid'
import { getRandomValues } from 'crypto'

import * as OAuthError from './errors'

type Provider = 'apple' | 'github' | 'google'

interface IConnectedAccountRecord {
  provider: Provider
  providerUserId: string
  userId: string
  createdAt: Date
}

type ProviderMap = {
  [key in Provider]?: boolean
}
type EnabledForConfig = ProviderMap & {
  errors?: {
    providerNotEnabled?: string
  }
}

export interface OAuthHandlerOptions {
  /**
   * The name of the property you'd call on `db` to access your OAuth table.
   * ie. if your Prisma model is named `OAuth` this value would be `oAuth`, as in `db.oAuth`
   */
  oAuthModelAccessor: keyof PrismaClient

  enabledFor: EnabledForConfig

  login?: {
    errors?: {
      userNotFound?: string
    }
  }
  signup?: {
    errors?: {
      userExistsWithEmail?: string
    }
  }
  link?: {
    errors?: {
      userExistsWithEmail?: string
    }
  }
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
  | 'linkGitHubAccount'
  | 'linkGoogleAccount'
  | 'unlinkAccount'
  | 'loginWithApple'
  | 'loginWithGitHub'
  | 'loginWithGoogle'
  | 'signupWithApple'
  | 'signupWithGitHub'
  | 'signupWithGoogle'
  | 'getConnectedAccounts'

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

  db: PrismaClient

  // below are from options
  options: OAuthHandlerOptions

  /** class constant: list of methods that are supported */
  static get METHODS(): OAuthMethodNames[] {
    return [
      'linkAppleAccount',
      'linkGitHubAccount',
      'linkGoogleAccount',
      'unlinkAccount',
      'loginWithApple',
      'loginWithGitHub',
      'loginWithGoogle',
      'signupWithApple',
      'signupWithGitHub',
      'signupWithGoogle',
      'getConnectedAccounts',
    ]
  }

  /** class constant: maps the functions to their required HTTP verb for access */
  static get VERBS(): Record<OAuthMethodNames, 'GET' | 'POST' | 'DELETE'> {
    return {
      linkAppleAccount: 'GET',
      linkGitHubAccount: 'GET',
      linkGoogleAccount: 'GET',
      unlinkAccount: 'DELETE',
      loginWithApple: 'GET',
      loginWithGitHub: 'GET',
      loginWithGoogle: 'GET',
      signupWithApple: 'GET',
      signupWithGitHub: 'GET',
      signupWithGoogle: 'GET',
      getConnectedAccounts: 'GET',
    }
  }

  /** class constant: keep track of which methods return via a redirect */
  static get REDIRECT_METHODS(): Record<OAuthMethodNames, boolean> {
    return {
      linkAppleAccount: true,
      linkGitHubAccount: true,
      linkGoogleAccount: true,
      unlinkAccount: false,
      loginWithApple: true,
      loginWithGitHub: true,
      loginWithGoogle: true,
      signupWithApple: true,
      signupWithGitHub: true,
      signupWithGoogle: true,
      getConnectedAccounts: false,
    }
  }

  /** class constant: error message defaults */
  static get ERROR_MESSAGE_DEFAULTS() {
    return {
      // START section with errors that should never be seen by the user. If they are, it's likely a config issue.
      params: {
        NO_CODE_PROVIDED: 'No code parameter was provided',
        NO_STATE_PROVIDED: 'No state parameter was provided',
        NO_PROVIDER_PROVIDED: 'No provider parameter was provided',
      },

      unauthenticated: {
        NOT_LOGGED_IN: 'You must be logged in to perform this action.',
      },

      // END section with errors that should never be seen by the user.

      // START section with errors that should be configured as part of the DBAuthHandler setup, but we need defaults
      dbAuthHandlerErrors: {
        LOGIN_FLOW_NOT_ENABLED: 'Login flow is not enabled',
      },
      // END section with errors that should be configured as part of the DBAuthHandler setup

      // The remainder are errors that are likely to be seen by the user, and should be configured as part of the OAuthHandler setup
      login: {
        USER_NOT_FOUND:
          'No user found for this provider. Did you mean to sign up?',
      },

      signup: {
        USER_EXISTS_WITH_EMAIL:
          'There is already an account using this email. Did you mean to log in?',
      },

      link: {
        USER_EXISTS_WITH_EMAIL:
          'There is already an account linked to the email used for this provider.',
      },

      enabledFor: {
        PROVIDER_NOT_ENABLED: 'This provider is not enabled.',
      },
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
    this.options = options

    this.db = dbAuthHandlerInstance.db
    this.dbUserAccessor = dbAuthHandlerInstance.dbAccessor
    this.dbOAuthAccessor = this.db[options.oAuthModelAccessor]

    this.params = this.dbAuthHandlerInstance._parseBody()
  }

  _getCodeParam() {
    const code = this.params.code || this.event.queryStringParameters?.code

    if (!code || String(code).trim() === '') {
      throw new Error(
        OAuthHandler.ERROR_MESSAGE_DEFAULTS.params.NO_CODE_PROVIDED
      )
    }

    return code
  }

  _getStateParam(required = false) {
    const state = this.params.state || this.event.queryStringParameters?.state

    if (!state || String(state).trim() === '') {
      if (required) {
        throw new Error(
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.params.NO_STATE_PROVIDED
        )
      } else {
        return null
      }
    }

    return state
  }

  _getProviderParam(): Provider {
    const provider = this.params.provider

    if (!provider || String(provider).trim() === '') {
      throw new Error(
        OAuthHandler.ERROR_MESSAGE_DEFAULTS.params.NO_PROVIDER_PROVIDED
      )
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
      case 'github':
        url = 'https://github.com/login/oauth/access_token'
        client_id = process.env.GITHUB_CLIENT_ID || ''
        client_secret = process.env.GITHUB_CLIENT_SECRET || ''
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
    }).then((res) => {
      console.log('getTokenFromProvider response: ', res)
      return res.json()
    })

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
    body: any,
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

  _redirectToSiteWithError(errorMessage: string) {
    return this._redirectToSite(
      {},
      {},
      {
        oAuthError: errorMessage,
      }
    )
  }

  _linkAccountResponse(oAuthRecord: IConnectedAccountRecord) {
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

  _createUnlinkAccountResponse(oAuthRecord: IConnectedAccountRecord) {
    return [
      { providerRecord: oAuthRecord },
      {},
      {
        statusCode: 200,
      },
    ]
  }

  _createConnectedAccountsResponse(
    connectedAccountsRecords: IConnectedAccountRecord[]
  ) {
    return [
      connectedAccountsRecords,
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
        provider: provider,
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

    const newOAuthRecord = (await this.dbOAuthAccessor.create({
      data: {
        provider: provider,
        providerUserId: idToken.sub,
        userId: user[this.dbAuthHandlerInstance.options.authFields.id],
      },
    })) as IConnectedAccountRecord

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
      return this._redirectToSiteWithError('Error creating user')
    }

    // this is normally used just to link account to the user, but we want to log the user in
    await this._linkProviderToUser(idToken, newUser)

    return this._loginResponse(newUser)
  }

  async _linkProviderAccount() {
    this._verifyEnabledProvider()

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
      throw new Error(
        this.options.link?.errors?.userExistsWithEmail ||
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.link.USER_EXISTS_WITH_EMAIL
      )
    }
    // otherwise, link it to the current account.
    else {
      return await this._linkProviderToUser(idToken, currentUser)
    }
  }

  async _loginResponse(user: Record<string, any>) {
    if (this.dbAuthHandlerInstance.options.login.enabled === false) {
      throw new Error(
        (this.dbAuthHandlerInstance.options.login as any)?.errors
          ?.flowNotEnabled ||
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.dbAuthHandlerErrors
            .LOGIN_FLOW_NOT_ENABLED
      )
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
      throw new Error(
        this.options.login?.errors?.userNotFound ||
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.login.USER_NOT_FOUND
      )
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
        this.options.signup?.errors?.userExistsWithEmail ||
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.signup.USER_EXISTS_WITH_EMAIL
      )
    }
    // if there isn't, create a new user and link to that user.
    else {
      return await this._createUserLinkProviderAndLogIn(idToken)
    }
  }

  _verifyEnabledProvider() {
    const provider = this.params.provider as Provider

    if (!this.options.enabledFor[provider]) {
      throw new Error(
        this.options.enabledFor.errors?.providerNotEnabled ||
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.enabledFor.PROVIDER_NOT_ENABLED
      )
    }
  }

  async getConnectedAccounts() {
    const currentUser = await this.dbAuthHandlerInstance._getCurrentUser()

    if (!currentUser) {
      throw new Error(
        OAuthHandler.ERROR_MESSAGE_DEFAULTS.unauthenticated.NOT_LOGGED_IN
      )
    }

    const records = (await this.dbOAuthAccessor.findMany({
      where: {
        userId: currentUser[this.dbAuthHandlerInstance.options.authFields.id],
      },
    })) as IConnectedAccountRecord[]

    return this._createConnectedAccountsResponse(records)
  }

  async signupWithApple() {
    this.params.provider = 'apple'
    return this._signupWithProvider()
  }

  async signupWithGitHub() {
    this.params.provider = 'github'
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
  async loginWithGitHub() {
    this.params.provider = 'github'
    return this._loginWithProvider()
  }

  async loginWithGoogle() {
    this.params.provider = 'google'
    return this._loginWithProvider()
  }

  async linkAppleAccount() {
    this.params.provider = 'apple'
    return this._linkProviderAccount()
  }

  async linkGitHubAccount() {
    this.params.provider = 'github'
    return this._linkProviderAccount()
  }

  async linkGoogleAccount() {
    this.params.provider = 'google'
    return this._linkProviderAccount()
  }

  async unlinkAccount() {
    const provider = this._getProviderParam()

    const currentUser = await this.dbAuthHandlerInstance._getCurrentUser()

    const deletedRecord = (await this.dbOAuthAccessor.delete({
      where: {
        userId_provider: {
          userId: currentUser[this.dbAuthHandlerInstance.options.authFields.id],
          provider: provider,
        },
      },
    })) as IConnectedAccountRecord

    return this._createUnlinkAccountResponse(deletedRecord)
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
      // if there's an error, and the method is a redirect method, redirect to the site with the error message
      if (OAuthHandler.REDIRECT_METHODS[this._getOAuthMethod()]) {
        const [body, headers, options] = this._redirectToSiteWithError(
          e.message || e
        )
        return this.dbAuthHandlerInstance._ok(body, headers, options)
      } else {
        return this.dbAuthHandlerInstance._buildResponseWithCorsHeaders(
          this.dbAuthHandlerInstance._badRequest(e.message || e),
          corsHeaders
        )
      }
    }
  }
}
