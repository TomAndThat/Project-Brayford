# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Organisation Settings Page**: Owner-only settings page at `/dashboard/organisation/settings`
  - Permission-gated access with `org:view_settings` permission
  - "Organisation Settings" link in dashboard header dropdown (cog icon)
  - Read-only organisation information display (name, type, ID)
  - Permission denied state for non-owners with clear messaging
  - Placeholder for future settings implementation
  - UK English route naming (`/organisation/settings`)
- **Permission**: New `org:view_settings` permission for owner-only settings page access
  - Added to permission types and constants in `@brayford/core`
  - Documented in `PERMISSIONS.md` with owner-only access
  - Not granted to admin or member roles
- **DashboardHeader Enhancement**: Optional `currentMember` prop for permission-based UI
  - Conditionally renders settings link based on `org:view_settings` permission
  - Updated dashboard and users pages to pass current member data
- **Invitation System**: Full invitation lifecycle for onboarding Flow B
  - Invite users by email with role selection (Admin/Member) and brand access configuration
  - Pending invitation tracking with resend, cancel, and expiry handling
  - Token-based secure invitation links with 7-day expiration
  - Batch invitation acceptance — accept multiple org invitations at once
  - Server-side API route (`POST /api/invitations/accept`) with Firebase Admin SDK for atomic acceptance
  - Auto-grant new brands toggle — opted-in members automatically get access to future brands
  - Firestore composite indexes for efficient invitation queries
  - `InviteUserModal` component with duplicate/existing member detection
  - `PendingInvitationsList` component integrated into Team Members page
  - `/join` page handling the full acceptance flow (token validation, auth, multi-invite, error states)
- **Organisation Switcher**: Users with multiple org memberships can switch between them
  - `OrgSwitcher` dropdown component in the dashboard header
  - Selected organisation persisted to localStorage across sessions
  - Dashboard page loads all user memberships and resolves org names
- **Invitation Schema** (`@brayford/core`): Zod schema for invitations with status lifecycle, token generation, expiry calculation, and actionability checks
- **Invitation Firestore Operations** (`@brayford/firebase-utils`): Full CRUD for `/invitations` collection — create, query by token/email/org, accept, decline, resend, cancel
- **Invitation Email Helper** (`@brayford/email-utils`): `sendInvitationEmail()` with rate limiting, UK English date formatting, and Postmark template integration
- **Firebase Admin SDK**: Server-side Firebase configuration in creator app for secure API routes
- **Brand Auto-Grant**: `createBrand()` now automatically grants access to members with `autoGrantNewBrands` enabled
- **Schema Update**: `autoGrantNewBrands` boolean field added to `OrganizationMember`
- **Unit Tests**: 47 new tests for invitation schema (38) and invitation email helper (9)
- **E2E Testing Brief**: Comprehensive Playwright setup plan at `docs/briefs/E2E_TESTING_PLAYWRIGHT.md`
- **User Management Page**: Team member management at `/dashboard/users`
  - View all organization members with user details (name, email, photo)
  - Display roles with colored badges (Owner, Admin, Member)
  - Show brand access information for members
  - Permission-gated UI (invite/edit/remove buttons only shown to authorized users)
  - Empty state with helpful messaging for solo organizations
  - Role information panel explaining permission levels
  - Breadcrumb navigation back to dashboard
