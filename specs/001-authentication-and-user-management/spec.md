# Authentication & User Management - Feature Specification

## Overview

The MMGIS Authentication & User Management system provides a comprehensive security and access control framework for the Multi-Mission Geographic Information System. The feature was implemented to support multiple authentication modes, user role management, session handling, and secure token-based API access for planetary mission operations.

## Feature Description

### Core Capabilities

The authentication system supports four distinct operational modes, each designed for different deployment scenarios and security requirements:

1. **Off Mode** - No authentication required. Guest access only. Users cannot sign up or log in. Tools requiring authentication are disabled.

2. **None Mode** - Open access with optional authentication. Guests can browse, but users can voluntarily sign up and log in to access additional features.

3. **Local Mode** - Credential-based authentication required. All unauthenticated users are blocked. Administrator must create accounts or enable self-signup via environment configuration.

4. **CSSO Mode** - Cloud Single Sign-On integration. External LDAP/OAuth2 service proxied in front of MMGIS handles authentication.

### User Roles & Permissions

The system implements a three-tier permission model represented by a three-character binary string:

- **SuperAdmin (111)** - Full system access including user management, configuration editing, and all mission data access
- **Admin (110)** - Configuration editing and mission management capabilities, with optional mission-specific restrictions
- **User (001)** - Basic authenticated access to MMGIS features

<!-- HUMAN REVIEW NEEDED: Verify if there are additional permission combinations (e.g., 010, 011, 100, 101) that were intended for future use or have specific meanings -->

### Authentication Features

#### User Registration & Login
- Strong password requirements enforced (minimum 8 characters, uppercase, lowercase, number, symbol)
- bcrypt password hashing with salt generation
- First user automatically receives SuperAdmin (111) permissions
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
- Tokens inherit creator's permissions and mission access
- Configurable expiration periods (time-based or "never")
- Bearer token format for HTTP Authorization headers
- Admin users can only manage their own tokens; SuperAdmins can manage all tokens

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

When AUTH=csso, the system expects an upstream proxy to handle authentication and inject headers:

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
  permission: ENUM('000','001','010','011','100','101','110','111') NOT NULL DEFAULT '000'
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

- `AUTH` - Authentication mode (off|none|local|csso)
- `SECRET` - Session encryption secret
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` - PostgreSQL connection

### Optional Authentication Variables

- `AUTH_LOCAL_ALLOW_SIGNUP` - Allow user self-registration when AUTH=local (default: false)
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

### Users Management Interface (`configure/src/pages/Users/Users.js`)
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
req.session.permission  // Permission string (e.g., "111")
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
- First user automatically receives SuperAdmin (111) permissions
- This ensures someone always has administrative access

### Permission Inheritance
- Long-term tokens inherit permissions from creating user
- Admin users can be restricted to specific missions via `missions_managing` array
- SuperAdmins have unrestricted access to all missions

### Token Lifecycle
- Session tokens regenerated on each login for security
- Session tokens cleared on logout
- Long-term tokens persist until explicitly deleted or expired
- Token expiration checked on each API request

### User Deletion Rules
- Original administrator (ID 1) cannot be deleted
- User deletion is permanent and cascades to sessions
- Long-term tokens remain valid until cleaned up separately

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
- UI Components: `configure/src/pages/Users/Users.js`
- Login Templates: `views/login.pug`, `views/adminlogin.pug`, `views/resetpassword.pug`
- Environment Documentation: `docs/pages/Setup/ENVs/ENVs.md`

### Configuration
- Sample Environment: `sample.env`
- Environment Configuration: `configuration/env.js`
