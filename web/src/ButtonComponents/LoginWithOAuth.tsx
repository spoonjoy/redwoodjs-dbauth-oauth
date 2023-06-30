import React from 'react'

import OAuthBtn from './OAuthBtn'
import { IOAuthBtnsProps } from './buttonTypes'

const LoginWithOAuth = ({ oAuthUrls }: IOAuthBtnsProps) => {
  return (
    <>
      {oAuthUrls?.apple && (
        <li>
          <OAuthBtn provider="apple" action="login" href={oAuthUrls.apple} />
        </li>
      )}
      {oAuthUrls?.google && (
        <li>
          <OAuthBtn provider="google" action="login" href={oAuthUrls.google} />
        </li>
      )}
    </>
  )
}

export default LoginWithOAuth
