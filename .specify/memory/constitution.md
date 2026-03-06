# MMGIS Project Constitution

**Version**: 1.0.0
**Ratified**: 2025-12-18
**Last Amended**: 2025-12-18

## Preamble

This constitution establishes the core principles and quality standards for the MMGIS (Multi-Mission Geographic Information System) project. All contributors, whether human or AI agents, must adhere to these principles when developing features, fixing bugs, or maintaining the codebase.

## Core Principles

### I. Documentation-First Development

**Statement**: Specifications precede implementation. All features must be documented before code is written.

**Rationale**: Documentation-first development ensures:
- Clear understanding of requirements before implementation
- Alignment between stakeholders on expected behavior
- Reduced rework from misunderstood requirements
- Better long-term maintainability
- AI agents have clear context for implementation

**Application**:
- Every new feature requires a spec.md in specs/NNN-feature-name/
- Spec must include user scenarios, requirements, and success criteria
- Plan.md must document technical approach and architecture
- Tasks.md must break down implementation into reviewable chunks
- No code written until spec is reviewed and approved

**Exceptions**:
- Critical hotfixes (must be documented retroactively within 48 hours)
- Experimental prototypes (must not be merged to main)

---

### II. Clear Requirements

**Statement**: All requirements must be specific, measurable, and testable.

**Rationale**: Clear requirements prevent:
- Ambiguity leading to incorrect implementations
- Endless scope creep and feature bloat
- Inability to determine when work is complete
- Disputes about whether acceptance criteria are met

**Application**:
- Use "MUST", "SHOULD", "MAY" keywords consistently
- Every functional requirement has measurable acceptance criteria
- User scenarios include specific personas and workflows
- Non-functional requirements specify metrics (e.g., "< 200ms response time")
- Success criteria are observable and verifiable

**Exceptions**: None - all requirements must be clear before implementation begins.

---

### III. Incremental Delivery

**Statement**: Features are delivered in small, incremental chunks that can be independently tested and deployed.

**Rationale**: Incremental delivery enables:
- Faster feedback from stakeholders and users
- Reduced risk of large-scale failures
- Easier debugging and troubleshooting
- Better team velocity and morale
- Continuous value delivery to users

**Application**:
- Features broken into phases in tasks.md
- Each task completable in 1-2 days of work
- Each phase deployable independently behind feature flags
- Pull requests kept small (< 400 lines changed preferred)
- CI/CD pipeline runs on every commit

**Exceptions**:
- Large-scale refactoring (must be planned carefully with rollback strategy)
- Database migrations (must be done in phases with backward compatibility)

---

### IV. Quality Standards

**Statement**: All code must meet defined quality standards before merging.

**Rationale**: Quality standards ensure:
- Consistent codebase that's easy to maintain
- Reduced bugs and security vulnerabilities
- Faster onboarding for new contributors
- Confidence in deploying to production

**Application**:

**Code Quality**:
- ESLint passes with no errors (`npm run lint`)
- Code follows 4-space indentation and single quotes
- No unused variables or imports
- Functions kept small (< 50 lines preferred)
- Complex logic has explanatory comments

**Testing**:
- Unit tests for all business logic
- Integration tests for API endpoints
- E2E tests for critical user workflows
- Test coverage target: **80% minimum**
- All tests must pass before merging

**Security**:
- No secrets or credentials in code
- Input validation on all user-provided data
- SQL injection prevention (use parameterized queries)
- XSS prevention (sanitize outputs)
- Authentication and authorization on all protected endpoints

**Code Review**:
- All changes reviewed by at least one other developer
- Review checklist completed (see .specify/templates/checklist-template.md)
- No merge without approval
- CI pipeline must be green

**Exceptions**:
- Documentation-only changes (no code review required)
- Emergency hotfixes (can be merged with retroactive review)

---

### V. Node.js and Web Mapping Best Practices

**Statement**: Code must follow Node.js and web mapping ecosystem conventions and best practices.

**Rationale**: Following ecosystem conventions ensures:
- Familiarity for contributors from the broader community
- Compatibility with third-party libraries and tools
- Easier upgrades to newer framework versions
- Better performance through optimized patterns

**Application**:

