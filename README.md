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


### Enabling OAuth Provider(s)
After setting up both sides, you'll need to enable your chosen OAuth provider(s). Currently supported providers include:

[Apple]()
[GitHub]()
[Google]()

.....TODO add here