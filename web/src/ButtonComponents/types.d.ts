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
}
