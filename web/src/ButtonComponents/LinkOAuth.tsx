import React from 'react'

import { useParams } from '@redwoodjs/router'

import OAuthBtn from './OAuthBtn'
import { ILinkOAuthConfig, IOAuthBtnsProps } from './buttonTypes'
import { Provider } from '../oauth'

const LinkOAuth = ({
  oAuthUrls,
  unlinkAccount,
  getConnectedAccounts,
  onLinkSuccess,
  onUnlinkSuccess,
  onUnlinkError,
}: IOAuthBtnsProps & ILinkOAuthConfig) => {
  const urlWithoutQSPs = window.location.origin + window.location.pathname

  // Undefined if not linked, otherwise should be the user's username at that provider
  const [linkedAccounts, setLinkedAccounts] = React.useState<{
    [key in Provider]: string | undefined
  }>({
    google: undefined,
    github: undefined,
    apple: undefined,
  })

  React.useEffect(() => {
    const fetchConnectedAccounts = async () => {
      try {
        const accounts = await getConnectedAccounts()
        const newLinkedAccounts = { ...linkedAccounts }

        accounts.forEach((account) => {
          newLinkedAccounts[account.provider] = account.providerUsername
        })

        setLinkedAccounts(newLinkedAccounts)
      } catch (error) {
        console.error('Failed to fetch connected accounts:', error)
      }
    }

    fetchConnectedAccounts()
    // this is intentionally empty, we only want to run this on initial render
  }, [])

  const { linkedAccount } = useParams()
  // if this is here, it means the user just connected an account
  if (linkedAccount) {
    if (
      Object.keys(linkedAccounts).includes(linkedAccount) &&
      linkedAccounts[linkedAccount as Provider] !== undefined
    ) {
      onLinkSuccess && onLinkSuccess(linkedAccount as Provider)
      window.history.replaceState(null, '', urlWithoutQSPs)
    } else {
      window.history.replaceState(null, '', urlWithoutQSPs)
    }
  }

  const onUnlinkAccount = (provider: Provider) => {
    unlinkAccount(provider).then((response) => {
      if (response.error) {
        console.log('error unlinking account', response.error)
        onUnlinkError && onUnlinkError(provider, response.error)
      } else if (response.providerRecord?.provider === provider) {
        onUnlinkSuccess && onUnlinkSuccess(provider)
        setLinkedAccounts((prev) => ({ ...prev, [provider]: false }))
      } else {
        console.log(
          'something might have gone wrong unlinking account',
          response
        )
      }
    })
  }

  return (
    <>
      {Array.from(oAuthUrls.entries()).map(([provider, url]) => {
        return (
          <li key={provider}>
            {linkedAccounts[provider] ? (
              <OAuthBtn
                provider={provider}
                action="unlink"
                onClick={() => {
                  onUnlinkAccount(provider)
                }}
                unlinkUsername={linkedAccounts[provider]}
              />
            ) : (
              <OAuthBtn provider={provider} action="link" href={url} />
            )}
          </li>
        )
      })}
    </>
  )
}

export default LinkOAuth
