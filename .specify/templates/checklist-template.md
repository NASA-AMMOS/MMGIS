# [Feature Name] - Implementation Checklist

**Date**: [Date]
**Feature**: [Feature Name]
**Spec**: [Link to spec.md]
**Plan**: [Link to plan.md]

## Pre-Implementation

- [ ] Spec reviewed and approved
- [ ] Plan reviewed and approved
- [ ] Tasks broken down and estimated
- [ ] Dependencies identified and available
- [ ] Team aligned on approach

## Implementation

### Code Quality
- [ ] Code follows project style guide
- [ ] No linting errors
- [ ] No console.log or debugging code left in
- [ ] Error handling implemented
- [ ] Input validation implemented
- [ ] Proper TypeScript types (if applicable)

### Testing
- [ ] Unit tests written
- [ ] Unit tests passing
- [ ] Integration tests written
- [ ] Integration tests passing
- [ ] E2E tests written (if applicable)
- [ ] E2E tests passing
- [ ] Test coverage meets threshold (80%+)
- [ ] Edge cases tested
- [ ] Error scenarios tested

### Security
- [ ] Authentication/authorization implemented correctly
- [ ] Input sanitization in place
- [ ] SQL injection prevented
- [ ] XSS vulnerabilities addressed
- [ ] CSRF protection in place (if applicable)
- [ ] Sensitive data not logged
- [ ] Secrets not hardcoded

### Performance
- [ ] Performance requirements met
- [ ] Database queries optimized
- [ ] Proper indexing in place
- [ ] Caching implemented where needed
- [ ] No N+1 queries
- [ ] Large datasets handled efficiently

### Documentation
- [ ] README updated (if needed)
- [ ] API documentation updated
- [ ] Code comments where needed
- [ ] AGENTS.md updated
- [ ] User-facing documentation written
- [ ] Migration guide written (if breaking changes)

### Database
- [ ] Migration scripts written
- [ ] Migration tested on dev environment
- [ ] Rollback plan documented
- [ ] Data seeding handled (if needed)

### Code Review
- [ ] Pull request created
- [ ] Code reviewed by peer(s)
- [ ] Review feedback addressed
- [ ] Tests reviewed
- [ ] Approved by required reviewers

### Deployment
- [ ] Feature flag configured (if applicable)
- [ ] Environment variables documented
- [ ] Deployment plan documented
- [ ] Rollback plan documented
- [ ] Monitoring/alerts configured
- [ ] Staged to dev/staging environment
- [ ] Smoke tested in staging
- [ ] Performance tested in staging
- [ ] Ready for production deployment

## Post-Deployment

- [ ] Deployed to production
- [ ] Smoke tests passed
- [ ] Monitoring checked (no errors)
- [ ] Performance metrics normal
- [ ] User feedback collected
- [ ] Issues/bugs triaged
- [ ] Retrospective completed
- [ ] Lessons learned documented

## Constitution Compliance

- [ ] All constitutional principles followed
- [ ] Quality standards met
- [ ] Documentation-first approach used
- [ ] Requirements clearly defined
- [ ] Incremental delivery achieved

## Sign-off

**Developer**: [Name] - [Date]
**Reviewer**: [Name] - [Date]
**QA**: [Name] - [Date]
**Product**: [Name] - [Date]
