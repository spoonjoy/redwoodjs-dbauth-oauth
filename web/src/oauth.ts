export default class OAuthClient {
  constructor() {
    this.getOAuthUrls = this.getOAuthUrls.bind(this)
  }
  getOAuthUrls(currentUrl = '') {
    const authUrls = {
      apple: this.getAppleAuthUrl(currentUrl),
      google: this.getGoogleAuthUrl(currentUrl),
    }

    return authUrls
  }

  private getGoogleAuthUrl(currentUrl = '') {
    if (!process.env.RWJS_API_URL || !process.env.GOOGLE_CLIENT_ID) {
      return undefined
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    const options = {
      state: currentUrl,
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=linkGoogleAccount`,
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

  // based on https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/incorporating_sign_in_with_apple_into_other_platforms#3332113
  private getAppleAuthUrl(currentUrl = '') {
    if (!process.env.FE_URL || !process.env.APPLE_CLIENT_ID) {
      return undefined
    }

    const rootUrl = 'https://appleid.apple.com/auth/authorize'
    const options = {
      state: currentUrl,
      redirect_uri: `${process.env.RWJS_API_URL}/auth/oauth?method=linkAppleAccount`,
      client_id: process.env.APPLE_CLIENT_ID,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'name%20email',
    }

    const queryString = new URLSearchParams(options).toString()

    return `${rootUrl}?${queryString}`
  }
}

export type OAuthInstanceType = Pick<
  InstanceType<typeof OAuthClient>,
  PublicMembers<InstanceType<typeof OAuthClient>>
>
