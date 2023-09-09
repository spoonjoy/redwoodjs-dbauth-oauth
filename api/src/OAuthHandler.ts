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
  EnabledProvidersConfig,
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

  /** To enable a provider on the API side, you must include in the name of the provider with the value `true. */
  enabledProviders: EnabledProvidersConfig

  login?: {
    /** Customize any error messages by including a string value here for the given key. */
    errors?: {
      userNotFound?: string
    }
  }
  signup?: {
    /** Customize any error messages by including a string value here for the given key. */
    errors?: {
      userExistsWithEmail?: string
      userExistsFromProvider?: string
      alreadyLoggedIn?: string
      createUserError?: string
    }
  }
  link?: {
    /** Customize any error messages by including a string value here for the given key. */
    errors?: {
      userExistsWithEmail?: string
      userExistsFromProvider?: string
      notLoggedIn?: string
    }
  }

  unlink?: {
    /** Customize any error messages by including a string value here for the given key. */
    errors?: {
      noPassword?: string
    }
  }
}

// there are defaults for each (static, non parameterized) error, but many can be overridden via options.
// the below types are used to determine which sections and errors are available.
/** Every configurable section. */
type TOptionsSections = keyof OAuthHandlerOptions
/** A type to represent a situation where an error message value might exist (for defaults). */
type TMaybeError = Record<string, string> | undefined
/** A type to represent a situation where an error message values might exist (for a given section in options). */
type TMaybeErrors = { errors?: Record<string, string> } | undefined
/** Every error section that contains default error messages. */
type TErrorSections = keyof typeof OAuthHandler.ERROR_MESSAGE_DEFAULTS
/** Every section that might have errors, it includes a union of sections from 'options' as well as from the list of default errors. */
type TAllErrorSections = TOptionsSections | TErrorSections
/** All error message keys - his will include *all* error message keys, and no type enforcement exists for making sure that it's for the correct section. */
type TErrorKey = {
  [K in keyof (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS']]: (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS'][K] extends object
    ? keyof (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS'][K]
    : never
}[keyof (typeof OAuthHandler)['ERROR_MESSAGE_DEFAULTS']]

/** A list of methods that this API can be called with. */
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

/** Type of all class-level parameters. Includes known and unknown parameters - any required params are included here. */
type Params = {
  code?: string
  state?: string
  provider?: Provider
  method: OAuthMethodNames
  [key: string]: any
}

/** Class that will be created and invoked when the proper endpoint is called. All execution kicks off from the `invoke()` class function. */
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
      linkAppleAccount: 'POST',
      linkGitHubAccount: 'GET',
      linkGoogleAccount: 'GET',
      unlinkAccount: 'DELETE',
      loginWithApple: 'POST',
      loginWithGitHub: 'GET',
      loginWithGoogle: 'GET',
      signupWithApple: 'POST',
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

  /** class constant: error message defaults. many of these can also be configured during setup, and will use these values as fallbacks. */
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
        userExistsFromProvider:
          "The account you're trying to use is already signed up. Did you mean to log in?",
        alreadyLoggedIn:
          'You are already logged in. Please log out before signing up.',
        createUserError:
          'There was an error creating your account. Please try again.',
      },

      link: {
        userExistsWithEmail:
          'There is already an account linked to the email used for this provider.',
        userExistsFromProvider:
          "The account you're trying to link is already linked to another account.",
        notLoggedIn: 'You must be logged in to link an account.',
      },

      unlink: {
        noPassword: 'You must have a password to have no linked accounts.',
      },

      enabledProviders: {
        providerNotEnabled: 'This provider is not enabled.',
      },
    }
  }

  /**
   * Get the error message for a given section and error type. Will first attempt to get it from
   * the config, and then fall back to the default value. If the default value is not found,
   * it will throw an error.
   * @returns The error message for the given section and error type (if found).
   */
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

  /** Gets the requested method from the API call. */
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

  /** Gets the `code` param, and throws an error if it's not found. */
  _getCodeParam() {
    const code = this.params.code || this.event.queryStringParameters?.code

    if (!code || String(code).trim() === '') {
      throw new Error(this._getErrorMessage('params', 'noCodeProvided'))
    }

    return code
  }

  /** Gets the `state` param, and throws an error if it's not found. */
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

  /** Gets the `provider` param, and throws an error if it's not found. */
  _getProviderParam(): Provider {
    const provider = this.params.provider

    if (!provider || String(provider).trim() === '') {
      throw new Error(
        OAuthHandler.ERROR_MESSAGE_DEFAULTS.params.noProviderProvided
      )
    }

    return provider
  }

  /** END section on event/param parsing */

  /**
   * @param event - The event object from the handler
   * @param context - The context object from the handler
   * @param dbAuthHandlerInstance - An instance of the DbAuthHandler class, which should be instantiated in the handler before this class (and then passed into this class)
   * @param options - The options for the OAuthHandler
   */
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

  /**
   * Verifies that the requested provider is enabled via config
   * @returns `true` if the provider is enabled, otherwise throws an error
   */
  _verifyEnabledProvider() {
    const provider = this.params.provider as Provider

    if (!this.options.enabledProviders[provider]) {
      throw new Error(
        this._getErrorMessage('enabledProviders', 'providerNotEnabled')
      )
    }
  }

  /**
   * Validates that the signup can proceed.
   * @returns `true` if the signup can proceed, otherwise throws one of the `signup` errors.
   */
  async _validateSignup(userInfo: IUserInfo) {
    const currentUser = await this._getCurrentUser()
    if (currentUser) {
      throw new Error(this._getErrorMessage('signup', 'alreadyLoggedIn'))
    }

    const maybeExistingUserWithProviderUid =
      await this._getUserByProviderUserId(userInfo.uid)
    if (maybeExistingUserWithProviderUid) {
      throw new Error(this._getErrorMessage('signup', 'userExistsFromProvider'))
    }

    const maybeExistingUserWithEmail = await this._getUserByEmail(
      userInfo.email
    )
    if (maybeExistingUserWithEmail) {
      throw new Error(this._getErrorMessage('signup', 'userExistsWithEmail'))
    }

    return true
  }

  /**
   * Validates that the account linking can proceed.
   * @returns `true` if the account linking can proceed, otherwise throws one of the `link` errors.
   */
  async _validateLink(userInfo: IUserInfo) {
    const currentUser = await this._getCurrentUser()

    if (!currentUser) {
      throw new Error(this._getErrorMessage('link', 'notLoggedIn'))
    }

    const maybeExistingUserWithProviderUid =
      await this._getUserByProviderUserId(userInfo.uid)
    if (maybeExistingUserWithProviderUid) {
      throw new Error(this._getErrorMessage('link', 'userExistsFromProvider'))
    }

    const maybeExistingUser = await this._getUserByEmail(userInfo.email)
    // if there's already a user with this email, check if it's the same as the user that's logged in - if it's not, throw an error that there's already an account using this email.
    if (
      maybeExistingUser &&
      maybeExistingUser[this.dbAuthHandlerInstance.options.authFields.id] !==
        currentUser[this.dbAuthHandlerInstance.options.authFields.id]
    ) {
      throw new Error(this._getErrorMessage('link', 'userExistsWithEmail'))
    }

    return true
  }

  async _validateUnlink(currentUser: Record<string, any>) {
    // if they have multiple providers, they can unlink
    const records = await this._getConnectedAccountsForUser(currentUser)
    if (records.length > 1) {
      return true
    }

    // if they have only one provider, and they have no password, they can't unlink
    const hasPassword = await this._getUserHasPassword(currentUser)
    if (hasPassword) {
      return true
    } else {
      throw new Error(this._getErrorMessage('unlink', 'noPassword'))
    }
  }

  /** END section on validators/verifiers */

  /** START section on provider communication */

  /**
   * Gets the user info from the provider by checking the strategy for the provider and calls the appropriate method.
   * @returns the user info from the provider, or throws an error if the strategy is not found.
   */
  async _getUserInfoFromProvider(): Promise<IUserInfo> {
    this._verifyEnabledProvider()

    const provider = this._getProviderParam()

    if (OAuthHandler.PROFILE_INFO_STRATEGY[provider] === 'oidc') {
      return await this._getUserInfoFromProviderTokenEndpoint()
    } else if (OAuthHandler.PROFILE_INFO_STRATEGY[provider] === 'oauth2') {
      return await this._getUserInfoFromProviderUserEndpoint()
    } else {
      throw new Error(`No profile info strategy found for provider ${provider}`)
    }
  }

  /**
   * Gets the user info from the provider by using the code to request an access token,
   * and then using the access token to call the user info endpoint.
   * This should never be called directly, always call `_getUserInfoFromProvider`.
   * @returns the user info from the provider
   */
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
   * Gets the user info from the provider via the OpenID Connect token endpoint by
   * using the code to request the id_token, and then decodes it to get the user info.
   * This should never be called directly, always call `_getUserInfoFromProvider`.
   * @returns the user info extracted from the decoded id_token.
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

  /**
   * Creates the client secret for Apple auth - unlike other providers, Apple doesn't just
   * use a client secret, but requires a JWT token to be created and signed with a private key.
   * More info here: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
   * @returns the client secret for Apple auth.
   */
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

  /**
   * Use this as the API handler response when you don't want to throw an error.
   * @param body the body of the response.
   * @param headers any headers to add to the response.
   * @param options any options to add to the response (e.g. statusCode, which defaults to 200).
   */
  _ok(body: string, headers = {}, options = { statusCode: 200 }) {
    return {
      statusCode: options.statusCode,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
    }
  }

  /**
   * Use this to create the parameters to pass to _ok when you want to redirect back to the app.
   * This is a valid response for a given method, but not for the API endpoint.
   * @param body the body of the response.
   * @param headers any headers to add to the response (*NOT* including `location`, which is included automatically).
   * @param queryParams any query params to add to the redirect URL.
   */
  _redirectToSite(
    body: any,
    headers: Record<string, unknown> = {},
    queryParams: Record<string, string> = {}
  ) {
    // If this exists, it should be a redirect back to the app
    const redirectBackUrl = this._getStateParam() || process.env.FE_URL || ''

    // Create a URL object from the redirect back URL
    const url = new URL(redirectBackUrl)

    // Check if 'oAuthError' is in queryParams
    if ('oAuthError' in queryParams) {
      // Clear any existing search parameters
      url.search = ''
    }

    // Create a URLSearchParams object from the new query parameters
    const queryString = new URLSearchParams(queryParams).toString()

    // If url already has query parameters, append with '&' else append with '?'
    url.search += (url.search ? '&' : '?') + queryString

    return [
      body,
      {
        location: url.toString(),
        ...headers,
      },
      {
        statusCode: 303,
      },
    ]
  }

  /**
   * Use this to create the parameters to pass to _ok when you want to redirect back to the app with an error.
   * @param errorMessage the error message to return to the app. Will be added to the query params.
   */
  _redirectToSiteWithError(errorMessage: string) {
    return this._redirectToSite(
      {},
      {},
      {
        oAuthError: errorMessage,
      }
    )
  }

  /**
   * Use this to create the parameters to pass to _ok when you want to redirect back to the app with the newly linked account information.
   * This is a valid response for a given method, but not for the API endpoint.
   * @param oAuthRecord the new oAuthRecord that was created.
   */
  _linkAccountResponse(oAuthRecord: IConnectedAccountRecord) {
    return this._redirectToSite(
      oAuthRecord,
      {},
      { linkedAccount: oAuthRecord.provider.toLowerCase() }
    )
  }

  /**
   * Use this to create the parameters to pass to _ok when you want to redirect back to the app
   * and log in the user.
   * This is a valid response for a given method, but not for the API endpoint.
   * It's based on the DBAuthHandler's login() method, which allows a
   * configured `login.handler` to be used. See the dbAuth docs for more info.
   * @param user the user to log in.
   */
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

    const sessionData = {
      id: handlerUser[this.dbAuthHandlerInstance.options.authFields.id],
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

  /**
   * Use this to create the parameters to pass to _ok when unlinking an account.
   * This is a valid response for a given method, but not for the API endpoint.
   * @param oAuthRecord the oAuthRecord that was unlinked.
   */
  _createUnlinkAccountResponse(oAuthRecord: IConnectedAccountRecord) {
    return [{ providerRecord: oAuthRecord }]
  }

  /**
   * Use this to create the parameters to pass to _ok when getting the list of connected accounts.
   * This is a valid response for a given method, but not for the API endpoint.
   * @param connectedAccountsRecords the list of connected accounts.
   */
  _createConnectedAccountsResponse(
    connectedAccountsRecords: IConnectedAccountRecord[]
  ) {
    return [connectedAccountsRecords]
  }

  /** END section on request response helpers */

  /** START section on database communication */

  /**
   * Wrapped aroundthe one from dbAuthHandler, except it returns null instead of
   * error if it's not logged in.
   */
  async _getCurrentUser(): Promise<Record<string, any> | null> {
    try {
      const user = await this.dbAuthHandlerInstance._getCurrentUser()
      return user as Record<string, any>
    } catch (e: any) {
      if (e.name === 'NotLoggedInError') {
        return null
      } else {
        throw e
      }
    }
  }

  /** Gets whether the current user has a password. */
  async _getUserHasPassword(user: Record<string, any>): Promise<boolean> {
    const idAuthField = this.dbAuthHandlerInstance.options.authFields.id
    const hashedPassAuthField =
      this.dbAuthHandlerInstance.options.authFields.hashedPassword

    const userWithHashedPass = await this.dbUserAccessor.findUnique({
      where: {
        [idAuthField]: user[idAuthField],
      },
      select: {
        [hashedPassAuthField]: true,
      },
    })

    return userWithHashedPass?.[hashedPassAuthField] ? true : false
  }

  /** Attempts to gets a user from the database by the email address. */
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

  /** Attempts to gets a user from the database by the provider User ID. */
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

  /** Creates a database record for a OAuth connection. */
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

  /** Removes a database record for a OAuth connection. */
  async _unlinkProviderFromUser(user: Record<string, any>) {
    const provider = this._getProviderParam()

    const deletedRecord = (await this.dbOAuthAccessor.delete({
      where: {
        userId_provider: {
          userId: user[this.dbAuthHandlerInstance.options.authFields.id],
          provider: provider,
        },
      },
    })) as IConnectedAccountRecord

    return deletedRecord
  }

  /** Gets the connected account records for the current user */
  async _getConnectedAccountsForUser(user: Record<string, any>) {
    const records = (await this.dbOAuthAccessor.findMany({
      where: {
        userId: user[this.dbAuthHandlerInstance.options.authFields.id],
      },
    })) as IConnectedAccountRecord[]

    return records
  }

  /** END section on database communication */

  /** START section on workload grouping */

  /**
   * Create a new user from the given user info.
   * If the configured username field is email, then the user's email will be used as the username.
   * Otherwise, the username will generated as the user's email without the domain, plus a random string,
   * and the user's email will be attempted to be saved as a field on the user model (if it exists).
   * - TODO: allow the user to configure the username field
   */
  async createNewUser(userInfo: IUserInfo) {
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
      throw new Error(this._getErrorMessage('signup', 'createUserError'))
    }
    return newUser
  }

  /**
   * Once the `provider` param is set, call this to kick off the linking of a provider
   * to an existing user.
   */
  async _linkProviderAccount() {
    const userInfo = await this._getUserInfoFromProvider()

    await this._validateLink(userInfo)

    const currentUser = await this._getCurrentUser()

    // whether current user exists should be checked in validateLink
    return await this._linkProviderToUser(userInfo, currentUser!)
  }

  /**
   * Once the `provider` param is set, call this to kick off the login flow.
   */
  async _loginWithProvider() {
    const userInfo = await this._getUserInfoFromProvider()
    const user = await this._getUserByProviderUserId(userInfo.uid)

    if (!user) {
      throw new Error(this._getErrorMessage('login', 'userNotFound'))
    }

    return this._loginResponse(user)
  }

  /**
   * Once the `provider` param is set, call this to kick off the signup flow.
   */
  async _signupWithProvider() {
    const userInfo = await this._getUserInfoFromProvider()

    await this._validateSignup(userInfo)

    const newUser = await this.createNewUser(userInfo)
    // this is normally used just to link account to the user, but we want to log the user in, so we don't care about the response. It'll throw an error if it fails.
    await this._linkProviderToUser(userInfo, newUser)

    return this._loginResponse(newUser)
  }

  /** END section on workload grouping */

  /** START section on public methods */

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
    const currentUser = await this._getCurrentUser()

    if (!currentUser) {
      throw new Error(this._getErrorMessage('unauthenticated', 'notLoggedIn'))
    }

    await this._validateUnlink(currentUser)

    const deletedRecord = await this._unlinkProviderFromUser(currentUser)

    return this._createUnlinkAccountResponse(deletedRecord)
  }

  async getConnectedAccounts() {
    const currentUser = await this._getCurrentUser()

    if (!currentUser) {
      throw new Error(this._getErrorMessage('unauthenticated', 'notLoggedIn'))
    }

    const records = await this._getConnectedAccountsForUser(currentUser)

    return this._createConnectedAccountsResponse(records)
  }

  /** END section on public methods */

  /**
   * This should be called by the API endpoint once the class has been instantiated, and handles
   * the routing of the request to the correct method as well as the response.
   */
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
