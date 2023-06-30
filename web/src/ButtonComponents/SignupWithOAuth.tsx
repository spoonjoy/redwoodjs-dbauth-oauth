import React from 'react'

import OAuthBtn from './OAuthBtn'
import { IOAuthBtnsProps } from './buttonTypes'

const SignupWithOAuth = ({ oAuthUrls }: IOAuthBtnsProps) => {
  return (
    <>
      {oAuthUrls?.apple && (
        <li>
          <OAuthBtn provider="apple" action="signup" href={oAuthUrls.apple} />
        </li>
      )}
      {oAuthUrls?.google && (
        <li>
          <OAuthBtn provider="google" action="signup" href={oAuthUrls.google} />
        </li>
      )}
    </>
  )
}

export default SignupWithOAuth
