import {
  FTUnlinkAccount,
  FTGetConnectedAccounts,
  Provider,
  FTGetOAuthUrls,
} from '../oauth'

export interface IOAuthBtnsProps {
  oAuthUrls: ReturnType<FTGetOAuthUrls>
}

/**
 * Extra props that are required for the OAuth link component
 */
export interface ILinkOAuthConfig {
  /**
   * The function to call to unlink an account.
   * This should be the `unlinkAccount` function that you get back from the `useOAuth` hook.
   */
  unlinkAccount: FTUnlinkAccount
  /**
   * The function to get the list of connected accounts.
   * This should be the `getConnectedAccounts` function that you get back from the `useOAuth` hook.
   */
  getConnectedAccounts: FTGetConnectedAccounts
  /**
   * Optional callback to run when linking is successful.
   * @example (linkedAccount) => toast.success(`successfully connected ${linkedAccount}`)
   */
  onLinkSuccess?: (linkedAccount: Provider) => void
  /**
   * Optional callback to run when unlinking is successful.
   * @example (unlinkedAccount) => toast.success(`successfully disconnected ${unlinkedAccount}`)
   */
  onUnlinkSuccess?: (unlinkedAccount: Provider) => void
  /**
   * Optional callback to run when linking fails.
   * Because unlinking is a request from the client, rather than a redirect
   * (like linking), the error message isn't automatically displayed.
   * @example (provider, error) => toast.error(`failed to connect ${provider}: ${error}`)
   */
  onUnlinkError?: (provider: Provider, error: unknown) => void
}
