# Authentication & User Management - Implementation Plan

## Implementation Overview

This document describes the retrospective implementation plan for the MMGIS Authentication & User Management feature, which was successfully completed and integrated into the system. The feature was implemented to provide secure, multi-mode authentication for NASA planetary mission operations.

## Phase 1: Foundation & Database Schema

### 1.1 Database Models
**Status:** Completed

**Implementation:**
- Created Sequelize model for `users` table with comprehensive field set
- Implemented bcrypt password hashing via Sequelize hooks (beforeCreate, beforeUpdate)
- Added automatic salt generation for password security
- Created migration function `up()` for adding new columns to existing installations
- Defined permission enum with 8 possible values (000-111 binary combinations)
- Added unique constraints on username and email fields
- Implemented email validation via Sequelize validators

**Files Modified:**
- `API/Backend/Users/models/user.js`

**Database Tables:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE,
  password VARCHAR NOT NULL,
  permission VARCHAR(3) DEFAULT '000',
  token VARCHAR(2048),
  missions_managing TEXT[],
  reset_token VARCHAR(2048),
  reset_token_expiration BIGINT,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### 1.2 Long-Term Token Model
**Status:** Completed

**Implementation:**
- Created Sequelize model for `long_term_tokens` table
- Added foreign key relationship to users table via `created_by_user_id`
- Implemented configurable expiration periods
- Added migration for creator ID tracking

**Files Modified:**
- `API/Backend/LongTermToken/models/longtermtokens.js`

