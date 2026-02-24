# Copilot Instructions - Project Brayford

## Shortcodes

**How to interpret the following instructions when received via copilot chat:**

- _Code 1_: Please investigate the error detailed in the message and provide a detailed analysis of the root cause, potential fixes, and recommended next steps. Do not implement any fixes or write code until we have discussed the analysis and agreed on an approach.

- _Code 2_: Please describe the features and functionality of the specified app, module, or component in detail. Include information on its purpose, how it fits into the overall architecture, and any critical patterns or considerations for working with it. This is for informational purposes only - no code implementation is needed.

- _Code 3_: Please come up with a detailed proposal for implementing the described feature or functionality. Include the technical approach, architecture, data models, and any relevant patterns or best practices. Do not write any code until we have discussed and agreed on the proposed approach.

- _Code 4_: Please commit the code changes affected in this conversation only, along with any related files, ensuring that all changes are properly staged and that the commit message follows our Conventional Commits format. Do not include any unrelated changes in this commit.

- _Code 5_: Please commit all uncommitted changes to the codebase with a comprehensive commit message that follows our Conventional Commits format. Ensure that all uncommitted changes within the repository are included in the commit and that the message accurately reflects the changes made, so far as it possible.

## Ways of Working

**Collaboration principles for this project:**

### 🚫 Do NOT write code without explicit consent

- **Never start implementing** without confirming the approach first
- Ask clarifying questions before proposing solutions
- Present options and wait for direction rather than choosing for me
- If uncertain about requirements, discuss before coding

### ✅ DO prioritize alignment over speed

- **Accuracy and collaboration > proactivity and helpfulness**
- Propose a plan and get approval before execution
- Check assumptions explicitly ("Should I...?", "Would you prefer...?")
- When multiple approaches exist, outline trade-offs and ask which to pursue
- If I ask for analysis, provide analysis - don't jump to implementation

### 💬 Communication style

- Ask questions early and often
- Confirm understanding before taking action
- Present technical decisions as options, not fait accompli
- When suggesting changes, explain "why" and wait for go-ahead

### ℹ️ Application name: Project Brayford

- The application is called "Project Brayford"
- It is never acceptable, under any circumstances to shorten this to "Brayford". Always use the full name.

### 🇬🇧 Language: UK English for public-facing copy only

**Rule:** If a user can see it without opening developer tools, it must be UK English.

- ✅ **UK English required:**
  - UI copy (buttons, labels, error messages, notifications)
  - Marketing pages and landing pages
  - User-facing documentation (help docs, FAQs, onboarding)
  - Email templates
  - Error messages shown to users
- ✅ **US English acceptable:**
  - Code (variables, functions, comments)
  - Internal documentation (READMEs, architecture docs)
  - Database schemas and collection names
  - API routes and endpoints
  - Library/framework conventions (e.g., `color` in CSS must stay as-is)

**Example:** A button label says "Organise Event" (UK), but the code calls `createOrganization()` (US).

### 🎬 Production Ready

- All code must be production-ready quality, even in early stages
- It is _never_ acceptable to use alert() style messaging. All user-facing messages must be presented in proper components with appropriate styling and UX patterns.
- It is _never_ acceptable to think of or describe the project as an "MVP" or "prototype" in code comments, documentation, or communication. We are building a production-ready codebase from day one.

## Project Overview

Real-time "second screen" interaction platform for live events (podcasts, creator shows). Handles 5,000+ concurrent participants per event. Four Next.js apps + shared packages in a pnpm workspace. Firebase (Firestore + Realtime DB) for real-time sync. See [docs/DOMAIN_MODEL.md](../docs/DOMAIN_MODEL.md) for full architecture.

## Critical Patterns

### Real-time Firebase Operations

- **Always use jitter for concurrent writes** to prevent Firestore saturation (500 writes/sec limit)
  ```typescript
  import { withJitter } from "@brayford/firebase-utils";
  await withJitter(() => updateDoc(ref, data), { windowMs: 2000 });
  ```
- **Always unsubscribe from `onSnapshot` listeners** in `useEffect` cleanup
- Follow patterns in `packages/firebase-utils` for real-time hooks

### TypeScript Standards

- Strict mode enabled everywhere - explicit return types on exported functions
- Use branded types for domain IDs: `type EventId = string & { readonly __brand: 'EventId' }`
- Validate Firestore data with Zod schemas from `packages/core/src/schemas`
- Import order: external → internal packages (`@brayford/*`) → relative → styles

### Component Architecture

- **Server Components by default** - only add `'use client'` for interactivity, real-time listeners, or browser APIs
- State management: Zustand for global UI, custom Firebase hooks for real-time data, React Hook Form for forms
- Optimize with Zustand selectors: `const x = useStore(s => s.x)` not `const store = useStore()`

