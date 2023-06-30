import { useOAuth } from 'src/auth'

import LinkOAuth from './LinkOAuth'
import LoginWithOAuth from './LoginWithOAuth'
import SignupWithOAuth from './SignupWithOAuth'

interface IOAuthBtnsProps {
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
   * @default 'flex flex-col gap-2'
   */
  layoutClasses?: string
}

const OAuthBtns = ({
  action,
  layoutClasses = 'flex flex-col gap-2',
}: IOAuthBtnsProps) => {
  const { getOAuthUrls } = useOAuth()
  const oAuthUrls = getOAuthUrls({ method: action })
  return (
    <ul className={layoutClasses}>
      {(() => {
        switch (action) {
          case 'login':
            return <LoginWithOAuth oAuthUrls={oAuthUrls} />
          case 'signup':
            return <SignupWithOAuth oAuthUrls={oAuthUrls} />
          case 'link':
            return <LinkOAuth oAuthUrls={oAuthUrls} />
        }
      })()}
    </ul>
  )
}

export default OAuthBtns
