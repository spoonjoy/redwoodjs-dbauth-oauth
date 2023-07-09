import { OAuthButtons } from '@spoonjoy/redwoodjs-dbauth-oauth-web'

import { MetaTags } from '@redwoodjs/web'
import { toast } from '@redwoodjs/web/toast'

import { useOAuth } from 'src/auth'

const SettingsPage = () => {
  const { getOAuthUrls, unlinkAccount, getConnectedAccounts } = useOAuth()

  return (
    <>
      <MetaTags title="Settings" description="Settings page" />

      <h1>SettingsPage</h1>
      <OAuthButtons
        action="link"
        getOAuthUrls={getOAuthUrls}
        linkOAuthConfig={{
          unlinkAccount,
          getConnectedAccounts,
          onLinkSuccess(linkedAccount) {
            toast.success(`successfully connected ${linkedAccount}`)
          },
          onUnlinkSuccess(unlinkedAccount) {
            toast.success(`successfully disconnected ${unlinkedAccount}`)
          },
          onUnlinkError(provider, error) {
            toast.error(`error disconnecting ${provider}: ${error}`)
          },
        }}
      />
    </>
  )
}

export default SettingsPage
