# Project Brayford - Roadmap

**Last Updated:** February 12, 2026

---

## Active Development

### Phase 1: Foundation (Current Sprint) - 95% Complete

**Identity & Access Domain + Organization Domain**

- [x] Define domain model and core architecture
- [x] Implement User schema (Google OAuth only)
- [x] Implement Organization schema (with two onboarding flows)
- [x] Implement OrganizationMember schema (roles & permissions)
- [x] Implement Brand schema
- [x] Firebase Auth integration (Google provider)
- [x] User onboarding Flow A: New user + new organization
- [x] Email infrastructure package (@brayford/email-utils)
- [x] Granular permission system (29 tests, 100% coverage)
- [x] User management page (/dashboard/users)
- [x] User onboarding Flow B: Invitation system
  - [x] Invitation schema, Firestore operations, email integration
  - [x] Server-side API route for atomic invitation acceptance
  - [x] Invite modal, pending invitations list, `/join` page
  - [x] Organisation switcher for multi-org users
  - [x] Brand auto-grant logic for new brands
  - [ ] Firestore security rules for invitations (deferred to comprehensive review)
  - [ ] E2E tests with Playwright (brief written, implementation pending)
- [x] Basic organization dashboard

**Additional completions:**

- [x] Comprehensive testing infrastructure (325 tests, 96%+ coverage)
- [x] CI/CD pipeline (GitHub Actions with Node 18.x/20.x)
- [x] Firestore security rules deployed
- [x] Firebase packages: @brayford/core, @brayford/firebase-utils
- [x] Test factories and mock data generators
- [x] 5000-user concurrent stress tests for jitter logic
- [x] Permission system with capability-based access control
- [x] Batch user fetching for efficient team member display
- [x] Dashboard navigation with quick actions

---

## Upcoming Phases

### Phase 2: Brand Management

**Priority:** Critical blocker for Phase 3 (Event Management)

- [x] Brand creation UI in creator app
- [x] Brand editing & settings page
  - [ ] Brand customization (colors, branding)
- [ ] Brand listing & selection (brand switcher in dashboard)
- [x] Brand member access management UI
  - [x] View which team members have access to specific brands
  - [x] Grant/revoke brand access for organization members
- [x] Brand archival/deletion (with dependency checks)
- [ ] Default brand selection for new organizations
- [x] Brand-level permissions enforcement in UI

### Phase 3: Event Management Domain

- [x] Event schema (CRUD)
- [x] Event creation UI in creator app
- [x] Event editing & settings page
- [x] Events list page with filtering (active/archived/all)
- [x] Event groups & hierarchies (two-tier system with eventType enum)
  - [x] Event type selection (regular event vs event group)
  - [x] Parent-child relationships with validation preventing unlimited nesting
  - [x] Visual indicators and filtering by type
  - [x] Child events display on group detail pages
- [x] Event lifecycle statuses (draft → active → live → ended)
- [x] Event scheduling & timezone handling (IANA timezone support with DST-aware "advertised time")
- [x] Dashboard integration (events card and events section)
- [x] Event archival/soft-delete functionality
- [x] Basic CRUD tests for schema and Firebase utilities
- [x] QR code generation for audience entry
- [ ] Event templates (reusable configs)
- [ ] Block organisation deletion while events are live (depends on org deletion from Phase 1)
- [ ] Event restore functionality for archived events

### Phase 4: Core Product - Interaction Domain

**Scene System** (see [Scene System Architecture](./briefs/SCENE_SYSTEM.md)):

- [x] Scene schema and Firestore collections (branded types, Zod schemas, constants)
- [x] Event live state subcollection for real-time sync (`useEventLiveState` hook)
- [x] Scene CRUD API routes (POST/GET/PATCH/DELETE + live-state endpoints)
- [x] Module type registry and config validation (5 module types: welcome, Q&A, poll, countdown, sponsor)
- [x] Firestore security rules for scenes and live state
- [x] 85+ tests passing across core schemas, Firebase operations, and API routes
- [x] Scenes page in Creator dashboard (`/dashboard/scenes`) with navigation card
- [ ] Creator UI: Scene list with create/edit/delete
- [ ] Creator UI: Scene builder with module palette and configuration
- [ ] Creator UI: Live scene switcher panel
- [ ] Audience: Real-time scene renderer with onSnapshot
- [ ] Scene templates and reusability

