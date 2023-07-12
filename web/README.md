# Web Package for RedwoodJS dbAuth OAuth Plugin

Table of Contents:
- [Overview](#overview)
- [Setup Instructions](#setup-instructions)
  - [Adding the package](#adding-the-package)
  - [Web-side `auth` updates](#web-side-auth-updates)
  - [`App.tsx` updates](#apptsx-updates)
- [Usage](#usage)
  - [Logging in and signing up](#logging-in-and-signing-up)
  - [Linking and unlinking accounts](#linking-and-unlinking-accounts)
- [All done!](#all-done)
- [Next steps](#next-steps)

## Overview 
Welcome to the `web` package of the RedwoodJS dbAuth OAuth Plugin. It handles the client-side logic of the OAuth process, providing a smooth user experience.

The `web` package integrates with the `auth` provider of your RedwoodJS application, creating the `AuthProvider` component and the `useAuth` hook. It also initializes the `OAuthProvider` and `useOAuth` in the same way, allowing easy access to the auth context.

Get started with the setup instructions below and take a step towards simplifying your application's authentication flow. Happy coding!
## Setup Instructions

### Adding the package
If you haven't already added the packages to your `web` and `api` workspaces, we'll start off by adding the `web` side package. From the root directory of your RedwoodJS app, run:
`yarn workspace web add @spoonjoy/redwoodjs-dbauth-oauth-web`

### Web-side `auth` updates
Navigate to `web/src/auth.ts`.

This is where your dbAuth client is created, and the `AuthProvider` wrapper and `useAuth` hook are being exported.

We're going to do something very similar - go ahead and add the following import statement:
```ts
import {
  createOAuthClient,
  createOAuth,
} from '@spoonjoy/redwoodjs-dbauth-oauth-web'
```

And then, add the following:
```ts
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
```

### `App.tsx` updates

In `web/src/App.tsx`, you need to add the OAuthProvider that we just exported in the last step. It's the exact same usage as dbAuth's `AuthProvider`:

```diff
...
-import { AuthProvider, useAuth } from './auth'
+import { AuthProvider, useAuth, OAuthProvider } from './auth'
+import '@spoonjoy/redwoodjs-dbauth-oauth-web/dist/style.css' // only required if you're planning on using the supplied button components
 
 import './scaffold.css'
 import './index.css'
@@ -13,9 +13,11 @@ const App = () => (
   <FatalErrorBoundary page={FatalErrorPage}>
     <RedwoodProvider titleTemplate="%PageTitle | %AppTitle">
       <AuthProvider>
-        <RedwoodApolloProvider useAuth={useAuth}>
-          <Routes />
-        </RedwoodApolloProvider>
+        <OAuthProvider>
+          <RedwoodApolloProvider useAuth={useAuth}>
+            <Routes />
+          </RedwoodApolloProvider>
+        </OAuthProvider>
       </AuthProvider>
     </RedwoodProvider>
   </FatalErrorBoundary>
...
```

## Usage
Because I've accidentally created new accounts on apps that support signing in with providers countless times, your users can't accidentally create a new account when using this library.

What this means is that there's three types of interactions:
- `link`: Link an existing account to a new OAuth provider
- `signup`: Sign up using with a new OAuth provider
- `login`: Log in with an existing OAuth provider

For all three of these, the flows start off by redirecting the user to sign in with the given provider, which then redirects them to your API, which then returns a redirect back to your application. Therefore, the steps to beginning any of these flows looks very similar.

### Logging in and signing up
These two flows are the simplest and easiest. First, make sure you've followed the Provider Onboarding instructions and registered the required redirect URIs with that provider - if you don't the user will see an error when they try to log into that provider, something along the lines of "redirect URI mismatch".

Then, get the OAuth URLs for kicking off these flows as follows:

```ts
import { useAuth, useOAuth } from 'src/auth'

const { getOAuthUrls } = useOAuth()
const oAuthUrls = getOAuthUrls({
  method: 'login', // or 'signup'
})
```

`oAuthUrls` will now be a map with the URLs for kicking off these flows for the providers that you've enabled. You can use it, for example, as follows:
```ts
Array.from(oAuthUrls.entries()).map(([provider, url]) => {
  // your code for rendering this link
})
```

So that you don't need to worry about spending time on these buttons, this library provides buttons that you can use. A complete setup for the `login` and `signup` flows looks like this:

```ts
import { OAuthButtons } from '@spoonjoy/redwoodjs-dbauth-oauth-web'
import { useOAuth } from 'src/auth'

const YourComponent = () => {
  const { getOAuthUrls } = useOAuth()

  return (
    <OAuthButtons
      action="login" // or 'signup'
      getOAuthUrls={getOAuthUrls}
    />
  )
}
```

I just added this to my scaffolded login/signup pages, and I'm currently working on making these the preferred way of logging in/signing up (as opposed to just rendering the buttons above/below the username/password fields).

It'll only render buttons for your enabled providers, so if you don't see any changes to your UI yet, that's probably why.

### Linking and unlinking accounts
While linking accounts is very similar to logging in and signing up, unlinking is a bit different because there's no redirects involved. This is because to unlink an account, we don't interact with the provider at all - we just delete the record from the database.

Additionally, because we want to make it clear what providers have already been linked, `useOAuth` provides two extra functions for this use case:
- `unlinkAccount`
  - You can use this as the onClick handler for a button, for example `onClick={async () => { await unlinkAccount('apple') }}`
- `getConnectedAccounts`
  - Returns an array of the Connected Account records, which includes the following information (more info on the API readme):
    - `provider`: Provider (as a string literal)
    - `providerUserId`: string
    - `providerUsername`: string
    - `userId`: string
    - `createdAt`: Date

I made a Settings page for containing this and any other user-configurable things. If you don't already have somewhere like this in your app, generate a new page by running:
`yarn rw g page Settings`

If you want to build your own button for handling this, take a look at how the `LinkOAuth` component included in this library is built. But if you want to just use ours, setup is super easy. In your Settings page (or wherever), do the following:

```ts
import { OAuthButtons } from '@spoonjoy/redwoodjs-dbauth-oauth-web'
import { useOAuth } from 'src/auth'

// optional, see below
import { toast } from '@redwoodjs/web/toast'

const YourComponent = () => {
  const { getOAuthUrls, unlinkAccount, getConnectedAccounts } = useOAuth()

  return (
    <OAuthButtons
      action="link"
      getOAuthUrls={getOAuthUrls}
      // required when `action` is `link`
      linkOAuthConfig={{
        unlinkAccount,
        getConnectedAccounts,
        // the below three parameters are optional
        onLinkSuccess(linkedAccount) {
          toast.success(`successfully connected ${linkedAccount}`)
        },
        onUnlinkSuccess(unlinkedAccount) {
          toast.success(`successfully disconnected ${unlinkedAccount}`)
        },
        // Optional callback to run when linking fails. Because unlinking is a request from the client, rather than a redirect (like linking), the `onOAuthError` callback that we created in `web/src/auth.ts` isn't called in this flow.
        // This will probably be removed in future versions.
        onUnlinkError(provider, error) {
          toast.error(`error disconnecting ${provider}: ${error}`)
        },
      }}
    />
  )
}
```

### All done!
And that's it! If you haven't yet set up the `api` side, go check out [those instructions](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/blob/main/api/README.md#api-package-for-redwoodjs-dbauth-oauth-plugin).

### Next steps
Now that you've set up both your `web` and `api` sides, it's time to [enable OAuth provider(s)](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/wiki/Enabling-Apple-as-an-OAuth-provider)!
