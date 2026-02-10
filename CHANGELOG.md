# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Edit Team Member**: Owners and admins can now edit member roles and brand access from the dashboard
  - Edit modal with role selector and brand access checkboxes
  - Brand access selector shown but disabled for Owner/Admin roles (they have all-brand access)
  - Warning banner when upgrading a user to Owner role (full control including removing you)
  - Uses existing secure API route with Firebase Admin SDK
  - Backend validates permissions and role hierarchy before allowing changes
  - Automatically updates custom claims to reflect new role/access
  - Success notification with auto-dismiss toast banner
- **Remove User from Organisation**: Team members can now be removed from the organisation via the dashboard
  - Professional modal confirmation dialog with detailed warnings about access loss
  - Uses secure API route with Firebase Admin SDK (not direct client-side Firestore access)
  - Backend validates permissions and role hierarchy before allowing removal
  - Automatically updates custom claims to revoke organisation access immediately
  - Success/error notifications with auto-dismiss toast banners
  - Respects permission system: owners and admins can remove members, but admins cannot remove owners
  - Removed members immediately lose access to all brands and events
  - Local state updates for instant UI feedback without page reload
  - Cannot be undone - requires new invitation to re-add removed users

### Changed

- **Owner Role Hierarchy**: Owners can now modify other owners' roles (downgrade/remove), not just admins and members
  - Enables ownership transitions without requiring self-demotion workarounds
  - Admins still cannot modify owners or other admins
  - Updated `canModifyMemberRole` helper and corresponding tests

- **Invitation Email Automation**: Cloud Functions trigger automatically sends invitation emails when invitation documents are created
  - `onInvitationCreated` function: Monitors `invitations` collection and queues emails for pending invitations
  - Completes missing functionality in invitation flow - invites now properly sent
  - See [docs/briefs/INVITATION_SYSTEM.md](docs/briefs/INVITATION_SYSTEM.md) for invitation flow
- **Email Queue System Implementation**: Cloud Functions-based email delivery with Firestore queue
  - `processTransactionalEmail` function: Processes immediate-delivery emails on document creation
  - `processBulkEmailBatch` function: Scheduled function processes batch emails every minute
  - Firestore-backed rate limiting with sliding window algorithm (works across distributed instances)
  - `EMAIL_DEV_MODE` environment variable: Logs emails to console instead of sending via Postmark
  - Email queue schema in `@brayford/core` with full Zod validation and TypeScript types
  - Postmark integration with template support and error handling
  - Firestore indexes and security rules for `emailQueue` collection
  - 41 unit tests for email queue schema and helper functions
  - See [docs/briefs/EMAIL_QUEUE_SYSTEM.md](docs/briefs/EMAIL_QUEUE_SYSTEM.md) for full architecture
- **Organisation Deletion**: Multi-step deletion flow with safety measures and 28-day grace period
  - Type-to-confirm deletion initiation in organisation settings (users must type org name exactly)
  - Email confirmation required within 24 hours (sent to requester with secure token)
  - Soft delete on confirmation — organisation marked as deleted, access immediately revoked
  - 24-hour undo window — requester receives undo email, plus alert emails sent to other users with `org:delete` permission
  - Scheduled permanent deletion after 28 days via Firebase Functions (`cleanupDeletedOrganizations`)
  - Final notification emails sent to all former members when deletion completes
  - Permission-gated UI — only users with `org:delete` permission can initiate deletion
  - Three API routes: `/api/organizations/[id]/delete/initiate`, `/api/organizations/deletion/confirm`, `/api/organizations/deletion/undo`
  - Two user-facing pages: `/delete-organization/confirm` (token validation, confirmation), `/delete-organization/undo` (auth-required restoration)
  - Rate-limited deletion emails (1 per organization per minute) to prevent abuse
  - Audit trail: `OrganizationDeletion` documents track all deletion requests in Firestore
  - UK English copy throughout: "organisation" not "organization" in user-facing text
- **Organisation Deletion Schema** (`@brayford/core`): Complete schema for deletion lifecycle
  - `OrganizationDeletion` document schema with status states (pending → confirmed → cancelled/completed)
  - Status helpers: `isAwaitingConfirmation()`, `isConfirmed()`, `canBeUndone()`, `isExpired()`
  - Token generation with 24-hour expiry for both confirmation and undo links
  - Test factory `createMockOrganizationDeletion()` for consistent test data
  - 48 comprehensive unit tests covering all scenarios