**Node.js Backend**:
- Use async/await over callbacks
- Proper error handling with try/catch or .catch()
- Express middleware for cross-cutting concerns
- Environment variables for configuration (never hardcode)
- Graceful shutdown handling (close connections properly)
- Proper logging (use structured logging, no console.log in production)

**JavaScript/TypeScript Frontend**:
- ES6+ features preferred (const/let, arrow functions, destructuring)
- Modular code organization (one module per file)
- Avoid global state where possible
- TypeScript types where applicable (no `any` without justification)
- Event-driven architecture for tool plugins

**Web Mapping Specific**:
- Leaflet for 2D mapping, Cesium for 3D visualization
- GeoJSON as standard data interchange format
- Proper coordinate system handling (always specify CRS)
- Optimize tile loading and caching
- Handle large datasets with pagination or clustering
- Responsive design for various screen sizes

**Database** (PostgreSQL with PostGIS):
- Use Sequelize ORM models
- Spatial queries with PostGIS functions
- Proper indexing on geometry columns
- Migration scripts for schema changes
- Connection pooling for performance

**Exceptions**: None - deviations must be documented and justified in plan.md.

---

### VI. Geospatial Data Integrity

**Statement**: Coordinate systems, projections, and geodata transformations must be accurate and well-documented.

**Rationale**: MMGIS is a mission-critical geospatial system used for planetary science and exploration. Geospatial inaccuracies can lead to:
- Incorrect rover positioning or navigation
- Failed science observations
- Wasted mission resources
- Loss of stakeholder trust

**Application**:

**Coordinate System Handling**:
- Always specify coordinate reference system (CRS) explicitly
- Document expected CRS in API contracts and file formats
- Validate CRS on data ingestion
- Transform between CRS only with established libraries (proj4js)
- Test coordinate transformations with known reference points

**Geodata Validation**:
- Validate GeoJSON structure before processing
- Check for out-of-bounds coordinates
- Verify geometry validity (no self-intersections for polygons)
- Handle edge cases (dateline crossing, polar regions)
- Log validation failures with details for debugging

**Precision and Accuracy**:
- Use appropriate decimal precision for coordinate storage
- Document accuracy requirements in spec.md
- Avoid floating-point errors in geometric calculations
- Store original data without lossy transformations
- Preserve metadata about data provenance and accuracy

**Testing**:
- Unit tests for coordinate transformation functions
- Regression tests with real mission data
- Visual QA of rendered map layers
- Performance tests for large geodatasets

**Documentation**:
- Document CRS in layer configuration
- Explain projection choices in plan.md
- Note any CRS transformations in data pipeline
- Maintain list of supported coordinate systems

**Exceptions**: None - geospatial integrity is non-negotiable.

---

### VII. Real-time Collaboration Safety

**Statement**: WebSocket communications must be secured, validated, and handle concurrent edits gracefully.

**Rationale**: MMGIS supports real-time collaboration where multiple users can draw, annotate, and share data simultaneously. Poor collaboration handling can lead to:
- Data loss from concurrent edits
- Security vulnerabilities from unvalidated messages
- Performance degradation from message storms
- User frustration from conflicts

**Application**:

**WebSocket Security**:
- All WebSocket connections authenticated
- Message payloads validated before processing
- Rate limiting on message frequency per user
- Input sanitization on all message content
- Reject malformed or suspicious messages

**Concurrent Edit Handling**:
- Operational Transformation (OT) or Conflict-Free Replicated Data Types (CRDT) for shared state
- Last-write-wins with conflict resolution UI for simple cases
- Optimistic updates with server reconciliation
- Clear visual feedback for concurrent edits
- Undo/redo support that respects collaboration

**Message Protocol**:
- Well-defined message schema with versioning
- Message types documented in plan.md
- Acknowledgments for critical operations
- Heartbeat/keepalive for connection monitoring
- Graceful reconnection handling

**Performance**:
- Throttle or debounce high-frequency updates (e.g., cursor positions)
- Batch related updates when possible
- Monitor message queue sizes
- Implement backpressure mechanisms
- Test with multiple concurrent users (10+ recommended)

**Testing**:
- Unit tests for message validation
- Integration tests for concurrent scenarios
- Load tests for WebSocket scalability
- Chaos testing (network interruptions, reconnections)

