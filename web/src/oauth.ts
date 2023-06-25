type Provider = 'apple' | 'google'

interface IGetOAuthUrlsConfig {
  currentUrl?: string
  method: 'link' | 'signup' | 'login'
}

export default class OAuthClient {
  constructor() {
    this.getOAuthUrls = this.getOAuthUrls.bind(this)
  }
  getOAuthUrls(config: IGetOAuthUrlsConfig) {
    const authUrls = {
      apple: this.getAppleAuthUrl(config),
      google: this.getGoogleAuthUrl(config),
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

  private getAppleAuthUrl(config: IGetOAuthUrlsConfig) {
    if (!process.env.FE_URL || !process.env.APPLE_CLIENT_ID) {
      return undefined
    }

    let authMethod
    switch (config.method) {
      case 'link':
        authMethod = 'linkAppleAccount'
        break
      case 'signup':
        authMethod = 'signupWithApple'
        break
      case 'login':
        authMethod = 'loginWithApple'
        break
    }

    const rootUrl = 'https://appleid.apple.com/auth/authorize'
    const options = {
      state: config.currentUrl || '',
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=${authMethod}`,
      client_id: process.env.APPLE_CLIENT_ID,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name email',
    }

    const queryString = new URLSearchParams(options).toString()

    return `${rootUrl}?${queryString}`
  }

  private getGoogleAuthUrl(config: IGetOAuthUrlsConfig) {
    if (!process.env.RWJS_API_URL || !process.env.GOOGLE_CLIENT_ID) {
      return undefined
    }

    let authMethod
    switch (config.method) {
      case 'link':
        authMethod = 'linkGoogleAccount'
        break
      case 'signup':
        authMethod = 'signupWithGoogle'
        break
      case 'login':
        authMethod = 'loginWithGoogle'
        break
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    const options = {
      state: config.currentUrl || '',
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=${authMethod}}`,
      client_id: process.env.GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    }

    const queryString = new URLSearchParams(options).toString()

    const googleAuthUrl = `${rootUrl}?${queryString}`

    return googleAuthUrl
  }
}

export type OAuthInstanceType = Pick<
  InstanceType<typeof OAuthClient>,
  PublicMembers<InstanceType<typeof OAuthClient>>
>
