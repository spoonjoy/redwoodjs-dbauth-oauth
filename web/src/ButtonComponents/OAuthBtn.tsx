import React, { MouseEvent } from 'react'

import { Provider } from '@spoonjoy/redwoodjs-dbauth-oauth-web'

import AppleLogo from './assets/logos/AppleLogo'
import GoogleLogo from './assets/logos/GoogleLogo'

export type Action = 'login' | 'signup' | 'link' | 'unlink'

type ClickEvent = MouseEvent<HTMLButtonElement | HTMLAnchorElement>

interface OAuthBtnProps {
  provider: Provider
  action: Action
  href?: string
  onClick?: (event: ClickEvent) => void
}

const OAuthBtn: React.FC<OAuthBtnProps> = ({
  provider,
  action,
  href,
  onClick,
}) => {
  const logos = {
    apple: <AppleLogo className="ml-[0.6rem] pt-[.1rem] pb-[.1rem]" />,
    google: <GoogleLogo className="ml-[0.6rem] pt-[.1rem] pb-[.1rem]" />,
  }

  const actions = {
    login: 'Sign in with',
    signup: 'Sign up with',
    link: 'Link to',
    unlink: 'Unlink from',
  }

  const ButtonComponent = href ? 'a' : 'button'

  const providerName = (() => {
    switch (provider) {
      case 'apple':
        return 'Apple'
      case 'google':
        return 'Google'
      default:
        throw new Error('Invalid provider')
    }
  })()

  return (
    <ButtonComponent
      href={href}
      onClick={onClick}
      className="relative block h-[41px] w-[260px] rounded-md border border-gray-200 bg-white text-gray-900 transition-colors ease-in-out hover:bg-gray-50 hover:shadow-sm active:bg-gray-100"
    >
      <div className="absolute top-[50%] -translate-y-1/2">
        {logos[provider]}
      </div>
      <div className="absolute top-[50%] left-[50%] w-full -translate-y-1/2 -translate-x-1/2 text-center">{`${actions[action]} ${providerName}`}</div>
    </ButtonComponent>
  )
}

export default React.memo(OAuthBtn)
