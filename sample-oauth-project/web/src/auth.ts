import {
  createOAuthClient,
  createOAuth,
} from '@spoonjoy/redwoodjs-dbauth-oauth-web'

import { createDbAuthClient, createAuth } from '@redwoodjs/auth-dbauth-web'
import { toast } from '@redwoodjs/web/toast'

const dbAuthClient = createDbAuthClient()

export const { AuthProvider, useAuth } = createAuth(dbAuthClient)

const oAuthClient = createOAuthClient({
  // You can instead do `enabledProviders: {}`, but I find it more clear to be explicitly not enabling these
  // We'll enable at least one of these later on, but leave it like this for now
  enabledProviders: { apple: true, github: false, google: false },
})

/**
 * Note that this second parameter to `createOAuth` is a function that tells the OAuth package how to handle error messages. Here, I'm simply taking the error message and toasting it.
 * If you'd like to do the same, go ahead and add the following import statement:
 * - `import { toast } from '@redwoodjs/web/toast'`
 */
const onOAuthError = (error: string) => {
  toast.error(error)
}

export const { OAuthProvider, useOAuth } = createOAuth(
  oAuthClient,
  onOAuthError
)