**Monitoring**:
- Log WebSocket connection events
- Track message rates and errors
- Alert on abnormal patterns
- Metrics for concurrent user counts

**Exceptions**: Read-only features don't require full collaboration safety, but still need security validation.

---

## Quality Gates

All code must pass these gates before merging to main:

### Pre-Merge Checklist

- [ ] Spec.md exists and approved
- [ ] Plan.md documents technical approach
- [ ] Tasks.md tracks implementation progress
- [ ] All tasks marked complete
- [ ] ESLint passes with no errors
- [ ] Tests written and passing (80%+ coverage)
- [ ] Code reviewed and approved
- [ ] Security checklist completed
- [ ] All 7 constitutional principles reviewed for compliance
- [ ] AGENTS.md updated if needed
- [ ] **Kitchen Sink mission updated** (if new feature or changed feature)
- [ ] CI pipeline green

### Test Coverage Requirements

- **Overall coverage**: 80% minimum
- **Critical paths**: 100% coverage (authentication, authorization, data validation)
- **New code**: Must not decrease overall coverage
- **Test types**: Unit, integration, and E2E tests all represented

**Measurement**: Run `npm test -- --coverage` to verify.

### Security Requirements

- **Authentication**: All protected endpoints require valid session/token
- **Authorization**: Role-based access control (RBAC) for admin functions
- **Input Validation**: All user inputs validated on server side
- **Output Encoding**: All user-generated content sanitized before display
- **Dependencies**: No known high/critical vulnerabilities (`npm audit`)
- **Secrets Management**: Use environment variables, never commit secrets

### Performance Requirements

- **API Response Time**: < 500ms for 95th percentile
- **Page Load Time**: < 3 seconds for initial load
- **Tile Loading**: < 200ms per tile request
- **WebSocket Latency**: < 100ms for message round-trip
- **Database Queries**: < 100ms for 95th percentile (use indexes)

**Measurement**: Use performance profiling tools and load testing.

### Kitchen Sink Maintenance Requirements

**Statement**: The Kitchen Sink demo mission (`Missions/Kitchen-Sink/config.kitchen-sink.json`) serves as living documentation of all MMGIS features and must be kept current.

**Application**:
- **New Features**: When adding a new feature (layer type, tool, configuration option), MUST add example to Kitchen Sink
- **Changed Features**: When modifying existing features, MUST update Kitchen Sink configuration and examples
- **Version Matching**: Kitchen Sink version MUST match MMGIS version (e.g., both at v4.1.18)
- **Documentation**: Kitchen Sink examples MUST have clear naming conventions explaining what they demonstrate
- **Testing**: Kitchen Sink serves as E2E test target; changes must not break existing tests

**Rationale**:
- Provides reference implementation for site admins
- Ensures all features are documented by example
- Validates that new features integrate with existing system
- Maintains comprehensive test coverage
- Prevents feature decay or loss of documentation

**Enforcement**:
- Pre-merge checklist includes Kitchen Sink update verification
- Code reviewers check for Kitchen Sink updates when reviewing feature PRs
- CI/CD pipeline validates Kitchen Sink configuration loads without errors

---

## Amendment Process

This constitution can be amended by:

1. **Proposal**: Any team member proposes change via spec.md
2. **Discussion**: Team discusses rationale and implications
3. **Vote**: Majority approval from core team required
4. **Documentation**: Update this file with new version number and amendment date
5. **Communication**: Announce changes to all contributors

**Version History**:
- 1.0.0 (2025-12-18): Initial constitution with 7 core principles

---

## Enforcement

**Human Contributors**:
- Code review ensures constitutional compliance
- Pull requests blocked if principles violated
- Team retrospectives address recurring issues

**AI Agents**:
- Constitutional principles checked in /speckit.plan
- Checklist template includes constitution compliance section
- Agents must reference specific principles when making decisions

**Violations**:
- Minor: Corrected in code review
- Major: Pull request rejected, must be reworked
- Repeated: Requires team discussion and process improvement

---

## Questions?

If you're unsure whether something complies with this constitution:
1. Ask in pull request comments
2. Reference specific principle numbers
3. Propose clarification via amendment process
4. Use `/speckit.constitution` to review principles

Remember: **These principles exist to help us build better software, not to slow us down.** When in doubt, bias toward quality and communication.
