import React from 'react'

import OAuthBtn from './OAuthBtn'
import { IOAuthBtnsProps } from './buttonTypes'

const SignupWithOAuth = ({ oAuthUrls }: IOAuthBtnsProps) => {
  return (
    <>
      {Array.from(oAuthUrls.entries()).map(([provider, url]) => {
        return (
          <li key={provider}>
            <OAuthBtn provider={provider} action="signup" href={url} />
          </li>
        )
      })}
    </>
  )
}

export default SignupWithOAuth