- **Firebase Utils**: Batch user fetching with `batchGetUsers()` function
- **Firebase Utils**: `getOrganizationMembersWithUsers()` enriches member data with user details
- **Dashboard**: Quick action cards for navigation (Team Members, Events, Analytics)
- **Permission System**: Granular capability-based permission system for organization access control
  - Permission constants for all domains (org, users, brands, events, analytics)
  - Role-to-permission mappings (owner/admin/member presets)
  - Helper functions: `hasPermission()`, `requirePermission()`, `hasBrandAccess()`, etc.
  - Brand-level access control for members
  - Role modification validation (admins can't modify owners)
  - 29 comprehensive tests with 100% coverage
  - Detailed documentation in [docs/PERMISSIONS.md](docs/PERMISSIONS.md)
- **Schema Update**: Optional `permissions` field on `OrganizationMember` for future custom permissions
- **Email Infrastructure**: New `@brayford/email-utils` package for email sending via Postmark
  - Transactional email support with template validation
  - Development mode (console logging instead of sending)
  - Simple in-memory rate limiting for transactional emails
  - UK English templates for invitation, password reset, verification, etc.
  - i18n-ready architecture for future multi-language support
  - Comprehensive test suite with 70%+ coverage
- **Developer Experience**: EMAIL_DEV_MODE environment flag for safe local development

### Changed

- **Onboarding**: Removed automatic brand creation during organisation setup. Users will now create brands through a guided walkthrough (to be implemented).

### Documentation

- **Invitation System Brief**: Comprehensive implementation plan for user onboarding Flow B
  - Multi-organization invitation handling
  - Brand access configuration during invitation
  - Auto-grant new brands feature
  - Token-based security with 7-day expiration
  - Complete user flows and technical specifications
  - See [docs/briefs/INVITATION_SYSTEM.md](docs/briefs/INVITATION_SYSTEM.md)

### To Do

- Firestore security rules comprehensive review (invitation rules, org member rules)
- First-time user walkthrough for brand creation
- Email infrastructure Phase 2: Cloud Tasks for bulk email queuing (deferred)
- E2E testing with Playwright (see `docs/briefs/E2E_TESTING_PLAYWRIGHT.md`)

## [0.1.0] - 2026-02-09

### Added

- **Creator App**: Complete two-step onboarding flow (organization type selection → details form)
- **Creator App**: Sign-out functionality on onboarding and dashboard pages
- **Auth**: Google OAuth integration with automatic user document creation
- **Organization Management**: Create organization and brand during user signup (Flow A)
- **Dashboard**: Basic organization and brand display with empty states
- **Testing**: Comprehensive test suite with 296 tests achieving 96.34% coverage
- **Testing**: Test factories for consistent mock data generation across test files
- **Testing**: Stress test for 5,000 concurrent user scenarios (jitter validation)
- **CI/CD**: GitHub Actions workflow with Node 18.x/20.x matrix
- **Firebase**: Firestore security rules for authenticated user access
- **Firebase**: Firebase Functions scaffolding and configuration
- **Firebase**: Storage rules with default deny-all policy
- **Core Package**: Zod schemas for User, Organization, OrganizationMember, and Brand
- **Core Package**: Branded types for compile-time ID type safety
- **Firebase Utils**: Complete CRUD operations for users, organizations, brands
- **Firebase Utils**: Firestore converters with timestamp handling
- **Firebase Utils**: Jitter utilities for high-concurrency write operations
- **Firebase Utils**: Google OAuth authentication helpers

### Fixed

- Auth race condition by removing premature `getCurrentUser()` call (now relies solely on `onAuthChange` observer)
- React hooks violation: separated nested `useEffect` into two independent hooks
- OrganizationType mismatch: UI "organisation" selection now correctly maps to schema "team" type
- Firestore rejection: strip `undefined` values from documents before writes (Firestore accepts `null` or omit)
- CORS popup warnings no longer shown as errors in sign-in flow

### Changed

- Simplified organization type selection from 3 options to 2 (Individual Creator, Organisation)
- Organization name pre-filled with user's display name for individual creators

### Infrastructure

- Vitest 4.0.18 configured with jsdom environment
- Test coverage thresholds: 70% for packages (achieved 96.34%)
- Firebase project structure with firestore.rules, firestore.indexes.json, and firebase.json
- Monorepo setup with pnpm workspaces: 2 apps (creator, admin) + 2 packages (core, firebase-utils)

[unreleased]: https://github.com/yourusername/project-brayford/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/project-brayford/releases/tag/v0.1.0
