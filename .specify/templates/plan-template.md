# [Feature Name] - Technical Plan

**Spec Reference**: [Link to spec.md]
**Status**: 📋 Draft
**Created**: [Date]

## Technical Context

**Related Systems**:
- [System/component this interacts with]

**Dependencies**:
- [External library or service]

**Technology Stack**:
- [Specific technologies to be used]

## Constitution Check

Evaluating against `.specify/memory/constitution.md`:

### Principle I: Documentation-First
**Compliance**: ✅ | ⚠️ | ❌
**Notes**: [How this plan adheres to or violates this principle]

### Principle II: Clear Requirements
**Compliance**: ✅ | ⚠️ | ❌
**Notes**: [Assessment]

[Continue for all principles...]

## Architecture & Design

### High-Level Architecture

```
[ASCII diagram or description of components and their relationships]
```

### Component Breakdown

**Component 1: [Name]**
- **Purpose**: [What this component does]
- **Responsibilities**: [Specific responsibilities]
- **Interfaces**: [How other components interact with it]

**Component 2: [Name]**
[Similar structure...]

### Data Flow

```
[Diagram or description of how data flows through the system]
```

### Database Changes

**Schema Changes**:
```sql
-- New tables or columns
CREATE TABLE...
```

**Migration Strategy**:
- [How to safely apply changes]

## API Contracts

### Endpoint 1: `POST /api/resource`

**Request**:
```json
{
  "field": "type"
}
```

**Response (200)**:
```json
{
  "result": "data"
}
```

**Error Responses**:
- `400 Bad Request`: [When this occurs]
- `404 Not Found`: [When this occurs]

## Technical Decisions

### Decision 1: [Technology or Approach]

**Context**: [What problem this solves]
**Options Considered**:
1. [Option A] - Pros: [...] Cons: [...]
2. [Option B] - Pros: [...] Cons: [...]

**Decision**: [Chosen option]
**Rationale**: [Why this was chosen]
**Consequences**: [What this means for the project]

## Implementation Notes

### Code Quality
- [Linting rules to follow]
- [Code patterns to use]

### Testing Strategy
- Unit tests for [components]
- Integration tests for [workflows]
- E2E tests for [user scenarios]
- Target coverage: [percentage]

### Security Considerations
- [Security concern 1 and mitigation]
- [Security concern 2 and mitigation]

### Performance Considerations
- [Performance requirement 1 and approach]
- [Performance requirement 2 and approach]

## Rollout Plan

### Phase 1: [Name]
- [What gets deployed]
- [Success criteria]

### Phase 2: [Name]
- [What gets deployed]
- [Success criteria]

## Risks & Mitigations

**Risk 1**: [Description]
- **Impact**: High | Medium | Low
- **Likelihood**: High | Medium | Low
- **Mitigation**: [How to address]

**Risk 2**: [Description]
[Similar structure...]

## Open Technical Questions

1. [Technical question requiring research or decision]
2. [Technical question requiring team input]
