# Web Package for RedwoodJS dbAuth OAuth Plugin

This is the `web` package of the RedwoodJS DBAuth OAuth Plugin. It handles the client-side logic of the OAuth process, providing a smooth user experience.

The `web` package integrates with the `auth` provider of your RedwoodJS application, creating the `AuthProvider` component and the `useAuth` hook. It also initializes the `OAuthProvider` and `useOAuth` in the same way, allowing easy access to the auth context.

## Motivation
The `web` package is designed to offer an efficient and user-friendly OAuth flow.

## Setup Instructions
If you haven't already added the packages to your `web` and `api` workspaces, we'll start off by adding the `web` side package. From the root directory of your RedwoodJS app, run:
`yarn workspace web add @spoonjoy/redwoodjs-dbauth-oauth-web`

## Web-side `auth` updates
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

Great! If you've already been using dbAuth, you should see the similarities in how this will be used.

## 