### Domain Model (see [docs/DOMAIN_MODEL.md](../docs/DOMAIN_MODEL.md))

- 7-domain architecture: Identity, Organization, Event Management, Interaction, Audience, Billing, Analytics
- Hierarchy: **Organization** (paying customer) → **Brands** (public-facing) → **Events** (live shows) → **Modules** (Q&A, polls) → **Interactions** (votes, questions)
- Multi-tenancy: Events belong to Brands, Brands belong to Organizations, Users are Organization members

### Styling

- Tailwind CSS with mobile-first approach
- Use `clsx` for conditional classes
- CSS Modules only for complex animations not suitable for Tailwind

### Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `camelCase` with `use` prefix (files: `kebab-case`)
- Constants: `SCREAMING_SNAKE_CASE`
- Firebase collections: lowercase plural (`events`, `questions`)
- Branches: `feat/`, `fix/`, `refactor/`, `docs/` + short description
- Commits: Conventional Commits (`feat(scope): description`)

## Development Workflow

### Commands (from root)

```bash
pnpm dev        # Run all apps in parallel
pnpm build      # Build all apps
pnpm test       # Run all tests
pnpm lint       # Lint all packages
```

### Before Committing

1. Run `pnpm lint` and `pnpm type-check`
2. Ensure tests pass with 70%+ coverage for packages, 50%+ for apps
3. Use Conventional Commits format
4. **Update CHANGELOG.md** for user-facing changes (see below)

### Maintaining CHANGELOG.md

**Always update CHANGELOG.md** when implementing features, fixes, or changes that affect users or other developers.

**When to update:**

- ✅ New features (UI components, API endpoints, database schemas)
- ✅ Bug fixes (especially user-facing issues)
- ✅ Breaking changes (API changes, schema migrations, removed features)
- ✅ Security patches
- ✅ Performance improvements
- ✅ Dependency updates (major versions only)
- ❌ Internal refactoring with no external impact
- ❌ Test additions (unless they document new behavior)
- ❌ Documentation typo fixes

**How to update:**

1. Add changes under `## [Unreleased]` section
2. Use categories: `Added`, `Changed`, `Fixed`, `Removed`, `Security`, `Deprecated`
3. Write from user/developer perspective: "what can they now do?" not "what code changed"
4. Reference issue numbers if applicable: `- Fix auth race condition (#123)`
5. When releasing, move Unreleased items to new versioned section with date

**Example entry:**

```markdown
## [Unreleased]

### Added

- **Event Management**: Create and schedule live events with QR codes for audience entry
- **Dashboard**: Event list with status filters (draft, live, ended)

### Fixed

- Auth token refresh now works correctly after 1 hour (#145)
```

### Testing

- Vitest + Testing Library for unit/component tests
- Playwright for E2E (critical flows: submit question → appears on stage view)
- Test business logic, shared utilities, and critical user flows
- Mock Firebase operations in tests

## Key Files

- [CHANGELOG.md](../CHANGELOG.md) - Version history with user-facing changes (keep updated!)
- [docs/ROADMAP.md](../docs/ROADMAP.md) - Feature progress and sprint planning
- [docs/DEVELOPER_STANDARDS.md](../docs/DEVELOPER_STANDARDS.md) - Comprehensive style guide
- [docs/DOMAIN_MODEL.md](../docs/DOMAIN_MODEL.md) - Data models and domain boundaries
- `packages/core` - Shared types, schemas, constants
- `packages/firebase-utils` - Real-time hooks and jitter logic
- Root `package.json` - Monorepo scripts and tooling config

## Performance Considerations

- **Jitter is non-negotiable** for writes during "Vote Now!" moments (5,000 concurrent users)
- Debounce user input (500ms) before Firebase queries
- Use optimistic updates for instant UI feedback
- Memoize expensive computations with `useMemo`
- Lazy-load heavy client-only components with `dynamic` import

## Common Pitfalls

- ❌ Writing to Firestore without jitter in audience-facing features
- ❌ Not unsubscribing from Firebase listeners (memory leaks)
- ❌ Using `const store = useStore()` (causes unnecessary re-renders)
- ❌ Adding `'use client'` to components that could be Server Components
- ❌ Type assertions without validation (`as Event` without Zod parse)
- ❌ Taking shortcuts in development - this isn't an mvp, it's a production-ready codebase from day one

## AOB

- As the app is currently in development, you do not need to worry about backwards compatibility or breaking changes
- To confirm that you have read and understood these instructions, please start each conversation with the name of a root vegetable (e.g. "Carrot")

## Questions?

See [docs/DEVELOPER_STANDARDS.md](../docs/DEVELOPER_STANDARDS.md) for exhaustive patterns, or ask in team chat.