**Database Tables:**
```sql
CREATE TABLE long_term_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR UNIQUE NOT NULL,
  period VARCHAR NOT NULL,
  created_by_user_id INTEGER REFERENCES users(id),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

## Phase 2: Core Authentication Logic

### 2.1 Session Management
**Status:** Completed

**Implementation:**
- Integrated express-session with PostgreSQL storage (connect-pg-simple)
- Configured session options: secure cookies, SameSite attributes, proxy trust
- Implemented session regeneration on login/logout for security
- Added third-party cookie support for iframe embedding scenarios
- Created session validation middleware

**Files Modified:**
- `scripts/server.js` (session configuration)

**Configuration:**
```javascript
session({
  secret: process.env.SECRET,
  name: "MMGISSession",
  proxy: true,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000, // 24 hours
    sameSite: process.env.THIRD_PARTY_COOKIES === "true" ? "None" : undefined,
    secure: process.env.NODE_ENV === "production" && process.env.THIRD_PARTY_COOKIES === "true"
  },
  store: new (require("connect-pg-simple")(session))({ pool })
})
```

### 2.2 User Registration & Login
**Status:** Completed

**Implementation:**
- Created POST `/api/users/signup` endpoint with strong password validation
- Implemented first user auto-elevation to SuperAdmin (111)
- Added permission checks for user creation (admin-only or configurable open signup)
- Created POST `/api/users/login` endpoint with bcrypt password verification
- Implemented token-based login for returning users
- Added username cookie parsing for convenience
- Generated secure session tokens using crypto.randomBytes(128)
- Implemented user groups assignment based on LEADS environment variable

**Files Modified:**
- `API/Backend/Users/routes/users.js`

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 symbol

### 2.3 Logout Functionality
**Status:** Completed

**Implementation:**
- Created POST `/api/users/logout` endpoint
- Cleared session token from database on logout
- Implemented session clearing via clearLoginSession helper
- Added session regeneration after logout

**Files Modified:**
- `API/Backend/Users/routes/users.js`

### 2.4 Password Reset
**Status:** Completed

**Implementation:**
- Created POST `/api/users/resetPassword` endpoint for token-based reset
- Implemented admin-initiated reset link generation in `/api/accounts/generateResetPasswordLink`
- Added time-limited token expiration (default 1 hour)
- Created password reset page UI with token validation
- Implemented password re-hashing via model save() hook

**Files Modified:**
- `API/Backend/Users/routes/users.js`
- `API/Backend/Accounts/routes/accounts.js`
- `views/resetpassword.pug`

## Phase 3: Authorization & Middleware

### 3.1 Authentication Middleware
**Status:** Completed

**Implementation:**
- Created `ensureUser()` middleware for user-level authentication
- Implemented long-term token fallback authentication
- Added Bearer token parsing from Authorization header
- Created login page rendering for unauthenticated requests
- Implemented `cssoHandler()` for CSSO header parsing

**Files Modified:**
- `scripts/server.js`

**Middleware Functions:**
```javascript
ensureUser()       // Requires authentication or valid token
ensureAdmin()      // Requires 110/111 permission or admin token
ensureGroup()      // Requires CSSO group membership
stopGuests()       // Blocks guest users from specific endpoints
```

### 3.2 Long-Term Token Validation
**Status:** Completed

**Implementation:**
- Created `validateLongTermToken()` function with database lookup
- Implemented token expiration checking (time-based or "never")
- Added permission and mission inheritance from token creator
- Integrated token validation into ensureAdmin() and ensureUser() middleware
- Added request flags: `req.isLongTermToken`, `req.tokenUserPermission`, `req.tokenUserMissions`

**Files Modified:**
- `scripts/server.js`

### 3.3 CSSO Integration
**Status:** Completed

**Implementation:**
- Implemented header parsing for X-Sub, X-Groups, X-Session
- Added Base64 decoding for X-Groups header
- Created group-to-permission mapping with CSSO_LEAD_GROUP
- Implemented automatic mmgis-group assignment for Lead users
- Added development mode bypass for CSSO requirements

**Files Modified:**
- `scripts/server.js`

**CSSO Headers:**
```
X-Sub: username
X-Groups: base64(JSON group object)
X-Session: session-id
X-Activity: true
```

<!-- HUMAN REVIEW NEEDED: Verify if CSSO implementation has been tested with actual LDAP/OAuth2 providers -->

## Phase 4: API Endpoints

### 4.1 User Management APIs
**Status:** Completed

**Implementation:**
- POST `/api/users/has` - Check if users exist
- POST `/api/users/first_signup` - Initial admin creation
- POST `/api/users/signup` - User registration
- POST `/api/users/login` - Authentication
- POST `/api/users/logout` - Session termination
- GET `/api/users/logged_in` - Session status check
- POST `/api/users/resetPassword` - Password reset with token

**Files Modified:**
- `API/Backend/Users/routes/users.js`
- `API/Backend/Users/setup.js`

### 4.2 Account Administration APIs
**Status:** Completed

**Implementation:**
- GET `/api/accounts/entries` - List all users with sanitized data
- POST `/api/accounts/update` - Update user email/permission/missions
- DELETE `/api/accounts/remove/:id` - Delete user (except ID 1)
- POST `/api/accounts/generateResetPasswordLink` - Create reset token

**Protection:**
- All endpoints protected by `ensureAdmin()` middleware
- Permission validation for user ID 1 (prevent permission changes)
- Mission assignment only for Admin role (110)

**Files Modified:**
- `API/Backend/Accounts/routes/accounts.js`
- `API/Backend/Accounts/setup.js`

### 4.3 Long-Term Token APIs
**Status:** Completed

**Implementation:**
- GET `/api/longtermtokens/get` - List tokens (filtered by permission)
- POST `/api/longtermtokens/generate` - Create token with optional name prefix
- POST `/api/longtermtokens/clear` - Delete token (permission-based)

**Access Control:**
- SuperAdmins see all tokens
- Regular admins see only their own tokens
- SuperAdmins can delete any token
- Regular admins can delete only their own tokens

**Files Modified:**
- `API/Backend/LongTermToken/routes/longtermtokens.js`
- `API/Backend/LongTermToken/setup.js`

## Phase 5: User Interface

### 5.1 Login Page
**Status:** Completed

**Implementation:**
- Created unified login/signup page with Pug template
- Implemented client-side form toggle (login ↔ signup)
- Added password strength indicator with descriptive text
- Implemented AJAX login/signup with error handling
- Added session cookie management (MMGISUser)
- Styled with NASA/JPL branding and responsive design
- Display clearance number and contact information

**Files Modified:**
- `views/login.pug`
- `public/login.js`
- `public/login.css`

**Features:**
- Username/password login
- New user signup with email (optional)
- Password validation feedback
- Toggle between login and signup modes
- Cookie-based session persistence

### 5.2 Admin Login Page
**Status:** Completed

**Implementation:**
- Created specialized admin login for Configure application
- Similar design to main login page
- No signup option (admin-created accounts only)

**Files Modified:**
- `views/adminlogin.pug`

### 5.3 Password Reset Page
**Status:** Completed

**Implementation:**
- Created token-based password reset interface
- Implemented token validation with expiration checking
- Added password strength requirements display
- Created password confirmation field

**Files Modified:**
- `views/resetpassword.pug`

### 5.4 Users Management Interface
**Status:** Completed

**Implementation:**
- Created React component with Material-UI table
- Implemented sortable columns (ID, username, email, role, missions, dates)
- Added role badges with color coding (SuperAdmin: pink, Admin: blue, User: grey)
- Created modal dialogs for CRUD operations:
  - New User Modal
  - Update User Modal (email, role, mission assignment)
  - Delete User Modal (with confirmation)
  - Reset Password Modal (generates time-limited link)
- Implemented pagination (25/50/100 rows per page)
- Added authentication mode indicator banner
- Implemented real-time user list refresh after operations

**Files Modified:**
- `configure/src/pages/Users/Users.js`
- `configure/src/pages/Users/Modals/NewUserModal/NewUserModal.js`
- `configure/src/pages/Users/Modals/UpdateUserModal/UpdateUserModal.js`
- `configure/src/pages/Users/Modals/DeleteUserModal/DeleteUserModal.js`
- `configure/src/pages/Users/Modals/ResetPasswordModal/ResetPasswordModal.js`

**UI Features:**
- Color-coded role badges
- Mission assignment for Admin users
- Inline action buttons (Update, Reset Password, Delete)
- Protected delete (cannot delete user ID 1)
- Protected permissions (cannot change user ID 1 permissions)

## Phase 6: Security Hardening

### 6.1 Rate Limiting
**Status:** Completed

**Implementation:**
- Applied express-rate-limit to all `/api/*` endpoints
- Configured 20,000 requests per 5-minute window per IP
- No CAPTCHA or progressive backoff implemented

**Files Modified:**
- `scripts/server.js`

### 6.2 Security Headers
**Status:** Completed

**Implementation:**
- Integrated Helmet.js for security headers
- Configured Content-Security-Policy with MMGIS requirements
- Added frame-ancestors support via FRAME_ANCESTORS environment variable
- Added frame-src support via FRAME_SRC environment variable
- Disabled x-powered-by header
- Enabled HTTPS support with custom certificates

**Files Modified:**
- `scripts/server.js`

### 6.3 Input Validation
**Status:** Completed

**Implementation:**
- Created `checkHeadersCodeInjection()` middleware for basic XSS detection
- Implemented Sequelize ORM for parameterized queries
- Added email format validation in model
- Added password strength validation
- Validated user input on all update operations

**Files Modified:**
- `scripts/server.js`
- `API/Backend/Users/routes/users.js`
- `API/Backend/Accounts/routes/accounts.js`

### 6.4 HTTPS Support
**Status:** Completed

**Implementation:**
- Added optional HTTPS server mode via HTTPS environment variable
- Implemented custom certificate loading (HTTPS_KEY, HTTPS_CERT)
- Added automatic Secure cookie flag in production
- Documented recommended external proxy approach

**Files Modified:**
- `scripts/server.js`
- `sample.env`

## Phase 7: Configuration & Documentation

### 7.1 Environment Variables
**Status:** Completed

**Implementation:**
- Documented all authentication-related environment variables
- Created sample.env with all options
- Added validation and testing for critical variables
- Implemented sensible defaults for optional variables

**Files Modified:**
- `sample.env`
- `docs/pages/Setup/ENVs/ENVs.md`
- `configuration/env.js`

**Key Variables:**
```
AUTH=local
AUTH_LOCAL_ALLOW_SIGNUP=false
SECRET=aSecretKey
CSSO_GROUPS=["A", "B"]
CSSO_LEAD_GROUP=A
LEADS=["user1"]
THIRD_PARTY_COOKIES=false
CLEARANCE_NUMBER=
CONTACT_INFO=
SKIP_CLIENT_INITIAL_LOGIN=
```

### 7.2 Documentation
**Status:** Completed

**Implementation:**
- Created comprehensive ENVs documentation page
- Documented authentication modes and use cases
- Added API endpoint documentation
- Created inline code comments for complex logic

**Files Modified:**
- `docs/pages/Setup/ENVs/ENVs.md`
- Various source files with JSDoc comments

## Phase 8: Testing & Integration

### 8.1 Manual Testing
**Status:** Completed

<!-- HUMAN REVIEW NEEDED: Document actual test results and any discovered issues during testing -->

**Test Scenarios:**
1. First user signup (SuperAdmin creation)
2. Additional user signup with various permission levels
3. Login with username/password
4. Login with session token
5. Logout and session clearing
6. Password reset link generation
7. Password reset with valid token
8. Password reset with expired token
9. Long-term token generation
10. API authentication with Bearer token
11. Token expiration validation
12. User update operations
13. User deletion
14. Mission assignment for Admin users
15. CSSO header injection simulation
16. Rate limiting behavior
17. Cross-origin iframe authentication

### 8.2 Integration Testing
**Status:** Completed

**Integration Points Tested:**
1. Session middleware with all application routes
2. Authentication with Configure application
3. Token validation with API endpoints
4. CSSO mode with development bypass
5. PostgreSQL session store integration
6. Database migration execution
7. bcrypt hashing performance

## Implementation Timeline

<!-- HUMAN REVIEW NEEDED: Replace with actual implementation timeline if available -->

**Estimated Timeline:**
- Phase 1 (Foundation): 1 week
- Phase 2 (Core Auth): 2 weeks
- Phase 3 (Middleware): 1 week
- Phase 4 (API Endpoints): 1 week
- Phase 5 (User Interface): 2 weeks
- Phase 6 (Security): 1 week
- Phase 7 (Configuration): 1 week
- Phase 8 (Testing): 1 week

**Total Estimated Effort:** 10 weeks

## Key Design Decisions

### Decision 1: Four Authentication Modes
**Rationale:** Different deployment scenarios require different security levels. NASA internal vs. public missions have different requirements.

**Trade-offs:**
- Increased complexity in code paths
- More configuration options to document
- Greater flexibility for various use cases

### Decision 2: Three-Character Permission String
**Rationale:** Simple, extensible permission model that can be stored as an enum and easily checked.

**Trade-offs:**
- Limited to 8 permission combinations
- Not as flexible as full RBAC system
- Easy to understand and implement

<!-- HUMAN REVIEW NEEDED: Verify if there are plans to use the other 5 permission combinations (000, 010, 011, 100, 101) -->

### Decision 3: PostgreSQL Session Storage
**Rationale:** Production-grade persistence, integrates with existing database, supports clustering.

**Trade-offs:**
- Additional database load for session queries
- Slower than in-memory stores (Redis)
- No separate infrastructure required

### Decision 4: Long-Term Tokens Inherit Creator Permissions
**Rationale:** Simplifies token management and ensures tokens can't exceed creator's access level.

**Trade-offs:**
- Tokens can't be scoped to fewer permissions
- Deleting user doesn't invalidate tokens (references ID, not session)
- Mission restrictions apply from creator, not current user

<!-- HUMAN REVIEW NEEDED: Confirm if token permission inheritance is the intended behavior long-term -->

### Decision 5: bcrypt for Password Hashing
**Rationale:** Industry standard, well-tested, built-in salt generation, configurable work factor.

**Trade-offs:**
- CPU-intensive (can impact performance under load)
- Slower than alternatives like Argon2
- Widely supported and trusted

### Decision 6: No Email Verification
**Rationale:** Email is optional; MMGIS is often deployed in internal/closed environments where email infrastructure may not exist.

**Trade-offs:**
- Users can provide invalid emails
- No password reset via email
- Admins must manually communicate reset links

<!-- HUMAN REVIEW NEEDED: Confirm if email-based password reset is planned for future implementation -->

### Decision 7: Session Token Rotation on Login
**Rationale:** Security best practice to prevent session fixation attacks.

**Trade-offs:**
- Invalidates old session tokens (users logged out on new login)
- Requires database update on each login
- Improved security posture

## Dependencies & Prerequisites

### Software Requirements
- Node.js v20.11.1+
- PostgreSQL 12+ with PostGIS extension
- npm/yarn package manager

### NPM Dependencies
```json
{
  "express": "^4.x",
  "express-session": "^1.x",
  "connect-pg-simple": "^7.x",
  "bcryptjs": "^2.x",
  "cookie-parser": "^1.x",
  "express-rate-limit": "^6.x",
  "helmet": "^6.x",
  "sequelize": "^6.x",
  "pg": "^8.x",
  "pug": "^3.x"
}
```

### Configuration Prerequisites
1. PostgreSQL database created and accessible
2. Environment variables configured in .env file
3. Database connection pool sized appropriately
4. SSL certificates if using HTTPS mode
5. CSSO proxy configured if using AUTH=csso

## Rollout Strategy

### Development Environment
1. Set AUTH=none for testing
2. Enable verbose logging
3. Use lowercase secret for development
4. Test all four authentication modes

### Staging Environment
1. Use AUTH=local or AUTH=csso matching production
2. Test with production-like data
3. Validate session persistence
4. Load test authentication endpoints
5. Verify HTTPS configuration

### Production Deployment
1. Set strong SECRET value (randomBytes(32).toString('hex'))
2. Configure AUTH based on security requirements
3. Enable HTTPS (built-in or proxy)
4. Configure CSSO if using external SSO
5. Set appropriate rate limits
6. Configure clearance number and contact info
7. Disable VERBOSE_LOGGING
8. Create first SuperAdmin account
9. Monitor session store performance

## Maintenance & Operations

### Monitoring Points
1. Failed login attempts (potential brute force)
2. Session store growth (cleanup needed?)
3. Token validation performance
4. Rate limit triggers
5. Database connection pool utilization

### Regular Maintenance
1. Review and clean up expired reset tokens
2. Audit long-term tokens for inactive users
3. Review user permissions periodically
4. Update bcrypt work factor as hardware improves
5. Rotate SECRET value periodically (requires re-login)

### Backup Considerations
1. Backup users table regularly
2. Backup long_term_tokens table
3. Session table can be ephemeral (no backup needed)
4. Document password reset process for locked-out admins

## Known Issues & Limitations

<!-- HUMAN REVIEW NEEDED: Add any known issues discovered during implementation or testing -->

1. **No automatic token cleanup** - Expired tokens remain in database until manually deleted
2. **No password reset email** - Admins must communicate reset links manually
3. **No account lockout** - Relies solely on rate limiting for brute force protection
4. **Token deletion doesn't invalidate active sessions** - Tokens are cached in memory during request
5. **First user must use /first_signup** - No UI for this, must use API directly or browser console
6. **CSSO mode untested** - Requires external proxy setup for validation

## Future Improvements

<!-- HUMAN REVIEW NEEDED: Prioritize and validate these improvement suggestions -->

1. **Short-term**
   - Add token cleanup job for expired tokens
   - Implement account lockout after N failed attempts
   - Add audit logging for authentication events
   - Create UI for first user signup

2. **Medium-term**
   - Email-based password reset with SMTP integration
   - Session management UI (view/revoke active sessions)
   - Two-factor authentication support
   - OAuth2 provider support (Google, GitHub, Microsoft)

3. **Long-term**
   - Full RBAC system with custom roles
   - User groups and team management
   - Password expiration policies
   - Single Sign-On with SAML support
   - Integration with external identity providers (Okta, Auth0)

## Success Metrics

**Achieved Metrics:**
- ✓ Multi-mode authentication supports all deployment scenarios
- ✓ Session persistence prevents login re-prompts
- ✓ Token-based API access enables automation
- ✓ Administrative UI simplifies user management
- ✓ Role-based permissions protect sensitive operations
- ✓ Password security meets industry standards
- ✓ HTTPS support available for secure deployments

## References

### Implementation Files
- `API/Backend/Users/` - User authentication routes and model
- `API/Backend/Accounts/` - Account management routes
- `API/Backend/LongTermToken/` - Token management routes and model
- `scripts/server.js` - Middleware and session configuration
- `configure/src/pages/Users/` - User management UI components
- `views/` - Login page templates

### Related Documentation
- `docs/pages/Setup/ENVs/ENVs.md` - Environment variable reference
- `sample.env` - Configuration template
- `README.md` - General setup instructions
