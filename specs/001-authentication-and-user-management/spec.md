# Authentication & User Management - Feature Specification

## Overview

The MMGIS Authentication & User Management system provides a comprehensive security and access control framework for the Multi-Mission Geographic Information System. The feature was implemented to support multiple authentication modes, user role management, session handling, and secure token-based API access for planetary mission operations.

## Feature Description

### Core Capabilities

Site access is chosen with `SITE_ACCESS`, and login methods with `AUTH_PROVIDERS`:

1. **public** - Anyone can view. End users don't sign up or log in; admins log in at `/configure`. Tools requiring an account are disabled.

2. **optional** - Guests can browse, and users can sign up and log in for additional features.

3. **required** - All unauthenticated users are blocked. Administrators create accounts or enable self-signup via environment configuration.

Providers: `local` (username/password) and `csso` (an upstream Cloud Single Sign-On proxy handles authentication). `ldap` and `earthdata` are reserved names for future providers.

### User Roles & Permissions

Access is granted through role bindings (`role_bindings`). Each binding gives a role to a subject at a scope:

- **Subjects:** a user, a group (`auth_groups` / `auth_group_members`, or CSSO groups), or an audience (`everyone`, `authenticated`).
- **Scopes:** global, a mission (by stable mission UUID in `missions`), or a layer and its children (by layer UUID).
- **Roles** bundle named capabilities (`API/permissions/policy.js`):
  - **superadmin** - everything, globally. There must always be at least one.
  - **data_admin** - geodatasets, datasets and STAC.
  - **mission_admin** - view the mission, edit its configuration and layers.
  - **layer_editor** - view the mission, edit a layer and its children.
  - **viewer** - view the mission.

Rules are allow-only. Nobody can grant a role they don't hold at that scope. Every `/api` route declares its capability with `authorize()` (`API/permissions/authorize.js`), and the server refuses to start if one doesn't. Configure → Users & Access manages groups, bindings and shows effective access.

The legacy `users.permission` column is left untouched for rollback and is read only by the one-time import (`API/permissions/legacyPermissions.js`); nothing writes it and it grants nothing.

### Authentication Features

#### User Registration & Login
- Strong password requirements enforced (minimum 8 characters, uppercase, lowercase, number, symbol)
- bcrypt password hashing with salt generation
- First user automatically receives a global `superadmin` binding
- Session-based authentication with PostgreSQL session storage
- Automatic session token generation and validation
- Cookie-based session persistence with configurable SameSite settings

#### Password Management
- Admin-initiated password reset with time-limited tokens
- Reset tokens expire after configurable duration (default 1 hour)
- Password reset links generated through administrative interface
- Password change triggers bcrypt rehashing

