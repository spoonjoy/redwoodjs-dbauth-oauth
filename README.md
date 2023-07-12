# RedwoodJS dbAuth OAuth Plugin
A RedwoodJS plugin that adds OAuth capabilities to projects using dbAuth.

[![API side NPM version](https://img.shields.io/npm/v/%40spoonjoy%2Fredwoodjs-dbauth-oauth-api?logo=redwoodjs&label=npm%20-%20api%20side)](https://www.npmjs.com/package/@spoonjoy/redwoodjs-dbauth-oauth-api)
[![Web side NPM version](https://img.shields.io/npm/v/%40spoonjoy%2Fredwoodjs-dbauth-oauth-web?logo=redwoodjs&label=npm%20-%20web%20side)](https://www.npmjs.com/package/@spoonjoy/redwoodjs-dbauth-oauth-web)

### This is currently in production at [spoonjoy.app](https://spoonjoy.app), check it out!

## Overview
This plugin provides an easy and effective way to integrate OAuth into your RedwoodJS applications, offering a seamless experience for both developers and end users. Currently, it supports OAuth providers including Apple, GitHub, and Google, with a flexible architecture that allows for the expansion to more providers.

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
