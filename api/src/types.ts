export type Provider = 'apple' | 'github' | 'google'

export interface IConnectedAccountRecord {
  provider: Provider
  providerUserId: string
  userId: string
  username: string
  createdAt: Date
}

export type ProviderMap = {
  [key in Provider]?: boolean
}
export type EnabledProvidersConfig = ProviderMap & {
  /** Customize any error messages by including a string value here for the given key. */
  errors?: {
    providerNotEnabled?: string
  }
}

/**
 * The decoded ID token will contain more than this, but this is the minimum
 * of what's needed (and common across providers, ie apple doesn't provide any
 * name information)
 * */
export interface IDecodedIdToken {
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

/**
 * Type of the response from the GitHub user info endpoint.
 * This doesn't contain everything, but it contains everything that I believe could be useful.
 */
export interface IGitHubUserInfo {
  login: string
  id: number
  avatar_url: string
  gravitar_id: string
  name: string
  email: string
  bio: string | null
  twitter_username: string | null
  two_factor_authentication: boolean
}

/**
 * There will generally be more than this, but this is the minimum of what's needed (and common across providers)
 * If OIDC is being used, the content of the ID token will need to be mutated to match this interface.
 * Otherwise, this is what's retrieved from the provider's user info endpoint.
 */
export interface IUserInfo {
  /** The user's email address */
  email: string
  /** The Unique ID for the user on this provider - used by US to identify the user's account */
  uid: string
  /** The username of the user on the provider - used by the USER to identify the user's account. */
  providerUsername: string
}
