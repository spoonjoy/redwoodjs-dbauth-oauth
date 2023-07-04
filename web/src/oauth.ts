export type Provider = 'apple' | 'google'

export interface IConnectedAccountRecord {
  provider: Provider
  providerUserId: string
  userId: string
  createdAt: Date
}

interface IGetOAuthUrlsConfig {
  /**
   * By default, the redirect URL will be to whatever page the user is on when
   * they click the button. If you want to override this, you can pass in a
   * `redirectUrlOverride`.
   */
  redirectUrlOverride?: string
  /**
   * Choose which method you want the URLs for. The options are:
   * - `link`: Link an existing account to a new OAuth provider
   * - `signup`: Sign using with a new OAuth provider
   * - `login`: Log in with an existing OAuth provider
   */
  method: 'link' | 'signup' | 'login'
}

export type EnabledProviders = {
  [key in Provider]?: boolean
}

export default class OAuthClient {
  enabledProviders: EnabledProviders
  constructor({ enabledProviders }: { enabledProviders: EnabledProviders }) {
    this.getOAuthUrls = this.getOAuthUrls.bind(this)
    this.enabledProviders = enabledProviders
  }
  getOAuthUrls(config: IGetOAuthUrlsConfig) {
    const authUrls: Partial<{ [key in Provider]: string }> = {}

    for (const provider of this.getEnabledProviders()) {
      authUrls[provider] = this.getAuthUrl(config, provider)
    }

    return authUrls
  }

  async unlinkAccount(provider: Provider) {
    const response = await fetch(
      `${process.env.RWJS_API_URL}/auth/oauth?method=unlinkAccount`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      }
    )

    return response.json()
  }

  async getConnectedAccounts(): Promise<IConnectedAccountRecord[]> {
    const response = await fetch(
      `${process.env.RWJS_API_URL}/auth/oauth?method=getConnectedAccounts`
    )

    return response.json()
  }

  private getEnabledProviders(): Provider[] {
    // `as Provider[]` is necessary because Object.keys() returns a string[], but we know that the keys are actually of type Provider.
    return (Object.keys(this.enabledProviders) as Provider[]).filter(
      (provider) => this.enabledProviders[provider]
    )
  }

  private getAuthUrl(config: IGetOAuthUrlsConfig, provider: Provider) {
    const currentUrlWithoutQSPs =
      window.location.origin + window.location.pathname

    let authMethod
    switch (config.method) {
      case 'link':
        switch (provider) {
          case 'apple':
            authMethod = 'linkAppleAccount'
            break
          case 'google':
            authMethod = 'linkGoogleAccount'
            break
        }
        break
      case 'signup':
        switch (provider) {
          case 'apple':
            authMethod = 'signupWithApple'
            break
          case 'google':
            authMethod = 'signupWithGoogle'
            break
        }
        break
      case 'login':
        switch (provider) {
          case 'apple':
            authMethod = 'loginWithApple'
            break
          case 'google':
            authMethod = 'loginWithGoogle'
            break
        }
        break
    }

    let rootUrl
    switch (provider) {
      case 'apple':
        rootUrl = 'https://appleid.apple.com/auth/authorize'
        break
      case 'google':
        rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
        break
    }

    let client_id
    switch (provider) {
      case 'apple':
        if (!process.env.APPLE_CLIENT_ID) {
          throw new Error(
            'You must provide an APPLE_CLIENT_ID environment variable to use Apple OAuth.'
          )
        }
        client_id = process.env.APPLE_CLIENT_ID
        break
      case 'google':
        if (!process.env.GOOGLE_CLIENT_ID) {
          throw new Error(
            'You must provide a GOOGLE_CLIENT_ID environment variable to use Google OAuth.'
          )
        }
        client_id = process.env.GOOGLE_CLIENT_ID
        break
    }

    let scope
    switch (provider) {
      case 'apple':
        /**
         * no matter what you put here, you don't get anything back in the initial response, even though
         * the apple documentation says it'll send back a 'user' object with the email and name (https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/incorporating_sign_in_with_apple_into_other_platforms/#3332115).
         * additionally, no matter what you put here, you still get the email in the ID token.
         */
        scope = ''
        // scope = 'name email'
        break
      case 'google':
        scope = [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' ')
        break
    }

    // extra options required by some providers
    let clientSpecificOptions
    switch (provider) {
      case 'apple':
        clientSpecificOptions = {
          response_mode: 'query',
          // response_mode: 'form_post',
        }
        break
      case 'google':
        clientSpecificOptions = undefined
        break
    }

    // Apple options are here: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/incorporating_sign_in_with_apple_into_other_platforms/#3332113
    // Google options are here: https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#oauth-2.0-endpoints
    const options = {
      client_id,
      /**
       * Add more redirect URIs here:
       * - Apple: https://developer.apple.com/account/resources/identifiers/list/serviceId
       * - Google: https://console.cloud.google.com/apis/credentials
       */
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=${authMethod}`,
      response_type: 'code',
      scope: scope,
      state: config.redirectUrlOverride || currentUrlWithoutQSPs,
      ...clientSpecificOptions,
    }

    const queryString = new URLSearchParams(options).toString()

    return `${rootUrl}?${queryString}`
  }
}

export type FTGetOAuthUrls = (
  config: IGetOAuthUrlsConfig
) => Partial<Record<Provider, string>>

export type FTUnlinkAccount = (provider: Provider) => Promise<{
  error?: unknown
  providerRecord?: IConnectedAccountRecord
}>

export type FTGetConnectedAccounts = () => Promise<IConnectedAccountRecord[]>

export type OAuthInstanceType = {
  getOAuthUrls: FTGetOAuthUrls
  unlinkAccount: FTUnlinkAccount
  getConnectedAccounts: FTGetConnectedAccounts
}
