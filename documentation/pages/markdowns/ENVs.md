# Environment Variables

Environment variables are set within `MMGIS/.env`. A sample file `MMGIS/sample.env` is provided. On startup, erroneous .env setups are logged.

## Required Variables

#### `SERVER=`

The kind of server running (apache is deprecated) | string enum | default `''`

- _node:_ A node express server running NodeJS > 10.10
- _apache (deprecated):_ Served through Apache. Some or all functionality may not work

#### `AUTH=`

The kind of authentication method used | string enum | default `''`

- _off:_ No authentication. Users cannot sign up or log in. Tools that require log in will not work.
- _none:_ No authentication. Users can still sign up and log in from within MMGIS.
- _local:_ Anyone without credentials is blocked. The Admin must log in, create accounts and pass out the credentials.
- _csso:_ Use a Cloud Single Sign On service that's proxied in front of MMGIS.

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

A list of CSSO LDAP groups that have access | string[] | default `[]`

## Optional Variables

#### `PORT=`

Port to run on | positive integer | default `3000`

#### `VERBOSE_LOGGING=`

Potentially logs a bunch of extra stuff for development purposes | bool | default `false`

#### `FRAME_ANCESTORS=`

Sets the `Content-Security-Policy: frame-ancestors` header to allow the embedding of MMGIS in the specified external sites | string[] | default `null`

#### `PUBLIC_URL=`

Set MMGIS to be deployed under a subpath. Use full and absolute paths only to the project's build directory. For example if serving at the subpath 'mmgis/' is desired, set PUBLIC_URL to 'https://{domain}/mmgis/build'. Changing PUBLIC_URL required a rebuild. | string | default `null` (domain root build '/build')

#### `CLEARANCE_NUMBER=`

Sets a clearance for the website | string | default `CL##-####`

#### `DISABLE_LINK_SHORTENER=`

If true, users that use the 'Copy Link' feature will receive a full-length deep link. Writing new short links will be disabled but expanding existing ones will still work. | bool | default `false`

#### `HIDE_CONFIG=`

Make the configure page inaccessible to everyone | bool | default `false`

#### `FORCE_CONFIG_PATH=`

The path to a json config file that acts as the only configured mission for the instance | string | default `''`

#### `LEADS=`

When not using AUTH=csso, this is a list of usernames to be treated as leads (users with elevated permissions) | string[] | default `[]`

#### `CSSO_LEAD_GROUP=`

LDAP group of leads (users with elevated permissions) | string | default `''`
