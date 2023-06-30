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

  const [linkedAccounts, setLinkedAccounts] = React.useState<{
    [key in Provider]: boolean | undefined
  }>({
    google: undefined,
    apple: undefined,
  })

  React.useEffect(() => {
    const fetchConnectedAccounts = async () => {
      try {
        const response = await getConnectedAccounts()
        const hasApple = response.some(
          (connection) => connection.provider === 'apple'
        )
        const hasGoogle = response.some(
          (connection) => connection.provider === 'google'
        )
        setLinkedAccounts({
          apple: hasApple,
          google: hasGoogle,
        })
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
      linkedAccounts[linkedAccount as Provider] === true
    ) {
      onLinkSuccess && onLinkSuccess(linkedAccount as Provider)
      window.history.replaceState(null, '', urlWithoutQSPs)
    } else {
      window.history.replaceState(null, '', urlWithoutQSPs)
    }
  }

  const onUnlinkAccount = async (provider: Provider) => {
    const response = await unlinkAccount(provider)
    if (response.error) {
      console.log('error unlinking account', response.error)
      onUnlinkError && onUnlinkError(provider, response.error)
    } else if (response.connectedAccountRecord?.provider === provider) {
      onUnlinkSuccess && onUnlinkSuccess(provider)
      setLinkedAccounts((prev) => ({ ...prev, [provider]: false }))
    } else {
      console.log('something might have gone wrong unlinking account', response)
    }
  }

  return (
    <>
      {oAuthUrls.apple && (
        <li>
          {linkedAccounts.apple ? (
            <OAuthBtn
              provider="apple"
              action="unlink"
              onClick={() => onUnlinkAccount('apple')}
            />
          ) : (
            <OAuthBtn provider="apple" action="link" href={oAuthUrls.apple} />
          )}
        </li>
      )}
      {oAuthUrls.google && (
        <li>
          {linkedAccounts.google ? (
            <OAuthBtn
              provider="google"
              action="unlink"
              onClick={() => onUnlinkAccount('google')}
            />
          ) : (
            <OAuthBtn provider="google" action="link" href={oAuthUrls.google} />
          )}
        </li>
      )}
    </>
  )
}

export default LinkOAuth
