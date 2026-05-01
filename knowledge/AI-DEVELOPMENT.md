# AI-Assisted Development with MMGIS

**Guide Version**: 1.0.0
**Last Updated**: 2025-12-18

This guide explains how to effectively use AI agents (like Claude Code) with MMGIS's spec-kit workflow for feature development.

---

## Table of Contents

1. [When to Use Spec-Kit vs Simple Mode](#when-to-use-spec-kit-vs-simple-mode)
2. [The Spec-Kit Workflow](#the-spec-kit-workflow)
3. [Working with the Constitution](#working-with-the-constitution)
4. [Common Scenarios](#common-scenarios)
5. [Tips for Effective AI Development](#tips-for-effective-ai-development)
6. [Troubleshooting](#troubleshooting)

---

## When to Use Spec-Kit vs Simple Mode

### Use Spec-Kit Workflow When:

✅ **Adding new features**
- User authentication enhancements
- New mapping tools
- API endpoints
- Data visualization features

✅ **Significant changes**
- Refactoring tool plugin architecture
- Database schema changes
- API contract modifications
- Security implementations

✅ **Multi-file changes**
- Touches more than 3 files
- Affects multiple subsystems
- Requires careful coordination

✅ **Team collaboration needed**
- Multiple developers working together
- Requires stakeholder review
- Mission-critical functionality

### Use Simple Mode (No Spec-Kit) When:

✅ **Bug fixes**
- Simple logic errors
- Typos or formatting
- Quick patches

✅ **Documentation only**
- README updates
- Code comments
- JSDoc additions

✅ **Configuration changes**
- Environment variables
- Build configuration tweaks
- Linter rule adjustments

✅ **Trivial changes**
- Renaming variables
- Removing unused code
- Single-line fixes

---

## The Spec-Kit Workflow

### Overview

Spec-kit enforces a documentation-first approach aligned with MMGIS's constitution:

```
Specify → Plan → Tasks → Implement → Checklist → Deploy
```

Each step produces a document and requires review before proceeding.

### Step 1: Specify (`/speckit.specify`)

**Purpose**: Define WHAT you're building and WHY.

**Command**: `/speckit.specify "Add OAuth2 authentication for mission users"`

**What Gets Created**: `specs/NNN-feature-name/spec.md`

**Contents**:
- **Overview**: Brief feature description
- **User Scenarios**: Personas, workflows, acceptance criteria
- **Requirements**: Functional (FR-###) and non-functional (NFR-###)
- **Success Criteria**: How you'll know it's done

**Example User Scenario**:
```markdown
### P1 - Mission Scientist Login

**As a** mission scientist
**I want to** log in with my NASA credentials
**So that** I can access mission-specific geospatial data

**Acceptance Criteria**:
- [ ] Login form accepts NASA email and password
- [ ] OAuth2 redirect to NASA SSO works correctly
- [ ] User is redirected to mission dashboard after auth
- [ ] Session persists for 24 hours
- [ ] Invalid credentials show clear error message

**User Flow**:
1. Scientist visits https://mmgis.nasa.gov/mars2020
2. Clicks "Login with NASA SSO"
3. Redirected to NASA OAuth2 authorization page
4. Approves access to MMGIS
5. Redirected back to MMGIS with access token
6. Dashboard loads with mission-specific layers
```

**Review Checkpoint**:
- Are requirements clear and testable?
- Do user scenarios cover all personas?
- Are acceptance criteria measurable?
- Any open questions that need answers?

### Step 2: Plan (`/speckit.plan`)

**Purpose**: Define HOW you'll build it technically.

**Command**: `/speckit.plan` (run from within feature directory or specify path)

**What Gets Created**: `specs/NNN-feature-name/plan.md`

**Contents**:
- **Technical Context**: Dependencies, tech stack
- **Constitution Check**: Verify all 7 principles
- **Architecture**: Components, data flow, diagrams
- **Database Changes**: Schema, migrations
- **API Contracts**: Request/response schemas
- **Technical Decisions**: Choices made and rationale
- **Security & Performance**: Considerations

**Example Architecture Section**:
```markdown
## Architecture & Design

### High-Level Architecture

```
Frontend                 Backend              External
┌─────────────┐         ┌──────────────┐    ┌──────────┐
│ Login UI    │────────>│ OAuth2       │───>│ NASA SSO │
│ (React)     │<────────│ Middleware   │<───│          │
└─────────────┘         └──────────────┘    └──────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ User Model   │
                        │ (Sequelize)  │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ PostgreSQL   │
                        └──────────────┘
```

### Component Breakdown

**Component 1: OAuth2 Passport Strategy**
- **Purpose**: Handle NASA SSO authentication flow
- **Responsibilities**:
  - Register OAuth2 strategy with Passport.js
  - Handle callback from NASA SSO
  - Validate and exchange authorization code for tokens
  - Create or update user in database
- **Interfaces**:
  - `/api/auth/nasa` - Initiates OAuth2 flow
  - `/api/auth/nasa/callback` - Handles OAuth2 callback
  - Returns Express middleware for route protection
```

**Constitution Check Example**:
```markdown
## Constitution Check

Evaluating against `.specify/memory/constitution.md`:

### Principle I: Documentation-First
**Compliance**: ✅ Yes
**Notes**: This spec.md and plan.md created before implementation

### Principle IV: Quality Standards
**Compliance**: ✅ Yes
**Notes**:
- Unit tests planned for OAuth2 strategy
- Integration tests for auth flow
- Security checklist includes OAuth2 best practices
- Target coverage: 85% (above 80% threshold)

### Principle VI: Geospatial Data Integrity
**Compliance**: ⚠️ Partial
**Notes**: Authentication doesn't directly affect geospatial data, but role-based access control will ensure only authorized users can modify geodata

### Principle VII: Real-time Collaboration Safety
**Compliance**: ✅ Yes
**Notes**: WebSocket connections will require authenticated session from this OAuth2 flow
```

**Review Checkpoint**:
- Does architecture make sense?
- Are all constitution principles addressed?
- Are technical decisions justified?
- Will this approach work with existing code?

### Step 3: Tasks (`/speckit.tasks`)

**Purpose**: Break work into implementable chunks.

**Command**: `/speckit.tasks`

**What Gets Created**: `specs/NNN-feature-name/tasks.md`

**Contents**:
- **Task Breakdown by Phases**: Foundation → Core → Integration → Testing → Polish
- **Each Task**: Status, estimate, dependencies, acceptance criteria
- **Progress Tracking**: Summary of completed vs pending

**Example Task**:
```markdown
### Phase 2: Core Implementation

**TASK-010**: Implement NASA OAuth2 Passport Strategy
- **Status**: ⬜ Not Started
- **Assignee**: AI Agent
- **Estimate**: 4 hours
- **Dependencies**: TASK-001 (database schema)
- **Files to Modify**:
  - `API/Backend/APIs/User.js`
  - `API/Backend/Utils/passport-nasa.js` (create new)
- **Acceptance Criteria**:
  - [ ] passport-oauth2 strategy configured with NASA SSO endpoints
  - [ ] Authorization URL redirects to NASA SSO
  - [ ] Callback handler exchanges code for access token
  - [ ] User profile fetched from NASA SSO
  - [ ] User created/updated in database
  - [ ] Session established with user ID
  - [ ] Error handling for invalid tokens
  - [ ] Unit tests cover all code paths
```

**Task Sizing Rules**:
- Each task should be completable in 1-2 days
- If > 2 days, break it down further
- Tasks should have clear entry/exit criteria
- Dependencies must be explicit

**Review Checkpoint**:
- Are all tasks small enough?
- Do tasks cover the entire plan?
- Are dependencies correct?
- Can tasks be parallelized?

### Step 4: Implement (`/speckit.implement`)

**Purpose**: Write the code.

**Command**: `/speckit.implement` (implements next pending task)

**What Happens**:
1. AI reads the next task from tasks.md
2. Checks dependencies are met
3. Implements the code changes
4. Writes/updates tests
5. Runs tests to verify
6. Updates task status to ✅ Complete
7. Moves to next task

**During Implementation**:
- AI follows patterns in plan.md
- Adheres to constitution principles
- Uses existing code patterns (see AGENTS.md)
- Writes tests alongside code
- Runs linter and fixes issues

**Example Implementation Log**:
```
Starting TASK-010: Implement NASA OAuth2 Passport Strategy

✓ Read task acceptance criteria
✓ Created API/Backend/Utils/passport-nasa.js
✓ Configured passport-oauth2 strategy
✓ Added routes to API/Backend/APIs/User.js
✓ Wrote unit tests in API/Backend/Utils/passport-nasa.test.js
✓ Tests passing (12/12)
✓ ESLint passing
✓ Updated tasks.md: TASK-010 → ✅ Complete

Moving to TASK-011: Add role-based access control middleware
```

**You Can**:
- Review code as it's written
- Ask AI to pause and explain decisions
- Request changes to approach
- Have AI refactor if code isn't clean

### Step 5: Checklist (`/speckit.checklist`)

**Purpose**: Verify readiness for production.

**Command**: `/speckit.checklist`

**What Gets Created**: Checklist based on `.specify/templates/checklist-template.md`

**Checklist Sections**:
- ✅ **Pre-Implementation**: Spec/plan approved
- ✅ **Code Quality**: ESLint, no debugging code left
- ✅ **Testing**: Unit/integration/E2E, 80%+ coverage
- ✅ **Security**: Auth, validation, no vulnerabilities
- ✅ **Performance**: Meets requirements
- ✅ **Documentation**: README, API docs updated
- ✅ **Code Review**: PR created and approved
- ✅ **Deployment**: Feature flag, monitoring configured
- ✅ **Constitution Compliance**: All 7 principles checked

**Review Checkpoint**:
- Are all checklist items complete?
- Is test coverage above 80%?
- Have security concerns been addressed?
- Is the feature ready to ship?

### Step 6: Deploy

**Not automated by spec-kit** - requires human approval.

**Steps**:
1. Create PR with link to spec
2. Code review by team
3. Merge to main
4. Deploy to staging
5. Smoke test
6. Deploy to production
7. Monitor for issues

---

## Working with the Constitution

MMGIS's constitution (`.specify/memory/constitution.md`) defines 7 core principles that ALL code must follow.

### The 7 Principles

1. **Documentation-First** - Spec before code
2. **Clear Requirements** - Measurable acceptance criteria
3. **Incremental Delivery** - Small, deployable chunks
4. **Quality Standards** - 80% test coverage, ESLint passing, security checks
5. **Node.js Best Practices** - Async/await, proper error handling, modularity
6. **Geospatial Data Integrity** - Explicit CRS, validation, accuracy
7. **Real-time Collaboration Safety** - Secure WebSockets, concurrent edit handling

### How AI Uses the Constitution

During `/speckit.plan`, AI checks every principle:

```markdown
### Principle VI: Geospatial Data Integrity
**Compliance**: ✅ Yes
**Notes**: New GeoJSON upload endpoint validates:
- CRS is specified (defaults to EPSG:4326)
- Geometry is valid (no self-intersections)
- Coordinates are in bounds
- Uses geojson-validation library
```

If a principle can't be met, AI flags it:

```markdown
### Principle III: Incremental Delivery
**Compliance**: ⚠️ Partial
**Notes**: Large refactor of 40 files. Should be broken into phases:
- Phase 1: Refactor base classes (10 files)
- Phase 2: Update tool plugins (20 files)
- Phase 3: Update tests (10 files)
Recommendation: Use feature flags to incrementally roll out.
```

### Updating the Constitution

As the project evolves, you may need to update principles:

**Command**: `/speckit.constitution`

**Example Scenario**: You want to enforce TypeScript usage

```markdown
# Proposed Amendment: Principle VIII - TypeScript First

**Rationale**: As codebase grows, type safety becomes critical for maintainability

**Proposed Principle**:
### VIII. TypeScript First
All new code must be written in TypeScript with strict mode enabled.
No `any` types without explicit justification in comments.

**Impact**:
- New files: .ts/.tsx only
- Existing files: Gradual migration, no requirement to refactor
- Tests: TypeScript preferred but Jest allows .js

**Vote Required**: Yes (team discussion needed)
```

---

## Common Scenarios

### Scenario 1: Adding a New Mapping Tool

**Goal**: Create a "Slope Analysis" tool that calculates terrain slope from elevation data.

**Steps**:

1. **Specify**:
   ```
   /speckit.specify "Add Slope Analysis tool that calculates and visualizes terrain slope from DEM layers"
   ```

   AI creates `specs/011-slope-analysis-tool/spec.md` with:
   - User scenarios for mission geologists
   - Requirements for slope calculation algorithms
   - UI mockup descriptions
   - Success criteria (performance, accuracy)

2. **Plan**:
   ```
   /speckit.plan
   ```

   AI creates plan.md with:
   - Tool plugin architecture (extends Tool_ base class)
   - Algorithm choice (Horn's method for slope calculation)
   - UI components (result overlay, legend, export button)
   - Performance strategy (Web Workers for calculation)
   - Constitution check (geospatial integrity verified)

3. **Tasks**:
   ```
   /speckit.tasks
   ```

   AI breaks down into tasks:
   - TASK-001: Create tool directory structure
   - TASK-002: Implement slope calculation algorithm
   - TASK-003: Add Web Worker for background processing
   - TASK-004: Create UI panel with controls
   - TASK-005: Integrate with map rendering
   - TASK-006: Add result export (GeoTIFF, GeoJSON)
   - TASK-007: Write unit tests for algorithm
   - TASK-008: Write integration tests
   - TASK-009: Update tool registry
   - TASK-010: Document usage in README

4. **Implement**:
   ```
   /speckit.implement
   ```

   AI implements each task, updating tasks.md as it progresses.

5. **Checklist**:
   ```
   /speckit.checklist
   ```

   AI generates checklist, verifies all items, flags any gaps.

**Result**: Production-ready Slope Analysis tool with full documentation, tests, and constitution compliance.

### Scenario 2: Fixing a Security Bug

**Goal**: Fix XSS vulnerability in user-generated layer names.

**Decision**: No spec-kit (simple bug fix)

**Steps**:

1. **Describe the bug**:
   ```
   User-generated layer names in the Layer Tool are not sanitized before rendering, allowing XSS attacks. Need to sanitize HTML in layer names before display.
   ```

2. **AI implements**:
   - Identifies affected files (LayerTool.js)
   - Adds DOMPurify or equivalent sanitization
   - Writes regression test
   - Runs tests
   - Submits PR

3. **Review**:
   - Quick code review
   - Merge and hotfix deploy

**Why no spec-kit**: Single-file change, clear fix, urgent security issue.

### Scenario 3: Refactoring WebSocket Architecture

**Goal**: Refactor WebSocket server to use Redis for horizontal scaling.

**Decision**: Use spec-kit (complex, multi-file, architectural change)

**Steps**:

1. **Specify**:
   ```
   /speckit.specify "Refactor WebSocket server to use Redis pub/sub for horizontal scaling support"
   ```

   Spec includes:
   - User scenarios (unaffected - transparent to users)
   - Requirements (support 100+ concurrent connections, multi-instance deployment)
   - Success criteria (performance benchmarks, zero downtime migration)

2. **Plan**:
   Plan includes:
   - Architecture diagram (MMGIS instances → Redis pub/sub → all instances)
   - Migration strategy (phased rollout with feature flag)
   - Backward compatibility approach
   - Performance testing strategy

3. **Tasks**:
   - Phase 1: Add Redis adapter (5 tasks)
   - Phase 2: Update message routing (8 tasks)
   - Phase 3: Testing & migration (6 tasks)

4. **Implement** (phased):
   - Phase 1 implemented and deployed behind feature flag
   - User testing in staging
   - Phase 2 implemented
   - Full migration

**Why spec-kit**: Large refactor, affects critical real-time collaboration, needs careful planning and testing.

---

## Tips for Effective AI Development

### 1. Be Specific in Requests

❌ **Bad**: "Add authentication"
✅ **Good**: "Add OAuth2 authentication using Google provider, with role-based access control for admin vs viewer"

### 2. Reference the Constitution

When requesting features, mention relevant principles:

```
Add a new file upload endpoint. Make sure it follows Principle VI (Geospatial Data Integrity) - validate CRS and geometry before accepting uploads.
```

### 3. Review Generated Specs

AI generates specs, but YOU know the domain:

- ✅ Check user scenarios match real workflows
- ✅ Verify acceptance criteria are measurable
- ✅ Add missing edge cases
- ✅ Clarify ambiguous requirements

### 4. Iterate on Plans

If the plan doesn't look right, give feedback:

```
The plan uses MongoDB for spatial queries, but MMGIS uses PostgreSQL with PostGIS. Please revise to use PostGIS spatial functions instead.
```

### 5. Break Down Large Features

Instead of "Implement complete annotation system", do:

- Feature 1: Drawing tools (draw, edit, delete)
- Feature 2: Collaboration (real-time sync)
- Feature 3: Export/import (GeoJSON, KML)
- Feature 4: History & undo

Each gets its own spec/plan/tasks.

### 6. Use Checklist Religiously

Before merging:

```
/speckit.checklist
```

Go through every item. Don't skip security or testing sections.

### 7. Keep Constitution Updated

If you find principles are outdated or missing:

```
/speckit.constitution
```

Propose amendments as the project grows.

### 8. Leverage AGENTS.md

AGENTS.md has critical context:

- Code patterns to follow
- Common commands
- Architecture diagrams
- Troubleshooting tips

Reference it:
```
Implement the OAuth2 strategy following the "Backend: Express Route Handler" pattern in AGENTS.md.
```

### 9. Test Geospatial Features Carefully

For any geospatial code:

- ✅ Test with real mission data
- ✅ Verify coordinate transformations with known points
- ✅ Check edge cases (dateline, poles, bounding boxes)
- ✅ Visual QA in both Leaflet and Cesium

### 10. Monitor Real-time Features

For WebSocket code:

- ✅ Test with 10+ concurrent users
- ✅ Check message rate limiting
- ✅ Verify reconnection logic
- ✅ Load test message throughput

---

## Troubleshooting

### Issue: AI suggests approach that violates constitution

**Example**: AI proposes skipping tests to "move faster"

**Solution**:
```
This violates Principle IV (Quality Standards) which requires 80% test coverage. Please revise the plan to include unit and integration tests for all new code.
```

### Issue: Spec is too vague

**Example**: "Add map feature" with no details

**Solution**: Run `/speckit.clarify` to have AI ask questions:

```
/speckit.clarify
```

AI will ask:
- What specific map feature? (layer, tool, control?)
- Who are the users?
- What's the expected behavior?
- What are the acceptance criteria?

### Issue: Plan doesn't match existing architecture

**Example**: AI suggests REST endpoint but MMGIS uses Sequelize models differently

**Solution**: Point to AGENTS.md patterns:

```
The plan doesn't follow the existing Sequelize pattern. Please review the "Backend: Sequelize Model" section in AGENTS.md and update the plan to use the same structure.
```

### Issue: Tasks are too large

**Example**: TASK-001 is "Implement entire authentication system" (20+ files)

**Solution**: Ask AI to break it down:

```
TASK-001 is too large (>2 days). Please break it into smaller tasks:
- TASK-001a: Add User model with auth fields
- TASK-001b: Create login endpoint
- TASK-001c: Create logout endpoint
- TASK-001d: Add authentication middleware
- TASK-001e: Write tests for auth flow
```

### Issue: Constitution check shows violations

**Example**: Plan violates Principle VI (Geospatial Data Integrity) - no CRS validation

**Solution**: AI should flag this and propose fixes. If not, point it out:

```
The constitution check shows violation of Principle VI - the GeoJSON upload handler doesn't validate CRS. Please update the plan to include CRS validation using geojson-validation library.
```

### Issue: AI creates code that doesn't match project style

**Example**: Using console.log instead of structured logging

**Solution**: Reference constitution and AGENTS.md:

```
This code uses console.log which violates Principle V (Node.js Best Practices). MMGIS uses Winston for structured logging. Please update to use the Logger utility from API/Backend/Utils/Logger.js.
```

---

## Summary

**Spec-Kit Benefits**:
- ✅ Clear requirements before coding
- ✅ Documented technical decisions
- ✅ Trackable progress
- ✅ Constitution compliance
- ✅ Better team collaboration
- ✅ Less rework from misunderstandings

**When to Use**:
- New features
- Significant refactors
- Multi-file changes
- Anything mission-critical

**When to Skip**:
- Bug fixes
- Documentation updates
- Trivial changes

**Key Principle**:
> "Spend 20% of time planning, save 80% of time in implementation and debugging."

---

## Questions?

- **Constitution unclear?** → `/speckit.constitution`
- **Spec too vague?** → `/speckit.clarify`
- **Need to understand existing code?** → Reference AGENTS.md
- **Stuck on implementation?** → Review plan.md and tasks.md for guidance

**Remember**: AI is a tool to help you build faster and better, but YOU are the expert on MMGIS's mission and requirements. Guide the AI, review its work, and iterate until the result is production-ready.

---

Happy building! 🚀🗺️
