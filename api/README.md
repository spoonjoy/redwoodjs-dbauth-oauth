# API Package for RedwoodJS dbAuth OAuth Plugin

This is the `api` package of the RedwoodJS DBAuth OAuth Plugin. It manages the server-side logic, handling the communication with the OAuth provider and the token management.

The `api` package closely follows the DBAuth integration pattern, initializing a class called `OAuthHandler` that contains all the OAuth business logic and config parameters. It also takes in the `DbAuthHandler` instance so that it can reuse some of its functionality and configurations.

## Motivation
The `api` package aims to simplify the server-side handling of the OAuth process.

## Setup Instructions

### Adding the package
If you haven't already added the packages to your `web` and `api` workspaces, we'll start off by adding the `api` side package. From the root directory of your RedwoodJS app, run:
`yarn workspace web add @spoonjoy/redwoodjs-dbauth-oauth-api`

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

Then, run `yarn rw prisma migrate dev`, and give it a name like "prepare for OAuth".

That's it! Onto the next section.

### Updating the api `auth` function
Navigate to `api/src/functions/auth.ts`.

Your current auth function probably looks a little long, but is mostly just dbAuth config, probably with some comments explaining the options. First, we need to add the following import statement:

```ts
import { OAuthHandler } from '@spoonjoy/redwoodjs-dbauth-oauth-api'
```

Now, ignore the rest of what's in this file, and go right to the bottom of the `handler` function. You'll see:
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

### All done!
And that's it! If you haven't yet set up the `web` side, go check out [those instructions](../web/README.md).