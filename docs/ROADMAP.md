# Project Brayford - Roadmap

**Last Updated:** February 9, 2026

---

## Active Development

### Phase 1: Foundation (Current Sprint) - 85% Complete

**Identity & Access Domain + Organization Domain**

- [x] Define domain model and core architecture
- [x] Implement User schema (Google OAuth only)
- [x] Implement Organization schema (with two onboarding flows)
- [x] Implement OrganizationMember schema (roles & permissions)
- [x] Implement Brand schema
- [x] Firebase Auth integration (Google provider)
- [x] User onboarding Flow A: New user + new organization
- [ ] User onboarding Flow B: New user + join existing organization
- [x] Basic organization dashboard

**Additional completions:**
- [x] Comprehensive testing infrastructure (296 tests, 96.34% coverage)
- [x] CI/CD pipeline (GitHub Actions with Node 18.x/20.x)
- [x] Firestore security rules deployed
- [x] Firebase packages: @brayford/core, @brayford/firebase-utils
- [x] Test factories and mock data generators
- [x] 5000-user concurrent stress tests for jitter logic

---

## Upcoming Phases

### Phase 2: Event Management Domain

- [ ] Event schema (CRUD)
- [ ] Event lifecycle (draft → live → ended → archived)
- [ ] QR code generation for audience entry
- [ ] Event scheduling & timezone handling
- [ ] Event templates (reusable configs)

### Phase 3: Core Product - Interaction Domain

- [ ] Module system architecture (plugin-like)
- [ ] Q&A module MVP
- [ ] Polling module MVP
- [ ] Real-time module state management
- [ ] Moderation tools for Q&A

### Phase 4: Audience Domain

- [ ] Anonymous participant entry
- [ ] Session tracking
- [ ] Optional email capture (gated content)
- [ ] Participation history

### Phase 5: Billing & Subscriptions

- [ ] Stripe integration
- [ ] Subscription plans (Free, Pro, Enterprise)
- [ ] Usage metering & limits
- [ ] Overage handling

### Phase 6: Analytics & Reporting

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

### Advanced Organization Features

**Priority:** Low | **Target:** TBD

- [ ] Organization transfer (change owner)
- [ ] Multi-organization membership for single user
- [ ] Organization deletion & data export
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
