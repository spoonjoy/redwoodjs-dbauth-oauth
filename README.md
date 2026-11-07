<!-- spoonjoy:brand:start -->
<p align="center">
  <a href="https://github.com/spoonjoy"><picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spoonjoy/.github/main/brand/headers/redwoodjs-dbauth-oauth-dark.webp">
    <img src="https://raw.githubusercontent.com/spoonjoy/.github/main/brand/headers/redwoodjs-dbauth-oauth-light.webp" alt="An old brass key beside a wooden spoon on a linen tablecloth" width="100%">
  </picture></a>
</p>
<!-- spoonjoy:brand:end -->

# RedwoodJS dbAuth OAuth Plugin

Sign in with Apple, GitHub and Google for RedwoodJS apps that use dbAuth.

[![API side NPM version](https://img.shields.io/npm/v/%40spoonjoy%2Fredwoodjs-dbauth-oauth-api?logo=redwoodjs&label=npm%20-%20api%20side)](https://www.npmjs.com/package/@spoonjoy/redwoodjs-dbauth-oauth-api)
[![Web side NPM version](https://img.shields.io/npm/v/%40spoonjoy%2Fredwoodjs-dbauth-oauth-web?logo=redwoodjs&label=npm%20-%20web%20side)](https://www.npmjs.com/package/@spoonjoy/redwoodjs-dbauth-oauth-web)

[Web package](web/README.md) · [API package](api/README.md) · [Sample project](sample-oauth-project) · [Spoonjoy](https://spoonjoy.app)

**Start:** `yarn workspace web add @spoonjoy/redwoodjs-dbauth-oauth-web` and `yarn workspace api add @spoonjoy/redwoodjs-dbauth-oauth-api`, then follow [Setup Instructions](#setup-instructions).

Spoonjoy built this plugin for its sign-in when the app ran on RedwoodJS. Spoonjoy has since moved to React Router, so the plugin is no longer in production there; the last release is 2.0.1 (September 2024).

## Overview
This library provides an easy and effective way to integrate OAuth into your [RedwoodJS](https://redwoodjs.com/) applications, offering a seamless experience for both developers and end users. Currently, it supports OAuth providers including Apple, GitHub, and Google, with a flexible architecture that allows for the expansion to more providers.

This library additionally provides buttons to make setup even more effortless:

![button screenshots](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/assets/16390116/ad13882e-3153-49df-bb06-5ffd30e04389)


## Project Structure
The project follows the dbAuth integration pattern as of Redwood version 4 and aligns with the Decoupled Auth strategy. It is structured as a Yarn monorepo with two main packages: `web` and `api`.

- The `web` package handles the OAuth flow from the user's perspective.
- The `api` package manages the communication with the OAuth provider and your database.

This repo also includes a [fully set up example project](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/tree/main/sample-oauth-project).

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
- [Apple - Enabling Apple as an OAuth provider](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/wiki/Enabling-Apple-as-an-OAuth-provider)
- [GitHub - Enabling GitHub as an OAuth provider](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/wiki/Enabling-GitHub-as-an-OAuth-provider)
- [Google - Enabling Google as an OAuth provider](https://github.com/spoonjoy/redwoodjs-dbauth-oauth/wiki/Enabling-Google-as-an-OAuth-provider)
