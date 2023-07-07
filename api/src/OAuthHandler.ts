import { DbAuthHandler } from '@redwoodjs/auth-dbauth-api'
import { normalizeRequest } from '@redwoodjs/api'
import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

import md5 from 'md5'
import { v4 as uuidv4 } from 'uuid'

import * as OAuthError from './errors'

import type {
  Provider,
  EnabledForConfig,
  IDecodedIdToken,
  IUserInfo,
  IGitHubUserInfo,
  IConnectedAccountRecord,
} from './types'

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

// there are defaults for each (static, non parameterized) error, but many can be overridden via options.
// the below types are used to determine which sections and errors are available.
type TOptionsSections = keyof OAuthHandlerOptions
type TMaybeError = Record<string, string> | undefined
type TMaybeErrors = { errors?: Record<string, string> } | undefined
type TErrorSections = keyof typeof OAuthHandler.ERROR_MESSAGE_DEFAULTS
type TAllErrorSections = TOptionsSections | TErrorSections

type TErrorKey = {
  [K in keyof (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS']]: (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS'][K] extends object
    ? keyof (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS'][K]
    : never
}[keyof (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS']]

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
  options: OAuthHandlerOptions

  event: APIGatewayProxyEvent
  context: LambdaContext
  dbAuthHandlerInstance: DbAuthHandler<TUser, TIdType>

  params: Params

  db: PrismaClient
  dbUserAccessor: any
  dbOAuthAccessor: any

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

  /**
   * class constant: keep track of which methods return via a redirect. This is especially
   * important for error handling, as we need to know whether to return via a redirect or a JSON response.
   */
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

  /**
   * class constant: maps the provider names to the strategy that we should use to authenticate the user.
   * All of these technically support OAuth2 (as OIDC is built on OAuth2), so in this context supporting it means that they have
   * an endpoint that we can use to get the user's profile information.
   * Additionally, supporting OpenID Connect means that they have an endpoint that we can use to get
   * the user's Identity Token, which is a JWT that contains information about the user.
   */
  static get PROFILE_INFO_STRATEGY(): Record<Provider, 'oauth2' | 'oidc'> {
    return {
      // only supports oidc
      apple: 'oidc',
      // supports both oauth2 and oidc
      google: 'oidc',
      // only supports oauth2
      github: 'oauth2',
    }
  }

  /** class constant: error message defaults */
  static get ERROR_MESSAGE_DEFAULTS() {
    return {
      // START section with errors that should never be seen by the user. If they are, it's likely a config issue.
      params: {
        noCodeProvided: 'No code parameter was provided',
        noStateProvided: 'No state parameter was provided',
        noProviderProvided: 'No provider parameter was provided',
      },

      unauthenticated: {
        notLoggedIn: 'You must be logged in to perform this action.',
      },

      // END section with errors that should never be seen by the user.

      // START section with errors that should be configured as part of the DBAuthHandler setup, but we need defaults
      dbAuthHandlerErrors: {
        loginFlowNotEnabled: 'Login flow is not enabled',
      },
      // END section with errors that should be configured as part of the DBAuthHandler setup

      // The remainder are errors that are likely to be seen by the user, and should be configured as part of the OAuthHandler setup
      login: {
        userNotFound:
          'No user found for this provider. Did you mean to sign up?',
      },

      signup: {
        userExistsWithEmail:
          'There is already an account using this email. Did you mean to log in?',
        alreadyLoggedIn:
          'You are already logged in. Please log out before signing up.',
      },

      link: {
        userExistsWithEmail:
          'There is already an account linked to the email used for this provider.',
      },

      enabledFor: {
        providerNotEnabled: 'This provider is not enabled.',
      },
    }
  }

  _getErrorMessage(sectionKey: TAllErrorSections, errorKey: TErrorKey): string {
    // Check if the error message is configured
    let configuredMessage = (
      this.options[sectionKey as TOptionsSections] as TMaybeErrors
    )?.errors?.[errorKey]

    // If the configured message is not found, use the default message
    if (!configuredMessage) {
      configuredMessage = (
        OAuthHandler.ERROR_MESSAGE_DEFAULTS[
          sectionKey as TErrorSections
        ] as TMaybeError
      )?.[errorKey]
    }

    // If the message is still not found, throw an error or return a generic message
    if (!configuredMessage) {
      throw new Error(
        `No error message found for section "${sectionKey}" and error "${errorKey}"`
      )
    }

    return configuredMessage
  }

  /** START section on event/param parsing */

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

  _getCodeParam() {
    const code = this.params.code || this.event.queryStringParameters?.code

    if (!code || String(code).trim() === '') {
      throw new Error(this._getErrorMessage('params', 'noCodeProvided'))
    }

    return code
  }

  _getStateParam(required = false) {
    const state = this.params.state || this.event.queryStringParameters?.state

    if (!state || String(state).trim() === '') {
      if (required) {
        throw new Error(this._getErrorMessage('params', 'noStateProvided'))
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
        OAuthHandler.ERROR_MESSAGE_DEFAULTS.params.noProviderProvided
      )
    }

    return provider
  }

  /** A wrapper around the one from dbAuthHandler, except it returns null instead of error if it's not logged in */
  async _getCurrentUser(): Promise<any | null> {
    try {
      const user = await this.dbAuthHandlerInstance._getCurrentUser()
      return user
    } catch (e: any) {
      if (e.name === 'NotLoggedInError') {
        return null
      } else {
        throw e
      }
    }
  }

  /** END section on event/param parsing */

  constructor(
    event: APIGatewayProxyEvent,
    context: LambdaContext,
    dbAuthHandlerInstance: DbAuthHandler<TUser, TIdType>,
    options: OAuthHandlerOptions
  ) {
    this.options = options

    this.event = event
    this.context = context
    this.dbAuthHandlerInstance = dbAuthHandlerInstance

    this.params = this.dbAuthHandlerInstance._parseBody()

    this.db = dbAuthHandlerInstance.db
    this.dbUserAccessor = dbAuthHandlerInstance.dbAccessor
    this.dbOAuthAccessor = this.db[options.oAuthModelAccessor]
  }

  /** START section on validators/verifiers */

  /**
   *  Verifies a decoded OpenID Connect ID token
   *  @returns the decoded token if it's valid, otherwise throws an error
   * */
  _verifyIdToken(token: IDecodedIdToken): IDecodedIdToken {
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

  _verifyEnabledProvider() {
    const provider = this.params.provider as Provider

    if (!this.options.enabledFor[provider]) {
      throw new Error(this._getErrorMessage('enabledFor', 'providerNotEnabled'))
    }
  }

  async _validateSignup(userInfo: IUserInfo) {
    const currentUser = await this._getCurrentUser()
    if (currentUser) {
      throw new Error(this._getErrorMessage('signup', 'alreadyLoggedIn'))
    }

    const maybeExistingUserWithProviderUid =
      await this._getUserByProviderUserId(userInfo.uid)
    const maybeExistingUserWithEmail = await this._getUserByEmail(
      userInfo.email
    )
  }

  /** END section on validators/verifiers */

  /** START section on provider communication */

  async _getUserInfoFromProvider(): Promise<IUserInfo> {
    const provider = this._getProviderParam()

    if (OAuthHandler.PROFILE_INFO_STRATEGY[provider] === 'oidc') {
      return await this._getUserInfoFromProviderTokenEndpoint()
    } else if (OAuthHandler.PROFILE_INFO_STRATEGY[provider] === 'oauth2') {
      return await this._getUserInfoFromProviderUserEndpoint()
    } else {
      throw new Error(`No profile info strategy found for provider ${provider}`)
    }
  }

  async _getUserInfoFromProviderUserEndpoint(): Promise<IUserInfo> {
    const code = this._getCodeParam()
    const provider = this._getProviderParam()

    let access_token_url
    let user_info_url
    let client_id
    let client_secret

    switch (provider) {
      case 'github':
        access_token_url = 'https://github.com/login/oauth/access_token'
        user_info_url = 'https://api.github.com/user'
        client_id = process.env.GITHUB_CLIENT_ID || ''
        client_secret = process.env.GITHUB_CLIENT_SECRET || ''
        break
      default:
        throw new Error(
          `Provider '${provider}' does not support getting user info. Did you mean to use getIDTokenFromProvider?`
        )
    }

    const values = {
      code,
      client_id,
      client_secret,
      redirect_uri: `${
        process.env.RWJS_API_URL
      }/auth/oauth?method=${this._getOAuthMethod()}`, // this needs to be the exact same as the one used to get the code
    }

    const access_token = await fetch(access_token_url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(values),
    }).then(async (res) => {
      const { access_token, scope, error } = JSON.parse(await res.text())
      if (error) {
        throw new Error(error)
      }

      // this might be specific to GitHub, so probably generalize it if we add more providers
      if (!scope.includes('user:email')) {
        throw new Error(
          'The user:email scope is required to get the user email from GitHub.'
        )
      }
      if (!scope.includes('read:user')) {
        throw new Error(
          'The read:user scope is required to get the user info from GitHub.'
        )
      }

      return access_token
    })

    const userInfo = await fetch(user_info_url, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const body = JSON.parse(await userInfo.text()) as IGitHubUserInfo

    switch (provider) {
      case 'github':
        return {
          uid: String(body.id),
          email: body.email,
          providerUsername: body.login,
        }
      default:
        throw new Error(
          `There is no transformer for the user info from provider '${provider}. Are you sure this provider is supported?`
        )
    }
  }

  /**
   * For providers that support OpenID Connect, this method will verify the ID token and return the decoded token
   */
  async _getUserInfoFromProviderTokenEndpoint(): Promise<IUserInfo> {
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
        throw new Error(
          `Provider '${provider}' does not support OpenID Connect`
        )
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
      console.log('getIdTokenFromProvider response: ', res)
      return res.json()
    })

    if (response.id_token) {
      const idTokenDecoded = this._verifyIdToken(
        jwt.decode(response.id_token) as IDecodedIdToken
      )

      switch (provider) {
        case 'apple':
          return {
            uid: idTokenDecoded.sub,
            email: idTokenDecoded.email,
            providerUsername: idTokenDecoded.email,
          }
        case 'google':
          return {
            uid: idTokenDecoded.sub,
            email: idTokenDecoded.email,
            providerUsername: idTokenDecoded.email,
          }
        default:
          throw new Error(
            `There is no transformer for the user info from provider '${provider}. Are you sure this provider is supported?`
          )
      }
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

  /** END section on provider communication */

  /** START section on request response helpers */

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

  async _loginResponse(user: Record<string, any>) {
    if (this.dbAuthHandlerInstance.options.login.enabled === false) {
      // this doesn't use this._getErrorMessage because it's a DbAuthHandler error, not an OAuthHandler error
      throw new Error(
        (this.dbAuthHandlerInstance.options.login as any)?.errors
          ?.flowNotEnabled ||
          OAuthHandler.ERROR_MESSAGE_DEFAULTS.dbAuthHandlerErrors
            .loginFlowNotEnabled
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

  /** END section on request response helpers */

  /** START section on database communication */

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

  async _linkProviderToUser(userInfo: IUserInfo, user: Record<string, any>) {
    const provider = this._getProviderParam()

    const newOAuthRecord = (await this.dbOAuthAccessor.create({
      data: {
        provider: provider,
        providerUserId: userInfo.uid,
        userId: user[this.dbAuthHandlerInstance.options.authFields.id],
        providerUsername: userInfo.providerUsername,
      },
    })) as IConnectedAccountRecord

    return this._linkAccountResponse(newOAuthRecord)
  }

  /** END section on database communication */

  /** START section on workload grouping */

  async _createUserLinkProviderAndLogIn(userInfo: IUserInfo) {
    const usesEmailAsUsername =
      this.dbAuthHandlerInstance.options.authFields.username === 'email'

    let newUser: Record<string, any>
    if (usesEmailAsUsername) {
      newUser = await this.dbUserAccessor.create({
        data: {
          email: userInfo.email,
        },
      })
    } else {
      const username_uniquifier = md5(uuidv4())
      const newUsername =
        userInfo.email.split('@')[0] + '_' + username_uniquifier

      // try to save the user's email as a field on the user model, which might not exist
      try {
        newUser = await this.dbUserAccessor.create({
          data: {
            [this.dbAuthHandlerInstance.options.authFields.username]:
              newUsername,
            email: userInfo.email,
          },
        })
      } catch {
        // if that didn't work, just save the username
        newUser = await this.dbUserAccessor.create({
          data: {
            [this.dbAuthHandlerInstance.options.authFields.username]:
              newUsername,
          },
        })
      }
    }
    if (!newUser) {
      return this._redirectToSiteWithError('Error creating user')
    }

    // this is normally used just to link account to the user, but we want to log the user in
    await this._linkProviderToUser(userInfo, newUser)

    return this._loginResponse(newUser)
  }

  async _linkProviderAccount() {
    this._verifyEnabledProvider()

    const userInfo = await this._getUserInfoFromProvider()

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
    const maybeExistingUser = await this._getUserByEmail(userInfo.email)

    // if there's already a user with this email, check if it's the same as the user that's logged in - if it's not, throw an error that there's already an account using this email.
    if (maybeExistingUser && maybeExistingUser.email !== currentUser.email) {
      throw new Error(this._getErrorMessage('link', 'userExistsWithEmail'))
    }
    // otherwise, link it to the current account.
    else {
      return await this._linkProviderToUser(userInfo, currentUser)
    }
  }

  /** END  section on workload grouping */

  async _loginWithProvider() {
    const userInfo = await this._getUserInfoFromProvider()
    const user = await this._getUserByProviderUserId(userInfo.uid)

    if (!user) {
      throw new Error(this._getErrorMessage('login', 'userNotFound'))
    }

    return this._loginResponse(user)
  }

  async _signupWithProvider() {
    const userInfo = await this._getUserInfoFromProvider()

    // check if there is already a user with this email.
    const maybeExistingUser = await this._getUserByEmail(userInfo.email)

    // if there's already a user with this email, but no user is currently logged in, throw an error that there's already an account using this email.
    if (maybeExistingUser) {
      throw new Error(this._getErrorMessage('signup', 'userExistsWithEmail'))
    }
    // if there isn't, create a new user and link to that user.
    else {
      return await this._createUserLinkProviderAndLogIn(userInfo)
    }
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

  async getConnectedAccounts() {
    const currentUser = await this.dbAuthHandlerInstance._getCurrentUser()

    if (!currentUser) {
      throw new Error(this._getErrorMessage('unauthenticated', 'notLoggedIn'))
    }

    const records = (await this.dbOAuthAccessor.findMany({
      where: {
        userId: currentUser[this.dbAuthHandlerInstance.options.authFields.id],
      },
    })) as IConnectedAccountRecord[]

    return this._createConnectedAccountsResponse(records)
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
