# Environment Variables

Environment variables are set within `MMGIS/.env`. A sample file `MMGIS/sample.env` is provided. On startup, erroneous .env setups are logged.

## Required Variables

#### `SERVER=`

The kind of server running (apache is deprecated) | string enum | default `''`

- _node:_ A node express server running NodeJS > 10.10
- _apache (deprecated):_ Served through Apache. Some or all functionality may not work

#### `AUTH=`

The kind of authentication method used | string enum | default `''`

- _none:_ No authentication
- _local:_ MMGIS handles authentication and account creation
- _csso:_ Cloud Single Sign On - An external service handles authentication and account creation

#### `NODE_ENV=`

Instance type | string enum | default `production`

- _production:_
- _development:_ Shows configure and documentation links on the landing page for convenience

#### `SECRET=`

Some random string | string | default `null`

#### `DB_HOST=`

URL of Postgres database | string | default `null`

#### `DB_PORT=`

Port for Postgres database | string | default `null`

#### `DB_NAME=`

Name of Postgres database | string | default `null`

#### `DB_USER=`

User of Postgres database | string | default `null`

#### `DB_PASS=`

Password of Postgres database | string | default `null`

#### `CSSO_GROUPS=`

A list of CSSO LDAP groups that have access | array of string | default `[]`

## Optional Variables

#### `PORT=`

Port to run on | positive integer | default `3000`

#### `VERBOSE_LOGGING=`

Potentially logs a bunch of extra stuff for development purposes | bool | default `false`

#### `HIDE_CONFIG=`

Make the configure page inaccessible to everyone | bool | default `false`

#### `CONFIGCONFIG_PATH=`

The path to a json file that sets up the configure page that overrides the database's record | string | default `''`

#### `FORCE_CONFIG_PATH=`

The path to a json config file that acts as the only configured mission for the instance | string | default `''`

#### `LEADS=`

When not using AUTH=csso, this is a list of usernames to be treated as leads (users with elevated permissions) | array of strings | default `[]`

#### `CSSO_LEAD_GROUP=`

LDAP group of leads (users with elevated permissions) | string | default `''`
