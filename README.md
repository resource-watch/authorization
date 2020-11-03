# Authorization API - Resource Watch 

[![Build Status](https://travis-ci.org/resource-watch/authorization.svg?branch=dev)](https://travis-ci.org/resource-watch/authorization)
[![Test Coverage](https://api.codeclimate.com/v1/badges/6998e7a532fb2d138ca3/test_coverage)](https://codeclimate.com/github/resource-watch/authorization/test_coverage)

## Dependencies

This service is built using [Node.js](https://nodejs.org/en/), and can be executed either natively or using Docker, each of which has its own set of requirements.

Native execution requires:
- [Node.js](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/)
- [MongoDB](https://www.mongodb.com/)

Execution using Docker requires:
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

## Getting started

Start by cloning the repository from github to your execution environment

```
git clone https://github.com/resource-watch/authorization.git && cd authorization
```

After that, follow one of the instructions below:

### Using native execution

1 - Set up your environment variables. See `dev.env.sample` for a list of variables you should set, which are described in detail in [this section](#environment-variables) of the documentation. Native execution will NOT load the `dev.env` file content, so you need to use another way to define those values

2 - Install node dependencies using Yarn:
```
yarn install
```

3 - Start the application server:
```
yarn start
```
Control Tower should now be up and accessible. To confirm, open [http://localhost:9050](http://localhost:9050/) (assuming the default settings) on your browser, which should show a 404 'Endpoint not found' message.

### Using Docker

1 - Create and complete your `dev.env` file with your configuration. The meaning of the variables is available in this [section](#documentation-environment-variables). You can find an example `dev.env.sample` file in the project root.

2 - Execute the following command to run Control tower:

```
./authorization.sh develop
```


3 - It's recommended to add the following line to your `/etc/hosts` (if you are in Windows, the hosts file is located in `c:\Windows\System32\Drivers\etc\hosts` and you'll need to 'Run as administrator' your editor):

```
mymachine   <yourIP>
```

Control Tower should now be up and accessible. To confirm, open [http://mymachine:9050](http://mymachine:9050/) on your browser, which should show a 404 'Endpoint not found' message.

## Testing

There are two ways to run the included tests:

### Using native execution

Follow the instruction above for setting up the runtime environment for native execution, then run:

```
yarn test
```

### Using Docker

Follow the instruction above for setting up the runtime environment for Docker execution, then run:

```
./authorization.sh test
```

### OAuth tests

Some tests require real OAuth credentials to be set as environment variables, as it's currently not possible to mock all requests using the mocking library this project employs. The test code is built to detect the presence of these configuration values, and bypass these tests should the variables below not be present.

Additionally, as these tests cause external services to use the callback URLs, the `PUBLIC_URL` env variable needs to be set to `http://localhost:9050`, otherwise the external services will refuse to callback, and the tests will fail.

#### Google OAuth tests

You can get the values to those variables at the [Google APIs page](https://console.developers.google.com/apis/credentials?project=resource-watch&authuser=0&folder&organizationId).

- TEST_GOOGLE_OAUTH2_CLIENT_ID => Google OAuth2 API client ID

#### Facebook OAuth tests

- TEST_FACEBOOK_OAUTH2_APP_ID => Facebook OAuth app ID
- TEST_FACEBOOK_OAUTH2_APP_SECRET => Facebook OAuth app secret

## Documentation

### Authentication

A JWT token contains the following information:

```json
{
  "id": "1a10d7c6e0a37126611fd7a7",
  "role": "ADMIN",
  "provider": "local",
  "email": "admin@authorization.org",
  "extraUserData": {
    "apps": [
      "rw",
      "gfw",
      "gfw-climate",
      "prep",
      "aqueduct",
      "forest-atlas",
      "data4sdgs"
    ]
  }
}
```

In a dev environment, you can use the following tokens to identify as different users (generated with `mysecret` key).

Role USER, registered with all Applications
Token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im1pY3Jvc2VydmljZSIsInJvbGUiOiJVU0VSIiwicHJvdmlkZXIiOiJsb2NhbCIsImVtYWlsIjoidXNlckBjb250cm9sLXRvd2VyLm9yZyIsImV4dHJhVXNlckRhdGEiOnsiYXBwcyI6WyJydyIsImdmdyIsImdmdy1jbGltYXRlIiwicHJlcCIsImFxdWVkdWN0IiwiZm9yZXN0LWF0bGFzIiwiZGF0YTRzZGdzIl19fQ.twB7Ff3Y_g0fiwPbNLnsjwbJTzra4r3e3VyJV5MMwp0`

Role MANAGER, registered with all Applications
Token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im1pY3Jvc2VydmljZSIsInJvbGUiOiJNQU5BR0VSIiwicHJvdmlkZXIiOiJsb2NhbCIsImVtYWlsIjoibWFuYWdlckBjb250cm9sLXRvd2VyLm9yZyIsImV4dHJhVXNlckRhdGEiOnsiYXBwcyI6WyJydyIsImdmdyIsImdmdy1jbGltYXRlIiwicHJlcCIsImFxdWVkdWN0IiwiZm9yZXN0LWF0bGFzIiwiZGF0YTRzZGdzIl19fQ.6U9vkDNEZxjyPN7BUd_PT0DXrXcgQjgrscoG_TaIApU`

Role ADMIN, registered with all Applications
Token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im1pY3Jvc2VydmljZSIsInJvbGUiOiJBRE1JTiIsInByb3ZpZGVyIjoibG9jYWwiLCJlbWFpbCI6ImFkbWluQGNvbnRyb2wtdG93ZXIub3JnIiwiZXh0cmFVc2VyRGF0YSI6eyJhcHBzIjpbInJ3IiwiZ2Z3IiwiZ2Z3LWNsaW1hdGUiLCJwcmVwIiwiYXF1ZWR1Y3QiLCJmb3Jlc3QtYXRsYXMiLCJkYXRhNHNkZ3MiXX19.CZrK1VRCaFGCk5NQOJUIFfUb-feBwkGZ_ORu42O_fyU`

### Environment variables

Core Variables

- PORT => The port where authorization listens for requests. Defaults to 9050 when not set.
- NODE_ENV => Environment variable of nodejs. Required.
- NODE_PATH => Required value. Always set it to 'app/src'.

OAuth Variables

- JWT_SECRET				=> The secret used to generate JWT tokens. It's a required field if the JWT feature in the auth-plugin is active. The JWT feature is active by default.
- TWITTER_CONSUMER_KEY		=> Twitter OAuth consumer key. If's a required field if the Twitter feature in the auth-plugin is active. It's not active by default.
- TWITTER_CONSUMER_SECRET	=> Twitter OAuth consumer secret. If's a required field if the Twitter feature in the auth-plugin is active. It's not active by default.
- GOOGLE_CLIENT_ID			=> Google+ OAuth client ID. If's a required field if the Google feature in the auth-plugin is active. It's not active by default.
- GOOGLE_CLIENT_SECRET		=> Google+ OAuth client secret. If's a required field if the Google feature in the auth-plugin is active. It's not active by default.
- FACEBOOK_CLIENT_ID		=> Facebook OAuth client ID. If's a required field if the Facebook feature in the auth-plugin is active. It's not active by default.
- FACEBOOK_CLIENT_SECRET	=> Facebook OAuth client secret. If's a required field if the Facebook feature in the auth-plugin is active. It's not active by default.
- SPARKPOST_KEY				=> Key to send mails with Sparkpost. It's a required field if you offer a local OAuth provider.
- CONFIRM_URL_REDIRECT		=> URL to redirect users whenever they activate their account. It's a required field if you offer a local OAuth provider.
- PUBLIC_URL				=> Base Application URL. It must be the public domain of your Control Tower instance, and it's used to compose account links. It you are offering a local OAuth provider it's a required field. This URL also needs to be configured as an acceptable callback on the OAuth provider settings.
- BASICAUTH_USERNAME		=> Basic authentication's username. Required if you activate basic auth.
- BASICAUTH_PASSWORD		=> Basic authentication's password. Required if you activate basic auth.

Mongo session variables

- COOKIE_DOMAIN => Session domain for cookies. Required field if you activate the sessionMongo plugin.
- SESSION_KEY	=> Key to cipher the cookies.  Required field if you activate the sessionMongo plugin.

Variables used for testing environments only:

- TEST_GOOGLE_OAUTH2_CLIENT_ID => Google OAuth2 API client ID
- TEST_FACEBOOK_OAUTH2_APP_ID => Facebook OAuth app ID
- TEST_FACEBOOK_OAUTH2_APP_SECRET => Facebook OAuth app secret

### Plugins

TODO


## Contributing

1. Fork it!
2. Create a feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Added some new feature'`
4. Push the commit to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request :D
