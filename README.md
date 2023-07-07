## 

## Setting up Apple
[find your client IDs here](https://developer.apple.com/account/resources/identifiers/list/serviceId)

## Setting up Google
[find your client IDs here](https://console.cloud.google.com/apis/credentials)

# RedwoodJS dbAuth OAuth Plugin

This project is a plugin for RedwoodJS that adds OAuth capabilities to projects using dbAuth. It's designed to provide an easy and effective way to integrate OAuth into your RedwoodJS applications, offering a seamless experience for both developers and end users.

The plugin currently supports OAuth providers like Apple, GitHub, and Google, with a flexible architecture that allows for the addition of more providers. If you need support for a specific provider, feel free to open a request on GitHub.

This project stands unique as the first and only OAuth plugin for RedwoodJS's dbAuth, providing a low-effort, easily reusable package. It not only simplifies the integration process with minor code and database changes but also provides ready-to-use buttons for signup/login/link/unlink operations.

The project follows the dbAuth integration pattern as of Redwood version 4 and aligns with the Decoupled Auth strategy. It is structured as a Yarn monorepo with two main packages: `web` and `api`.

- The `web` package is responsible for the client-side logic, handling the OAuth flow from the user's perspective.
- The `api` package manages the server-side logic, dealing with the communication with the OAuth provider and your database.

## Project Structure
- Root
  - [Web](./web/README.md)
  - [API](./api/README.md)

For more detailed information on each package, please refer to their respective README files linked above.

## Motivation
The motivation behind this project is to simplify the integration of OAuth into RedwoodJS projects using DBAuth. We aim to provide a straightforward and efficient solution that can be easily plugged into any project, reducing the complexity and time required for the setup.
