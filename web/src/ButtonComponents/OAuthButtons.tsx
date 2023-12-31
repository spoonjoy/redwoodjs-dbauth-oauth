import React from 'react'

import LinkOAuth from './LinkOAuth'
import LoginWithOAuth from './LoginWithOAuth'
import SignupWithOAuth from './SignupWithOAuth'
import { FTGetOAuthUrls, IGetOAuthUrlsConfig } from '../oauth'
import { ILinkOAuthConfig } from './buttonTypes'

interface IOAuthButtonsProps {
  /**
   * The action to perform with the OAuth provider.
   * - `login` - login with the OAuth provider
   * - `signup` - sign up with the OAuth provider
   * - `link` - link (or unlink) the OAuth provider to/from the current user
   */
  action: 'login' | 'signup' | 'link'
  /**
   * The layout classes to apply to the `<ul>` element.
   * Note that the default is TailwindCSS classes, but you can use any CSS classes you want.
   * If you want to use your own TailwindCSS classes, you must have TailwindCSS installed and configured.
   * @default 'flex gap-2 flex-wrap justify-center'
   */
  layoutClasses?: string
  /**
   * The function to call to get the OAuth URLs.
   * This should be the `getOAuthUrls` function that you get back from the `useOAuth` hook.
   * @example ```ts
   * import { useOAuth } from 'src/auth'
   * ...
   * const { getOAuthUrls } = useOAuth()
   * ```
   */
  getOAuthUrls: FTGetOAuthUrls
  redirectUrlOverride?: IGetOAuthUrlsConfig['redirectUrlOverride']
  /**
   * When the `action` is `link`, this config is required.
   */
  linkOAuthConfig?: ILinkOAuthConfig
}

const OAuthButtons = ({
  action,
  layoutClasses = 'flex gap-2 flex-wrap justify-center',
  getOAuthUrls,
  redirectUrlOverride,
  linkOAuthConfig,
}: IOAuthButtonsProps) => {
  if (!linkOAuthConfig && action === 'link') {
    throw new Error(
      'When the `action` is `link`, the `linkOAuthConfig` prop is required.'
    )
  }

  const oAuthUrls = getOAuthUrls({ method: action, redirectUrlOverride })
  return (
    <ul className={layoutClasses}>
      {(() => {
        switch (action) {
          case 'login':
            return <LoginWithOAuth oAuthUrls={oAuthUrls} />
          case 'signup':
            return <SignupWithOAuth oAuthUrls={oAuthUrls} />
          case 'link':
            // linkOAuthConfig will always be defined here because we checked it above
            return <LinkOAuth oAuthUrls={oAuthUrls} {...linkOAuthConfig!} />
        }
      })()}
    </ul>
  )
}

export default OAuthButtons