#### Long-Term API Tokens
- Token-based authentication for programmatic API access
- Stored as SHA-256 hashes; the plaintext is shown once (older plaintext tokens are converted on first use)
- Named, with scopes (read-only or the creator's access) and an optional mission limit
- Always capped by the creator's current access; removed when the creator is deleted
- Configurable expiration periods (time-based or "never") and revocation
- Bearer token format for HTTP Authorization headers
- Any signed-in user can create read-only tokens; users manage their own tokens, SuperAdmins all tokens
- Tokens can't be used to create, list or revoke tokens

#### Session Management
- Express-session with PostgreSQL persistence (connect-pg-simple)
- Session regeneration on login/logout for security
- Activity tracking and automatic token rotation
- Third-party cookie support for iframe embedding scenarios
- Session validation middleware for protected routes

### Security Features

#### Middleware Protection
- **ensureUser()** - Validates user authentication or long-term token
- **ensureAdmin()** - Requires admin/superadmin permissions with token support
- **ensureGroup()** - CSSO group membership validation
- **stopGuests()** - Blocks unauthenticated users from specific endpoints
- **checkHeadersCodeInjection()** - Basic XSS/injection detection

#### Rate Limiting
- API rate limiting: 20,000 requests per 5-minute window per IP
- Applied to all `/api/` endpoints

#### HTTPS & Cookie Security
- Optional HTTPS server mode with custom certificates
- Configurable SameSite cookie attributes (None for cross-origin iframes)
- Secure flag automatically enabled in production when using third-party cookies

### CSSO Integration

When `AUTH_PROVIDERS` includes `csso`, the system expects an upstream proxy to handle authentication and inject headers:

- **X-Sub** - Username/subject identifier
- **X-Groups** - Base64-encoded JSON group membership object
- **X-Session** - CSSO session identifier
- **X-Activity** - Activity tracking (always "true" for MMGIS requests)

Group-based access control:
- `CSSO_GROUPS` environment variable defines authorized groups
- `CSSO_LEAD_GROUP` specifies the group with elevated Lead permissions
- Lead users automatically added to internal `mmgis-group` for authorization

### Administrative Interface

The Configure application provides a comprehensive user management interface:

- User listing with sortable columns (ID, username, email, role, missions, dates)
- Role assignment (SuperAdmin, Admin, User)
- Mission-specific access control for Admin users
- Admin-initiated password reset link generation
- User creation with configurable permissions
- User deletion (except the original administrator account with ID 1)
- Email update capability

### Database Schema

#### Users Table
```sql
users {
  id: SERIAL PRIMARY KEY
  username: VARCHAR UNIQUE NOT NULL
  email: VARCHAR UNIQUE (nullable, validated)
  password: VARCHAR NOT NULL (bcrypt hashed)
  permission: ENUM (legacy, see API/permissions/legacyPermissions.js; read only by the import)
  token: VARCHAR(2048) (nullable, current session token)
  missions_managing: TEXT[] (nullable, mission names for Admin users)
  reset_token: VARCHAR(2048) (nullable, password reset token)
  reset_token_expiration: BIGINT (nullable, epoch timestamp)
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### Long Term Tokens Table
```sql
long_term_tokens {
  id: SERIAL PRIMARY KEY
  token: VARCHAR UNIQUE NOT NULL
  period: VARCHAR NOT NULL (duration or "never")
  created_by_user_id: INTEGER REFERENCES users(id)
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

#### Session Store
PostgreSQL-based session storage via `connect-pg-simple` stores:
- Session ID
- Session data (user, uid, token, permission)
- Expiration timestamp

## API Endpoints

### User Authentication (`/api/users`)

- **POST /has** - Check if any users exist in the system
- **POST /first_signup** - Create the initial SuperAdmin account (only works when no users exist)
- **POST /signup** - Register a new user account
- **POST /login** - Authenticate user with username/password or token
- **POST /logout** - End user session and invalidate token
- **GET /logged_in** - Check current session authentication status
- **POST /resetPassword** - Reset password using reset token

### Account Management (`/api/accounts`)

Protected by `ensureAdmin()` middleware:

- **GET /entries** - List all user accounts with details
- **POST /update** - Update user email, permission, or mission assignments
- **DELETE /remove/:id** - Delete user account (except ID 1)
- **POST /generateResetPasswordLink** - Create time-limited password reset token

### Long-Term Tokens (`/api/longtermtokens`)

Protected by `ensureAdmin()` middleware:

- **GET /get** - List tokens (filtered by permission level)
- **POST /generate** - Create new long-term API token
- **POST /clear** - Delete a long-term token (permission-based)

## Environment Configuration

### Required Variables

- `SITE_ACCESS` - `public` (no end-user login), `optional` (guests and users) or `required` (login required). No default.
- `AUTH_PROVIDERS` - login methods: `local`, `csso` (`ldap`, `earthdata` reserved)
- `AUTH` is removed; the server refuses to start while it is set and prints the replacement.
- `SECRET` - Session encryption secret
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` - PostgreSQL connection

### Optional Authentication Variables

- `AUTH_LOCAL_ALLOW_SIGNUP` - Allow user self-registration when SITE_ACCESS=required (default: false)
- `CSSO_GROUPS` - JSON array of allowed LDAP groups for CSSO mode
- `CSSO_LEAD_GROUP` - LDAP group name for Lead permissions in CSSO mode
- `LEADS` - JSON array of usernames with Lead permissions (non-CSSO modes)
- `THIRD_PARTY_COOKIES` - Enable SameSite=None for cross-origin iframe embedding (default: false)
- `SKIP_CLIENT_INITIAL_LOGIN` - Disable automatic login on page load (default: false)
- `CLEARANCE_NUMBER` - Display clearance level on login pages (default: "CL##-####")
- `CONTACT_INFO` - Display contact information on login pages (default: "None Provided")

## User Interface

### Login Page (`views/login.pug`)
- Unified login/signup form with toggle
- Username and password fields
- Optional email field for signup
- Password strength indicator
- Responsive design with NASA/JPL branding
- Displays clearance number and contact information

### Admin Login Page (`views/adminlogin.pug`)
- Specialized login for Configure application access
- Similar design to main login page

### Password Reset Page (`views/resetpassword.pug`)
- Token-based password reset interface
- Password strength validation

### Users & Access Interface (`configure/src/pages/UsersAccess/UsersAccess.js`)
- React-based Material-UI table component
- Sortable user list with pagination
- Role badges (color-coded by permission level)
- Inline action buttons (Update, Reset Password, Delete)
- Modal dialogs for all user operations
- Real-time authentication mode indicator

## Integration Points

### Session Data Available to Application
```javascript
req.session.user        // Username
req.session.uid         // User ID
req.session.token       // Current session token
```

### CSSO Integration Data
```javascript
req.user               // Username from X-Sub header or session
req.groups             // Group membership object
req.leadGroupName      // Always "mmgis-group"
req.cssoSessionID      // CSSO session identifier
```

### Token Authentication
```javascript
req.isLongTermToken         // Boolean flag
req.tokenUserPermission     // Permission from token creator
req.tokenUserMissions       // Mission array from token creator
```

## Security Considerations

### Implemented Protections

1. **Password Security**
   - bcrypt hashing with automatic salt generation
   - Strong password policy enforcement
   - Separate validation on client and server

2. **Session Security**
   - Session regeneration on authentication events
   - Token rotation on each login
   - PostgreSQL-backed session persistence
   - Configurable cookie attributes

3. **API Security**
   - Rate limiting on API endpoints
   - Bearer token validation with expiration
   - Permission-based endpoint protection
   - Long-term token scope validation

4. **Injection Protection**
   - Basic XSS detection in URLs
   - Parameterized database queries (Sequelize ORM)
   - Input validation on all user-provided data

5. **HTTPS Support**
   - Optional built-in HTTPS server
   - Custom certificate configuration
   - Automatic Secure cookie flag in production

### Known Limitations

<!-- HUMAN REVIEW NEEDED: Validate these security considerations and add any additional known limitations -->

1. **Token Invalidation** - No automatic token revocation mechanism besides manual deletion
2. **Password Reset** - Reset links are delivered out-of-band (admin must communicate to user)
3. **Email Verification** - No email verification implemented; email is optional and not used for authentication
4. **Account Lockout** - No brute-force protection via account lockout (relies on rate limiting)
5. **CSSO Validation** - System trusts headers from upstream proxy; requires proper proxy configuration

## Migration & Database Updates

The system includes automatic schema migration functions:

- `user.up()` - Adds `missions_managing`, `reset_token`, and `reset_token_expiration` columns if missing
- `longtermtokens.up()` - Adds `created_by_user_id` column with foreign key reference

Migrations run automatically on application startup after table synchronization.

## Business Logic

### First User Creation
- System checks if any users exist before allowing first signup
- First user automatically receives a global `superadmin` binding
- This ensures someone always has administrative access

### Permission Inheritance
- Long-term tokens get the intersection of their scopes, their mission limit and the creator's current access
- Layer bindings apply to that layer and its descendants
- Mission bindings follow the mission's UUID, so they survive renames; clones get a new UUID and no bindings
- SuperAdmins have unrestricted access to all missions

### Token Lifecycle
- Session tokens regenerated on each login for security
- Session tokens cleared on logout
- Long-term tokens persist until explicitly deleted or expired
- Token expiration checked on each API request

### User Deletion Rules
- Original administrator (ID 1) cannot be deleted
- User deletion is permanent and cascades to sessions
- The user's role bindings and long-term tokens are deleted with the account

<!-- HUMAN REVIEW NEEDED: Verify business rules for handling user deletion and associated data cleanup -->

## Testing Considerations

### Manual Testing Scenarios
1. First user signup and automatic SuperAdmin assignment
2. Login with username/password
3. Login with session token (returning user)
4. Password reset flow end-to-end
5. Long-term token generation and API authentication
6. Permission-based endpoint access control
7. User role assignment and mission restriction
8. CSSO header injection and group-based access

### Security Testing
1. Strong password validation enforcement
2. SQL injection attempts
3. XSS attempts in login fields
4. Rate limiting behavior
5. Token expiration validation
6. Session timeout behavior
7. Cross-site request forgery (CSRF) protection via SameSite cookies

## Dependencies

### NPM Packages
- `express-session` - Session management
- `connect-pg-simple` - PostgreSQL session store
- `bcryptjs` - Password hashing
- `cookie-parser` - Cookie parsing
- `express-rate-limit` - API rate limiting
- `helmet` - Security headers
- `sequelize` - ORM for database operations
- `pg` - PostgreSQL driver

### Database
- PostgreSQL 12+ with PostGIS extension
- Tables: `users`, `long_term_tokens`, `session`

## Performance Considerations

- Session queries optimized via PostgreSQL indexing
- bcrypt hashing is CPU-intensive; may impact signup/login performance under high load
- Token validation requires database query on each authenticated request
- Connection pooling configured via `DB_POOL_MAX`, `DB_POOL_TIMEOUT`, `DB_POOL_IDLE` environment variables

<!-- HUMAN REVIEW NEEDED: Confirm if performance benchmarks exist for authentication operations -->

## Future Enhancement Opportunities

<!-- HUMAN REVIEW NEEDED: Validate if these are actual planned features or speculative improvements -->

1. OAuth2 provider support (Google, GitHub, Microsoft)
2. Two-factor authentication (TOTP, SMS)
3. Email-based password reset (automated email delivery)
4. Account lockout after failed login attempts
5. Audit logging for authentication events
6. Session management UI (view/revoke active sessions)
7. API key rotation mechanism
8. Role-based access control (RBAC) beyond simple permission strings
9. User groups and team management
10. Password expiration policies

## References

### Code Locations
- User Routes: `API/Backend/Users/routes/users.js`
- User Model: `API/Backend/Users/models/user.js`
- Account Routes: `API/Backend/Accounts/routes/accounts.js`
- Token Routes: `API/Backend/LongTermToken/routes/longtermtokens.js`
- Token Model: `API/Backend/LongTermToken/models/longtermtokens.js`
- Server Middleware: `scripts/server.js`
- UI Components: `configure/src/pages/UsersAccess/UsersAccess.js`
- Login Templates: `views/login.pug`, `views/adminlogin.pug`, `views/resetpassword.pug`
- Environment Documentation: `docs/pages/Setup/ENVs/ENVs.md`

### Configuration
- Sample Environment: `sample.env`
- Environment Configuration: `configuration/env.js`
