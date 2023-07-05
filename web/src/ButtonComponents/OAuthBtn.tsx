import React, { MouseEvent } from 'react'

import { Provider } from '../oauth'

import AppleLogo from './assets/logos/AppleLogo'
import GitHubLogo from './assets/logos/GitHubLogo'
import GoogleLogo from './assets/logos/GoogleLogo'

export type Action = 'login' | 'signup' | 'link' | 'unlink'

type ClickEvent = MouseEvent<HTMLButtonElement | HTMLAnchorElement>

interface OAuthBtnProps {
  provider: Provider
  action: Action
  href?: string
  onClick?: (event: ClickEvent) => void
  /** When getting a button for unlinking an account, you must provide the username of that account. */
  unlinkUsername?: string
}

const OAuthBtn: React.FC<OAuthBtnProps> = ({
  provider,
  action,
  href,
  onClick,
  unlinkUsername,
}) => {
  const logos = {
    apple: <AppleLogo className="ml-[0.6rem] pt-[.1rem] pb-[.1rem]" />,
    github: <GitHubLogo className="ml-[0.6rem] pt-[.1rem] pb-[.1rem]" />,
    google: <GoogleLogo className="ml-[0.6rem] pt-[.1rem] pb-[.1rem]" />,
  }

  const actions = {
    login: 'Sign in with',
    signup: 'Sign up with',
    link: 'Link to',
    unlink: 'Unlink',
  }

  const providerName = (() => {
    switch (action) {
      case 'unlink':
        if (!unlinkUsername)
          throw new Error(
            'unlinkUsername must be provided when action is unlink'
          )
        return unlinkUsername
      default:
        switch (provider) {
          case 'apple':
            return 'Apple'
          case 'github':
            return 'GitHub'
          case 'google':
            return 'Google'
          default:
            throw new Error('Invalid provider')
        }
    }
  })()

  const btnClasses =
    'relative block h-[41px] min-w-[260px] rounded-md border border-gray-200 bg-white text-gray-900 transition-colors ease-in-out hover:bg-gray-50 hover:shadow-sm active:bg-gray-100 whitespace-nowrap overflow-hidden flex items-center'

  const btnContent = (
    <>
      <div className="flex-shrink-0">{logos[provider]}</div>
      <div className="mx-auto px-2 whitespace-nowrap">{`${actions[action]} ${providerName}`}</div>
    </>
  )

  if (href) {
    return (
      <a href={href} className={btnClasses}>
        {btnContent}
      </a>
    )
  } else {
    return (
      <button className={btnClasses} onClick={onClick}>
        {btnContent}
      </button>
    )
  }
}

export default React.memo(OAuthBtn)
