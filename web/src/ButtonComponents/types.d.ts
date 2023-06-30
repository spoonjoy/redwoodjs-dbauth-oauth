import { Provider } from '@spoonjoy/redwoodjs-dbauth-oauth-web'
import { FTUnlinkAccount, FTGetConnectedAccounts } from '../oauth'

export interface IOAuthBtnsProps {
  oAuthUrls: Partial<Record<Provider, string>>
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
   * @example (provider, error) => toast.error(`failed to connect ${provider}: ${error}`)
   */
  onUnlinkError?: (provider: Provider, error: unknown) => void
}
