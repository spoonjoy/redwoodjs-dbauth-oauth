import React from 'react'

import OAuthBtn from './OAuthBtn'
import { IOAuthBtnsProps } from './buttonTypes'

const LoginWithOAuth = ({ oAuthUrls }: IOAuthBtnsProps) => {
  return (
    <>
      {Array.from(oAuthUrls.entries()).map(([provider, url]) => {
        return (
          <li key={provider}>
            <OAuthBtn provider={provider} action="login" href={url} />
          </li>
        )
      })}
    </>
  )
}

export default LoginWithOAuth
