# API Package for RedwoodJS dbAuth OAuth Plugin

Table of Contents:
- [Overview](#overview)
- [Setup Instructions](#setup-instructions)
  - [Adding the package](#adding-the-package)
  - [Preparing the database](#preparing-the-database)
  - [Updating the api `auth` function](#updating-the-api-auth-function)
- [All done!](#all-done)
- [Next steps](#next-steps)

## Overview
Welcome to the heart of the RedwoodJS dbAuth OAuth Plugin - the `api` package. This package is engineered to handle the server-side logic of your OAuth authentication process.

Whether you're a seasoned developer looking to streamline your OAuth integration or a beginner just getting started, this package is designed with simplicity and efficiency in mind. By closely following the dbAuth integration pattern, it initializes a class, `OAuthHandler`, that encapsulates all the OAuth business logic and configuration parameters. This package also leverages the `DbAuthHandler` instance, reusing its functionality and configurations to ensure a seamless and efficient authentication process.

Get started with the setup instructions below and take a step towards simplifying your application's authentication flow. Happy coding!

## Setup Instructions

### Adding the package
If you haven't already added the packages to your `web` and `api` workspaces, we'll start off by adding the `api` side package. From the root directory of your RedwoodJS app, run:
`yarn workspace api add @spoonjoy/redwoodjs-dbauth-oauth-api`

### Preparing the database
First, we need to add the model for storing the linked OAuth provider information in the database. Go ahead and paste this wherever you like in `api/db/schema.prisma`:
```prisma
model OAuth {
  provider         string
  // The ID of the user on the OAuth provider's system
  providerUserId   String
  // The username of the user on the OAuth provider's system. Useful for helping users identify their linked accounts
  providerUsername String
  // The below two fields should be in reference to whatever your user model is
  user             User          @relation(fields: [userId], references: [id])
  userId           String

  createdAt DateTime @default(now())

  @@unique([provider, providerUserId])
  @@unique([userId, provider])
  @@index([userId])
}
```

You'll also want to add an `OAuth` relation to the `User` model, as well as its previously required hashedPassword and salt fields optional (since users may want to only authenticate via OAuth, they'll never get to enter a password):
```diff
 model User {
   id                  Int       @id @default(autoincrement())
   email               String    @unique
-  hashedPassword      String
+  hashedPassword      String?
-  salt                String
+  salt                String?
+  OAuth               OAuth[]
   ...
 }
```

**!!Important** - it's not just the password fields that need to be optional, it's any field that isn't:
- `id`
- `email` (even if it's not used as username)
- your username field

**If you have any other required fields, it'll fail when trying to create a new user.**

Then, run `yarn rw prisma migrate dev`, and give it a name like "prepare for OAuth".

That's it! Onto the next section.

### Updating the api `auth` function
Navigate to `api/src/functions/auth.ts`.

Your current auth function is most likely currently just your dbAuth config. First, we need to add the following import statement:

```ts
import { OAuthHandler } from '@spoonjoy/redwoodjs-dbauth-oauth-api'
```

Now, go right to the bottom of the `handler` function. You'll see:
```ts
return await authHandler.invoke()
```

Change that to the following:
```ts
const oAuthHandler = new OAuthHandler(event, context, authHandler, {
  // The name of the property you'd call on `db` to access your OAuth table.
  // i.e. if your Prisma model is named `OAuth` this value would be `oAuth`, as in `db.oAuth`
  oAuthModelAccessor: 'oAuth',
  // You can instead do `enabledProviders: {}`, but I find it more clear to be explicitly not enabling these
  // We'll enable at least one of these later on, but leave it like this for now
  enabledProviders: { apple: false, github: false, google: false },
})

switch (event.path) {
  case '/auth':
    return await authHandler.invoke()
  case '/auth/oauth':
    return await oAuthHandler.invoke()
  default:
    throw new Error('Unknown auth path')
}
```

There's a couple things happening in that snippet.

First, we created a new instance of the OAuthHandler - this is a class that's responsible for managing the OAuth authentication process. When you create a new instance of OAuthHandler, you pass in several arguments:
- `event`: This represents the incoming HTTP request. It contains information about the request, such as the URL path (event.path), HTTP method, headers, and body.
  - This is one of the parameters to the function `handler`
- `context`: This provides information about the runtime context in which the function is executing.
  - This is one of the parameters to the function `handler`
- `authHandler`: This is an instance of the DbAuthHandler class, which handles traditional authentication. The OAuthHandler uses this to reuse some of its functionality and configurations.
  - You might have given this variable a different name
- `config` object: This contains configuration settings for the OAuthHandler. For example, `oAuthModelAccessor` specifies the property name to access the OAuth table in the database, and `enabledProviders` specifies which OAuth providers are enabled.

The `OAuthHandler` provides a method called `invoke()`, which is called every time there's an OAuth related request. It manages the communication with the OAuth provider, handles the OAuth process (like getting the authorization code, exchanging it for a token, and saving the token), and sends the appropriate response back to the client.

Then, we switched the original return statement to a switch statement. This is done to handle different types of authentication requests - it checks the event.path property, which represents the URL path of the incoming HTTP request. Depending on the URL path, it will execute different code:
- If the URL path is `/auth`, it will execute `authHandler.invoke()`. This is the original behavior, which handles traditional authentication requests.
- If the URL path is `/auth/oauth`, it will execute `oAuthHandler.invoke()`. This is new behavior introduced to handle OAuth requests.
In other words, the switch statement allows the application to handle both traditional and OAuth authentication requests, routing them to the appropriate handler based on the URL path.

### All done!
And that's it! If you haven't yet set up the `web` side, go check out [those instructions](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/blob/main/web/README.md#web-package-for-redwoodjs-dbauth-oauth-plugin).

### Next steps
Now that you've set up both your `web` and `api` sides, it's time to [enable OAuth provider(s)](https://github.com/spoonjoy/redwoodjs-dbauth-oauth#enabling-oauth-provider(s))!
