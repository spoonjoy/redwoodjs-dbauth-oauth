# RedwoodJS dbAuth OAuth Plugin
A RedwoodJS plugin that adds OAuth capabilities to projects using dbAuth.

[![API side NPM version](https://img.shields.io/npm/v/%40spoonjoy%2Fredwoodjs-dbauth-oauth-api?logo=redwoodjs&label=npm%20-%20api%20side)](https://www.npmjs.com/package/@spoonjoy/redwoodjs-dbauth-oauth-api)
[![Web side NPM version](https://img.shields.io/npm/v/%40spoonjoy%2Fredwoodjs-dbauth-oauth-web?logo=redwoodjs&label=npm%20-%20web%20side)](https://www.npmjs.com/package/@spoonjoy/redwoodjs-dbauth-oauth-web)

## Overview
This plugin provides an easy and effective way to integrate OAuth into your RedwoodJS applications, offering a seamless experience for both developers and end users. Currently, it supports OAuth providers including Apple, GitHub, and Google, with a flexible architecture that allows for the addition of more providers.

## Project Structure
The project follows the dbAuth integration pattern as of Redwood version 4 and aligns with the Decoupled Auth strategy. It is structured as a Yarn monorepo with two main packages: `web` and `api`.

- The `web` package handles the OAuth flow from the user's perspective.
- The `api` package manages the communication with the OAuth provider and your database.

For more detailed information on each package, please refer to their respective README files:
- [Web Package README](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/tree/main/web)
- [API Package README](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/tree/main/api)

## Setup Instructions
Setup involves preparing both the web and api sides of your project. First, follow the instructions for [setting up the Web side](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/blob/main/web/README.md), and then for [setting up the API side](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/tree/main/api#api-package-for-redwoodjs-dbauth-oauth-plugin).

### Environment Variables
Most of the environment variables that you'll be adding will be specific to the providers that you choose to use, and are covered in those sections. There are, however, two that you'll need to set regardless:
- `FE_URL` - this is the URL of your front end. If you're using Redwood locally out of the box, this will be `http://localhost:8910`.
  - This is primarily used as a fallback for redirection back from the API to your application.
- `RWJS_API_URL` - this is the URL that your API lives at. If you're using Redwood locally out of the box, it'll probably be `http://localhost:8910/.redwood/functions`
  - This is used primarily in two places:
    - When constructing redirect URIs to give to a provider as part of the OAuth request
    - When making requests from the `web` side to the `api` side

Additionally, because `RWJS_API_URL` is used by the web-side code, you'll need to add it to your `redwood.toml`. Go ahead and add the following (note that you might have others):
`includeEnvironmentVariables = ["RWJS_API_URL"]`

### Enabling OAuth Provider(s)
After setting up both sides, you'll need to enable your chosen OAuth provider(s). Currently supported providers include:

[Apple]()
[GitHub]()
[Google]()

#### Enabling Apple as an OAuth provider
The first thing to know about Apple is that *they don't allow you to use Sign In with Apple on localhost, and require SSL*.
Therefore, if you want to test this locally, you'll need to [alias your localhost URL](https://www.tothenew.com/blog/aliasing-localhost-url-in-mac-os/), and then [create an HTTPS cert for that domain](https://gist.github.com/cecilemuller/9492b848eb8fe46d462abeb26656c4f8). You can then configure your front end server to use this cert, and update your `redwood.toml`'s `host` parameter to your alias. If there is enough demand for a proper guide on doing this, I'll write something up - let me know :)

For Apple, we need to collect the following four environment variables:
- `APPLE_TEAM_ID`
- `APPLE_CLIENT_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`

We'll also need to add all of the redirect URIs that we'll be using - Apple requires that none of these contain `localhost` and that they're explicit - you cannot give it `https://myapp.com` and then use `https://myapp.com/method`.

Let's get started!

In-depth instructions are still being written - here's a tl;dr:

1. Sign up for an Apple developer account.
2. Sign in to the Apple Developer portal. 

Then...
##### Getting `APPLE_TEAM_ID`
1. From the sidebar, click on **Certificates, Identifiers and Profiles**.
2. Click **Identifiers**, and in the dropdown on the top right corner, make sure **App IDs** is selected. Then, click the **blue plus icon**, and select the **App IDs** option.
3. Select the type **App**, and click **Continue**. Then, fill in a **description** ("My Redwood app", etc.) and **bundle ID** ("com.myapp", etc.)
4. From the list of capabilities, make sure **Sign In with Apple** is checked. Hit **continue** to be taken to the confirmation screen.
5. On the confirmation screen, you'll see your `App ID prefix` - **this is your `APPLE_TEAM_ID`**.

##### Getting `APPLE_CLIENT_ID`
1. From the sidebar, click on **Certificates, Identifiers and Profiles**.
2. Click **Identifiers**, and in the dropdown on the top right corner, make sure **Services IDs** is selected. Then, click the **blue plus icon**, and select the **Services IDs** option.
3. Fill in a **description** ("My Redwood app service", etc.) and **Identifier** ("com.myapp.client", etc.). **This identifier is your `APPLE_CLIENT_ID`**.
4. Hit **continue** to create your new Services ID.

##### Getting `APPLE_KEY_ID`
1. From the sidebar, click on **Certificates, Identifiers and Profiles**.
2. Choose **Keys**, and click the **blue plus icon**. Give your key a name ("Key for my Redwood app", etc.), and make sure **Sign In with Apple** is checked.
3. Click **Configure**, and then in the **Primary App ID** dropdown, select the App ID that we created above when we were getting the `APPLE_TEAM_ID`. Hit **Save**.
4. Hit **Continue** to proceed to the confirmation page. Verify once again that **Sign In with Apple** is checked, and click **Register**.
5. You'll be taken to a page to **Download Your Key**. **Download the key**, and note the **Key ID - this is your `APPLE_KEY_ID`**.

##### Getting `APPLE_PRIVATE_KEY`
1. In the previous step, you downloaded your private key. Open it in TextEdit, or the text editor of your choice. **The contents of this file are your `APPLE_PRIVATE_KEY`**.

##### Adding Website URLs
1. Go back to the service you created above (at [this link](https://developer.apple.com/account/resources/identifiers/serviceId)).
2. Hit **Configure** next to **Sign In with Apple**. Click the **blue plus icon** next to **Website URLs**, and add the following:
  - Under **Domains and Subdomains**, enter your website's domain name ("myapp.com", etc.).
  - Under **Return URLs**, add the following, filling in your API URL so that these are complete URLs:
    - {your API url}/auth/oauth?method=signupWithApple
    - {your API url}/auth/oauth?method=loginWithApple
    - {your API url}/auth/oauth?method=linkAppleAccount

##### Using the Apple environment variables
Go ahead and add the four environment variables that you just collected to your environment. You'll do this in your `.env` file while working locally, and in your deployment settings for your hosting provider in production.

*Make sure* that you paste the `APPLE_PRIVATE_KEY` exactly as it is in that file, line breaks and everything. For example, in your `.env`, it'll look something like this:
```bash
APPLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----
asdhfjkalsdfhkalsdfhrwipqfhsjakldfhaskldfhasjkldfhasjkldhf
asdjfals;kdfjasl;dfjalks;dfjal;sdfkjrufwqohfsjdklfhask
asfjhksdafhaslkdfhasjlkdhfaslkdjhfakjsdlhfajlksdjhflaksdjhf
asdfjalsdj
-----END PRIVATE KEY-----'
```

You'll also need to update `redwood.toml`'s `includeEnvironmentVariables` parameter to include your `APPLE_CLIENT_ID`, otherwise it won't be available to your client, and your client won't be able to kick off the OAuth flow.

##### Enable Apple as a provider
Now, you can finally enable Apple as an OAuth provider!

Go to `web/src/auth.ts`, and make the following change:
```diff
 const oAuthClient = createOAuthClient({
   enabledProviders: {
+    apple: true
   },
 })
```

Then, go to `api/src/functions/auth.ts`, and make the following change:
```diff
  const oAuthHandler = new OAuthHandler(event, context, authHandler, {
    oAuthModelAccessor: 'oAuth',
    enabledProviders: {
+     apple: true,
    },
  })
```

