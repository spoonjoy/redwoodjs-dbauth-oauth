import React from 'react'

import { useParams } from '@redwoodjs/router'
import { toast } from '@redwoodjs/web/toast'

import { useOAuth } from 'src/auth'

import OAuthBtn from './OAuthBtn'
import { IOAuthBtnsProps } from './types'
import { Provider } from '../oauth'

const LinkOAuth = ({ oAuthUrls }: IOAuthBtnsProps) => {
  const urlWithoutQSPs = window.location.origin + window.location.pathname

  const { unlinkAccount, getConnectedAccounts } = useOAuth()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { linkedAccount } = useParams()
  // if this is here, it means the user just connected an account
  if (linkedAccount) {
    if (
      Object.keys(linkedAccounts).includes(linkedAccount) &&
      linkedAccounts[linkedAccount as 'google' | 'apple'] === true
    ) {
      toast.success(`successfully connected ${linkedAccount.toLowerCase()}`)
      window.history.replaceState(null, '', urlWithoutQSPs)
    } else {
      window.history.replaceState(null, '', urlWithoutQSPs)
    }
  }

  const onUnlinkAccount = async (provider: 'apple' | 'google') => {
    const response = await unlinkAccount(provider)
    if (response.error) {
      console.log('error unlinking account', response.error)
      toast.error(`failed to disconnect ${provider}`)
    } else if (response.provider?.toUpperCase() === provider.toUpperCase()) {
      toast.success(`successfully disconnected ${provider}`)
      setLinkedAccounts((prev) => ({ ...prev, [provider]: false }))
    } else {
      toast(
        `something might have gone wrong unlinking account, response was ${response}`
      )
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