**Interactive Modules:**

- [ ] Welcome/static content module
- [ ] Q&A module MVP (submit questions, moderation)
- [ ] Polling module MVP (create polls, vote, view results)
- [ ] Module integration with scene system
- [ ] Real-time module state management
- [ ] Moderation tools for Q&A

### Phase 5: Audience Domain

- [ ] Anonymous participant entry
- [ ] Session tracking
- [ ] Optional email capture (gated content)
- [ ] Participation history

### Phase 6: Billing & Subscriptions

- [ ] Stripe integration
- [ ] Subscription plans (Free, Pro, Enterprise)
- [ ] Usage metering & limits
- [ ] Overage handling
- [ ] Require billing settlement before organisation deletion (depends on org deletion from Phase 1)

### Phase 7: Analytics & Reporting

- [ ] Event statistics dashboard
- [ ] Lead generation reports
- [ ] Interaction analytics
- [ ] CSV/PDF exports

---

## Deferred Features

### Authentication Enhancements

**Priority:** Medium | **Target:** Post-MVP

- [ ] Email/password authentication
- [ ] Magic link sign-in
- [ ] Social providers beyond Google (GitHub, Microsoft)
- [ ] Account linking (multiple auth providers for one user)

**Rationale:** Google OAuth provides fastest time-to-market. Email/password adds complexity (password reset flows, email verification) that can be added once core product is validated.

### Email Infrastructure Enhancements

**Priority:** Medium | **Target:** Post-MVP (when bulk sending needed)

- [ ] Cloud Tasks/Pub/Sub integration for bulk email queuing
- [ ] Firestore-based distributed rate limiting (multi-instance resilience)
- [ ] Email delivery tracking and webhooks (open rates, bounces)
- [ ] Email template versioning and A/B testing
- [ ] Retry logic with exponential backoff for failed sends
- [ ] Multiple language support (beyond UK English)
- [ ] Email analytics dashboard

**Rationale:** Phase 1 provides core transactional email sending with simple rate limiting. Bulk email features (event reminders to 1000s, marketing campaigns) require proper queuing infrastructure. See [docs/briefs/EMAIL_INFRASTRUCTURE.md](./briefs/EMAIL_INFRASTRUCTURE.md) for full architecture.

### Advanced Organization Features

**Priority:** Low | **Target:** TBD

- [ ] Organization transfer (change owner)
- [x] Multi-organization membership for single user (Phase 1)
- [x] Organization deletion (Phase 1 — soft delete with 28-day grace period, data export deferred to Phase 6)
- [ ] Custom roles beyond owner/admin/member

### Advanced Event Features

**Priority:** Medium | **Target:** Q2 2026

- [ ] Recurring events
- [ ] Event series/seasons
- [ ] Co-hosted events (multiple brands)
- [ ] Event cloning

### Additional Interaction Modules

**Priority:** Medium | **Target:** Q3 2026

- [ ] Live reactions (applause meter, emoji reactions)
- [ ] Voting/ranking modules
- [ ] Word clouds
- [ ] Live trivia/quiz

### Platform & Infrastructure

**Priority:** Low | **Target:** TBD

- [ ] Multi-language support (i18n)
- [ ] White-label features for enterprise
- [ ] Advanced rate limiting per plan tier
- [ ] Audit logs for compliance

---

## Notes

- Items move from "Deferred" to "Upcoming Phases" based on user feedback and business priorities
- Each phase is estimated at 1-2 weeks for MVP implementation
- Security and performance considerations take priority over feature velocity