- **Deletion Email Templates** (`@brayford/email-utils`): Three email types for deletion flow
  - Confirmation email: sent to requester, must click within 24 hours (no cancellation needed - just don't click!)
  - Alert email: sent to requester after confirmation, plus other users with `org:delete` permission (includes undo link valid for 24 hours)
  - Completion email: sent to all former members when permanent deletion executes
  - Dev mode link extraction: URLs automatically logged as clickable links in console
  - UK English date/time formatting throughout
- **Firebase Scheduled Function**: Daily cleanup job at 2am UTC
  - `cleanupDeletedOrganizations` runs daily, finds orgs past 28-day grace period
  - Permanently deletes organization documents, member records, and deletion requests
  - Sends final notification emails to all former members
  - Deployed via `firebase deploy --only functions`
- **Schema Updates**: `Organization` schema extended for deletion support
  - `deletionRequestId` field: nullable reference to active `OrganizationDeletion` document
  - `softDeletedAt` field: nullable timestamp marking when user confirmed deletion
  - Firestore converter updated to handle `softDeletedAt` timestamp conversion
- **Permission**: New `org:delete` permission for organisation deletion capability
  - Owner-only by default (admin/member cannot delete organisations)
  - Documented in `PERMISSIONS.md`

### Fixed

- **Invitation Acceptance Flow**: Unauthenticated users can now view invitation details before signing in
  - Added `GET /api/invitations/token/[token]` endpoint: Public API route for fetching invitation by token using Firebase Admin SDK (bypasses Firestore security rules)
  - Added `GET /api/invitations/pending` endpoint: Authenticated API route for fetching all pending invitations for current user's email
  - Updated join page (`/join`) to use API routes instead of direct Firestore queries
  - Resolves "Failed to load invitation: FirebaseError: false != true @ L137" error when clicking invitation links
  - **Root cause**: Firestore security rules require authentication to read invitations, but users need to see invitation details before deciding to sign in
- **Organisation Deletion**: Three critical fixes to deletion flow
  1. **Requester not receiving undo link**: Requester now receives an undo email after confirming deletion (previously only sent to other admins with `org:delete` permission). Better UX: users can "cancel" before confirming by simply not clicking the confirmation link (expires in 24h), and after confirming they receive an undo link valid for 24h.
  2. **Soft-deleted organisations accessible**: Dashboard and onboarding now filter out organisations with `softDeletedAt` set, preventing access to deleted organisations. Users attempting to access a soft-deleted org are redirected to onboarding.
  3. **Confirmation link reusable**: Confirmation token now invalidated (set to `null`) after successful use, preventing replay attacks.
- **Email Utils**: Rate limiter argument order corrected in `sendDeletionConfirmEmail()` and `sendInvitationEmail()`
  - `withRateLimit` signature is `(fn, options)` but was being called with `(options, fn)`
  - Caused `TypeError: Cannot read properties of undefined (reading 'maxPerMinute')` at runtime
  - Updated test mocks and assertions to match corrected signature
- **Firebase Converter**: Organization `softDeletedAt` timestamp not being converted from Firestore Timestamp to Date
  - Added `'softDeletedAt'` to timestamp fields list in organization converter
  - Resolves Zod validation error: "Expected date, received object"
- **Deletion Confirmation Page**: Incorrectly showed 28-day internal deletion date to users
  - Changed to show 24-hour undo window instead: "You have 24 hours to change your mind"
  - Removed "Return to Dashboard" button from confirmed state (access already revoked)
- **Deletion Alert Email**: Removed internal 28-day `scheduledDate` from template data
  - Template now only communicates 24-hour undo window to users
  - Updated template registry to remove `scheduledDate` from required fields

### Changed

- **Email Delivery Architecture**: Migrated all email sending from direct API calls to Firestore-backed queue system
  - Organisation deletion emails (confirm, alert, complete) now use `emailQueue` collection
  - Invitation emails now sent via Cloud Functions trigger on invitation creation
  - Benefits: Automatic retries, distributed rate limiting, audit trail, dev mode support
  - Old `@brayford/email-utils` helper functions (`sendDeletionConfirmEmail`, `sendDeletionAlertEmail`, `sendDeletionCompleteEmail`) replaced with direct queue writes
  - All emails now sent via `processTransactionalEmail` or `processBulkEmailBatch` functions
- **Email Dev Mode Logging**: URLs now extracted and displayed as clickable links after email content
  - Searches template data for any field ending with "Url", "url", "Link", or "link"
  - Displays links in clean format: `🔗 Clickable Links: confirmationUrl: https://...`
  - Improves developer experience during local testing

### Documentation

- **ROADMAP.md**: Organisation deletion marked as complete in Phase 1
  - Notes dependencies in Phase 2 (block deletion while events live) and Phase 5 (require billing settlement)
- **PERMISSIONS.md**: Documented `org:delete` and `org:view_settings` permissions

### To Do

- Phase 2: Block organisation deletion if events are currently live
- Phase 5: Require billing settlement before allowing organisation deletion
- Phase 6: Implement data export before deletion (currently deferred)

- **Firestore Rules Audit**: Comprehensive security audit of all Firestore operations
  - Created exhaustive documentation of all 7 collections requiring security rules
  - Identified **9 critical security gaps** including 1 fundamental architectural flaw
  - **CRITICAL FINDING:** Codebase uses role-based permission checks (anti-pattern) instead of capability-based system
    - Core permission helpers (`hasBrandAccess`, `canModifyMemberRole`, `canInviteRole`) check `role === 'owner'` directly
    - API routes fall back to role checks when permissions array is empty
    - Creates two sources of truth for authorization decisions
    - Must be refactored to use `hasPermission()` exclusively before implementing custom claims
  - Documented 8 additional security vulnerabilities: missing permission validation, cross-organization data leakage, invitation system issues
  - Documented missing rules for `organizationDeletionRequests` and `deletedOrganizationsAudit` collections
  - Corrected recommendations to use permission-based custom claims (not role-based)
  - Specified required Firestore indexes for all query operations
  - See `docs/FIRESTORE_RULES_AUDIT.md` for complete findings and remediation plan
- **User Management**: Owners can now invite additional owners to organisations
  - Owner role option added to invitation flow with confirmation warnings
  - Detailed confirmation dialog explaining owner-level permissions (billing, account deletion, member management)
  - Inline warning banner when owner role is selected in invite modal
  - Permission validation: only existing owners can invite new owners (admins cannot)
  - Protection against last owner demotion: owners cannot change their own role if they are the sole owner
  - New permission helper functions: `canInviteRole()` and `canChangeSelfRole()`
  - `getOwnerCount()` utility function for validation during role changes
  - Updated `InvitationRoleSchema` to include 'owner' as valid role
  - Unit tests for new permission helpers and schema changes
  - E2E test scenarios for owner invitation flow and self-demotion protection
  - Documentation updates in INVITATION_SYSTEM.md and PERMISSIONS.md
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
