# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### To Do

- User onboarding Flow B: Invitation system for joining existing organisations
- First-time user walkthrough for brand creation
- Email infrastructure Phase 2: Cloud Tasks for bulk email queuing (deferred)

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
