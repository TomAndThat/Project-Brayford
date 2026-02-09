# Developer Standards & Style Guide

**Project Brayford** | Live Event Engagement Platform  
_Last Updated: February 2026_

---

## Table of Contents

1. [Philosophy & Principles](#philosophy--principles)
2. [TypeScript Standards](#typescript-standards)
3. [Project Structure](#project-structure)
4. [Naming Conventions](#naming-conventions)
5. [React & Next.js Patterns](#react--nextjs-patterns)
6. [State Management](#state-management)
7. [Firebase Conventions](#firebase-conventions)
8. [Styling Standards](#styling-standards)
9. [Testing Requirements](#testing-requirements)
10. [Git Workflow](#git-workflow)
11. [Code Quality & Tooling](#code-quality--tooling)
12. [Performance Guidelines](#performance-guidelines)
13. [Documentation](#documentation)

---

## Philosophy & Principles

### Core Values

1. **Consistency Over Cleverness**: Readable, predictable code beats clever one-liners.
2. **Real-time First**: Every feature must account for concurrent participants and sub-second updates.
3. **Type Safety**: If it compiles, it should work. Minimize runtime surprises.
4. **Performance by Default**: 5,000+ concurrent participants means every millisecond counts.
5. **Modular Architecture**: Apps are independent; shared logic lives in `/packages`.

### Decision Framework

When making technical choices, ask:

- Does this scale to 5,000 concurrent participants?
- Is this pattern consistent across all four apps?
- Will a new developer understand this in 6 months?

---

## TypeScript Standards

### Configuration

**All packages and apps MUST use TypeScript in strict mode.**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Type Definitions

#### ✅ DO

```typescript
// Explicit return types for exported functions
export function calculateVotePercentage(votes: number, total: number): number {
  return total === 0 ? 0 : (votes / total) * 100;
}

// Use branded types for domain primitives
type EventId = string & { readonly __brand: "EventId" };
type UserId = string & { readonly __brand: "UserId" };

// Prefer interfaces for object shapes (better error messages)
interface PollQuestion {
  id: string;
  text: string;
  options: PollOption[];
  createdAt: Date;
}

// Use type for unions/intersections
type InteractionModule = "qna" | "poll" | "survey" | "lead-magnet";
```

#### ❌ DON'T

```typescript
// Implicit any
function processData(data) { ... }

// Type assertions without validation
const event = firestoreDoc.data() as Event;

// Optional chaining as a band-aid for poor types
const name = event?.config?.display?.name;
```

### Import Order

```typescript
// 1. External dependencies
import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";

// 2. Internal packages (from /packages)
import { withJitter } from "@brayford/firebase-utils";
import type { Event, Question } from "@brayford/core";

// 3. Relative imports (same app)
import { Button } from "@/components/Button";
import { useEventState } from "@/hooks/useEventState";
import type { StageViewProps } from "./types";

// 4. Style imports (last)
import styles from "./Component.module.css";
```

---

## Project Structure

### Monorepo Layout

```
/project-brayford
├── apps/
│   ├── audience/          # Mobile participant app
│   ├── creator/           # Production dashboard
│   ├── stage-view/        # Big screen output
│   └── platform-admin/    # Internal management
├── packages/
│   ├── core/              # Shared types, schemas, utilities
│   ├── firebase-utils/    # Firebase hooks, jitter logic
│   └── ui/                # Shared React components (optional)
├── docs/
│   ├── DEVELOPER_STANDARDS.md
│   ├── API.md
│   └── DEPLOYMENT.md
└── pnpm-workspace.yaml
```

### App Structure (Next.js 15 App Router)

Each app in `/apps/*` follows this structure:

```
/apps/audience/
├── app/
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home route
│   ├── event/
│   │   └── [eventId]/
│   │       ├── page.tsx
│   │       └── loading.tsx
│   └── api/
│       └── submit/
│           └── route.ts
├── components/
│   ├── ui/                # Presentational components
│   ├── features/          # Feature-specific components
│   └── layout/            # Layout components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities, Firebase config
├── stores/                # Zustand stores
├── types/                 # App-specific TypeScript types
├── public/
└── package.json
```

### Package Structure

```
/packages/core/
├── src/
│   ├── types/             # Shared TypeScript types
│   ├── schemas/           # Zod/validation schemas
│   ├── constants/         # App-wide constants
│   └── utils/             # Pure utility functions
├── index.ts               # Public API exports
└── package.json
```

---

## Naming Conventions

### Files & Folders

| Type                | Convention             | Example                                    |
| ------------------- | ---------------------- | ------------------------------------------ |
| React Components    | PascalCase             | `QuestionCard.tsx`                         |
| Non-component files | kebab-case             | `use-event-state.ts`, `firebase-config.ts` |
| Route segments      | kebab-case             | `app/lead-magnet/page.tsx`                 |
| Test files          | Match source + `.test` | `QuestionCard.test.tsx`                    |

### Code Naming

```typescript
// Components: PascalCase
export function VotingButton({ ... }) { }

// Hooks: camelCase with "use" prefix
export function useRealtimePoll(pollId: string) { }

// Utilities: camelCase
export function calculateJitter(baseDelay: number) { }

// Constants: SCREAMING_SNAKE_CASE
export const MAX_CONCURRENT_WRITES = 500;
export const DEFAULT_JITTER_WINDOW_MS = 2000;

// Types/Interfaces: PascalCase
export interface EventConfig { }
export type ModuleStatus = 'active' | 'paused' | 'ended';

// Zustand stores: camelCase with "Store" suffix
export const useEventStore = create<EventStore>(...);
```

### Firebase Collections & Documents

```typescript
// Collections: lowercase, plural nouns
const eventsRef = collection(db, "events");
const questionsRef = collection(db, "questions");

// Subcollections: maintain parent context
const participantsRef = collection(db, `events/${eventId}/participants`);

// Document IDs: Auto-generated or human-readable slugs
const eventDoc = doc(db, "events", "hammersmith-live-2026-02");
```

---

## React & Next.js Patterns

### Component Types

#### Server Components (Default)

Use for:

- Static content
- Data fetching without interactivity
- SEO-critical pages

```typescript
// app/event/[eventId]/page.tsx
export default async function EventPage({ params }: { params: { eventId: string } }) {
  const event = await getEvent(params.eventId);

  return (
    <div>
      <EventHeader event={event} />
      <InteractionModules eventId={params.eventId} />
    </div>
  );
}
```

#### Client Components

Mark with `'use client'` for:

- Real-time listeners
- User interactions
- Browser APIs

```typescript
"use client";

import { useRealtimePoll } from "@/hooks/useRealtimePoll";

export function LivePollResults({ pollId }: { pollId: string }) {
  const { results, isLoading } = useRealtimePoll(pollId);
  // ...
}
```

### Component Composition

#### ✅ DO: Co-locate related logic

```typescript
// components/features/qna/QuestionCard.tsx
interface QuestionCardProps {
  question: Question;
  onPushToStage: (id: string) => void;
  canModerate: boolean;
}

export function QuestionCard({ question, onPushToStage, canModerate }: QuestionCardProps) {
  return (
    <article className="rounded-lg border p-4">
      <p className="text-sm text-gray-700">{question.text}</p>
      {canModerate && (
        <button onClick={() => onPushToStage(question.id)}>
          Push to Stage
        </button>
      )}
    </article>
  );
}
```

#### ❌ DON'T: Over-abstract prematurely

```typescript
// Bad: Creating a generic "Card" component before you have 3+ use cases
<GenericCard variant="question" actions={actions} metadata={meta} />

// Good: Start specific, abstract when patterns emerge
<QuestionCard question={q} onPushToStage={handlePush} />
```

### Data Fetching

#### Server-Side (Preferred for initial load)

```typescript
// app/event/[eventId]/page.tsx
import { getEvent } from '@/lib/firebase-admin';

export default async function EventPage({ params }: { params: { eventId: string } }) {
  const event = await getEvent(params.eventId);
  return <EventView event={event} />;
}
```

#### Client-Side (For real-time updates)

```typescript
'use client';

import { useRealtimeEvent } from '@brayford/firebase-utils';

export function EventStatusBadge({ eventId }: { eventId: string }) {
  const { data: event, error } = useRealtimeEvent(eventId);

  if (error) return <ErrorState error={error} />;
  if (!event) return <Skeleton />;

  return <Badge status={event.status} />;
}
```

---

## State Management

### When to Use What

| Scenario                | Solution                   | Example                     |
| ----------------------- | -------------------------- | --------------------------- |
| Real-time Firebase data | Custom hook + `onSnapshot` | Questions, poll results     |
| Global UI state         | Zustand                    | Theme, sidebar open/closed  |
| Form state              | React Hook Form            | Email capture, survey forms |
| URL state               | Next.js `useSearchParams`  | Filters, active tab         |
| Server cache            | React Server Components    | Event metadata              |

### Zustand Store Pattern

```typescript
// stores/event-store.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface EventStore {
  activeModule: InteractionModule | null;
  setActiveModule: (module: InteractionModule | null) => void;
  toggleModule: (module: InteractionModule) => void;
}

export const useEventStore = create<EventStore>()(
  devtools(
    (set) => ({
      activeModule: null,
      setActiveModule: (module) => set({ activeModule: module }),
      toggleModule: (module) =>
        set((state) => ({
          activeModule: state.activeModule === module ? null : module,
        })),
    }),
    { name: "EventStore" },
  ),
);
```

#### Store Usage

```typescript
// ✅ DO: Select only what you need
const activeModule = useEventStore((state) => state.activeModule);

// ❌ DON'T: Subscribe to entire store unnecessarily
const store = useEventStore(); // Causes re-render on any state change
```

---

## Firebase Conventions

### Initialization

**Single source of truth per app:**

```typescript
// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Load from env variables
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  // ...
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### Real-time Listeners

**Always unsubscribe and handle errors:**

```typescript
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useRealtimeEvent(eventId: string) {
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "events", eventId),
      (snapshot) => {
        if (snapshot.exists()) {
          setEvent(snapshot.data() as Event);
          setError(null);
        }
      },
      (err) => {
        console.error("Event listener error:", err);
        setError(err as Error);
      },
    );

    return () => unsubscribe();
  }, [eventId]);

  return { event, error };
}
```

### Write Operations with Jitter

**CRITICAL for high-concurrency scenarios:**

```typescript
import { withJitter } from "@brayford/firebase-utils";
import { doc, updateDoc } from "firebase/firestore";

export async function submitVote(pollId: string, optionId: string) {
  // Jitter prevents thundering herd at "Vote Now!" moments
  await withJitter(
    async () => {
      const voteRef = doc(db, "polls", pollId, "votes", optionId);
      await updateDoc(voteRef, {
        count: increment(1),
      });
    },
    { windowMs: 2000 },
  ); // Spread writes across 2 seconds
}
```

### Data Validation

**Use Zod schemas for Firestore data:**

```typescript
// packages/core/src/schemas/event.schema.ts
import { z } from "zod";

export const EventSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  status: z.enum(["draft", "live", "ended"]),
  config: z.object({
    maxParticipants: z.number().int().positive(),
    allowAnonymous: z.boolean(),
  }),
  createdAt: z.date(),
});

export type Event = z.infer<typeof EventSchema>;

// In Firebase hooks
const data = snapshot.data();
const event = EventSchema.parse(data); // Throws if invalid
```

### Access Control & Permissions

**Organization-level permission checking:**

```typescript
import { hasPermission, USERS_INVITE, canModifyMemberRole } from '@brayford/core';

// Check if current user can perform an action
function InviteButton({ currentMember }: { currentMember: OrganizationMember }) {
  const canInvite = hasPermission(currentMember, USERS_INVITE);

  if (!canInvite) return null;

  return <button>Invite User</button>;
}

// Check if user can modify another member
function MemberRow({ actor, target }: { actor: OrganizationMember; target: OrganizationMember }) {
  const canModify = canModifyMemberRole(actor, target);

  return (
    <tr>
      <td>{target.user.displayName}</td>
      <td>
        {canModify && <button>Edit Role</button>}
      </td>
    </tr>
  );
}
```

**Key principles:**

- **Backend derives permissions from roles** by default (no redundant storage)
- **UI respects permissions** via helper functions (`hasPermission`, `canModifyMemberRole`)
- **Frontend simplifies** to Owner/Admin/Member roles for UX
- **Future-proof** with optional custom permissions per member

See [docs/PERMISSIONS.md](./PERMISSIONS.md) for complete permission matrix and usage patterns.

---

## Styling Standards

### Tailwind CSS Conventions

#### Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#...",
          secondary: "#...",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
};
```

#### Class Organization

```typescript
// ✅ DO: Use clsx for conditional classes
import clsx from 'clsx';

<button
  className={clsx(
    'rounded-lg px-4 py-2 font-semibold transition-colors',
    isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700',
    disabled && 'cursor-not-allowed opacity-50'
  )}
>
  Vote
</button>

// ✅ DO: Extract repeated patterns to components
function PrimaryButton({ children, ...props }) {
  return (
    <button
      className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
      {...props}
    >
      {children}
    </button>
  );
}
```

#### Responsive Design

```typescript
// Mobile-first approach (default styles = mobile)
<div className="flex flex-col gap-4 md:flex-row md:gap-6 lg:gap-8">
  {/* Stacks on mobile, side-by-side on tablet+ */}
</div>
```

### Component-Specific Styles

For complex animations or :hover states not suitable for Tailwind, use CSS Modules:

```css
/* components/VotingButton.module.css */
.button {
  @apply rounded-lg px-4 py-2 transition-all;
}

.button:active {
  transform: scale(0.98);
}

.button[data-voted="true"] {
  animation: celebrateVote 0.6s ease-out;
}

@keyframes celebrateVote {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
```

---

## Testing Requirements

### Testing Stack

- **Unit/Component Tests**: Vitest + Testing Library
- **E2E Tests**: Playwright
- **Coverage Target**: 70%+ for `/packages`, 50%+ for `/apps`

### What to Test

#### ✅ MUST Test

1. **Shared utilities** (`/packages/core`, `/packages/firebase-utils`)
2. **Critical user flows** (E2E: Submit question → Appears on Stage View)
3. **Business logic** (Vote counting, jitter calculations)
4. **Component behavior** (Button disabled when poll ends)

#### ⚠️ Optional

- Presentational components with no logic
- Simple wrappers around library hooks

### Unit Test Pattern

```typescript
// lib/calculate-jitter.test.ts
import { describe, it, expect } from "vitest";
import { calculateJitter } from "./calculate-jitter";

describe("calculateJitter", () => {
  it("returns a delay within the specified window", () => {
    const windowMs = 2000;
    const delay = calculateJitter(windowMs);

    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(windowMs);
  });

  it("uses a different delay each time", () => {
    const delays = Array.from({ length: 100 }, () => calculateJitter(1000));
    const uniqueDelays = new Set(delays);

    expect(uniqueDelays.size).toBeGreaterThan(50); // Expect randomness
  });
});
```

### Component Test Pattern

```typescript
// components/QuestionCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCard } from './QuestionCard';

describe('QuestionCard', () => {
  const mockQuestion = {
    id: 'q1',
    text: 'What is your favorite feature?',
    author: 'anonymous',
    createdAt: new Date(),
  };

  it('displays the question text', () => {
    render(<QuestionCard question={mockQuestion} onPushToStage={() => {}} />);
    expect(screen.getByText('What is your favorite feature?')).toBeInTheDocument();
  });

  it('calls onPushToStage when button clicked', async () => {
    const handlePush = vi.fn();
    render(<QuestionCard question={mockQuestion} onPushToStage={handlePush} canModerate />);

    const button = screen.getByRole('button', { name: /push to stage/i });
    await userEvent.click(button);

    expect(handlePush).toHaveBeenCalledWith('q1');
  });
});
```

### E2E Test Pattern

Playwright E2E infrastructure is fully implemented. See [E2E_TESTING_PLAYWRIGHT.md](../docs/briefs/E2E_TESTING_PLAYWRIGHT.md) for comprehensive setup, patterns, and conventions.

**Quick Start:**

```bash
# Start Firebase emulators (required)
firebase emulators:start --only auth,firestore --project demo-brayford &

# Run E2E tests
pnpm test:e2e

# Or with UI mode
pnpm test:e2e:ui
```

**Test Structure:**

```
e2e/
├── fixtures/          # Auth and data fixtures
├── helpers/           # Firebase emulator helpers
├── page-objects/      # Page Object Models
└── tests/
    ├── auth/          # Sign-in/sign-out flows
    ├── onboarding/    # Organization creation
    ├── dashboard/     # Navigation, org switcher
    └── users/         # Team management, invitations
```

**Example with Page Objects and Fixtures:**

```typescript
// e2e/tests/onboarding/create-org.spec.ts
import { test, expect } from "../../fixtures/auth.fixture";
import { OnboardingPage } from "../../page-objects/onboarding.page";
import { DashboardPage } from "../../page-objects/dashboard.page";

test("new user completes onboarding", async ({ newUserPage }) => {
  const onboarding = new OnboardingPage(newUserPage.page);
  const dashboard = new DashboardPage(newUserPage.page);

  await onboarding.goto();
  await onboarding.completeAsOrganisation({
    name: "Test Org",
    email: "billing@test.com",
  });

  await expect(newUserPage.page).toHaveURL("/dashboard");
  await dashboard.expectLoaded();
});
```

**Key Conventions:**

- Use `data-testid` attributes for test selectors (e.g., `data-testid="signin-google-btn"`)
- Tests run against Firebase emulators (not production)
- All fixtures auto-clean data between tests
- Page Object Model encapsulates selectors and actions

---

## Git Workflow

### Branch Naming

| Type     | Format                   | Example                         |
| -------- | ------------------------ | ------------------------------- |
| Feature  | `feat/short-description` | `feat/add-poll-module`          |
| Bugfix   | `fix/issue-description`  | `fix/vote-count-race-condition` |
| Refactor | `refactor/area`          | `refactor/firebase-hooks`       |
| Docs     | `docs/topic`             | `docs/deployment-guide`         |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

**Examples**:

```
feat(audience): add live poll voting UI

Implements real-time voting interface with jitter to prevent
Firestore write limit saturation during high-concurrency events.

Closes #42
```

```
fix(firebase-utils): correct jitter window calculation

Previous implementation used Math.floor instead of Math.random,
resulting in no actual jitter. Now properly distributes writes
across the configured window.
```

### Pull Request Guidelines

1. **PR Title**: Same format as commit messages
2. **Description Template**:

   ```markdown
   ## What

   Brief description of changes

   ## Why

   Problem being solved or feature being added

   ## How

   Technical approach (if non-obvious)

   ## Testing

   - [ ] Unit tests added/updated
   - [ ] E2E test for critical path
   - [ ] Tested with 100+ concurrent users (if applicable)

   ## Screenshots

   (If UI changes)
   ```

3. **Review Requirements**:
   - At least 1 approval before merge
   - All CI checks pass (lint, test, type-check)
   - No merge conflicts

---

## Code Quality & Tooling

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};
```

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Pre-commit Hooks (Husky + lint-staged)

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write", "vitest related --run"]
  }
}
```

---

## Performance Guidelines

### Real-time Optimization

#### 1. Debounce/Throttle User Input

```typescript
import { useDebouncedCallback } from 'use-debounce';

export function SearchQuestions() {
  const debouncedSearch = useDebouncedCallback(
    (query: string) => {
      // Firebase query here
    },
    500 // Wait 500ms after user stops typing
  );

  return <input onChange={(e) => debouncedSearch(e.target.value)} />;
}
```

#### 2. Optimistic Updates

```typescript
export function VoteButton({ pollId, optionId }: VoteButtonProps) {
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = async () => {
    // Optimistic update (instant UI feedback)
    setHasVoted(true);

    try {
      await submitVote(pollId, optionId);
    } catch (error) {
      // Rollback on failure
      setHasVoted(false);
      toast.error('Vote failed. Please try again.');
    }
  };

  return <button disabled={hasVoted} onClick={handleVote}>Vote</button>;
}
```

#### 3. Memoization for Expensive Computations

```typescript
import { useMemo } from 'react';

export function PollResults({ votes }: { votes: Vote[] }) {
  const results = useMemo(() => {
    return calculatePercentages(votes); // Heavy calculation
  }, [votes]);

  return <ResultsChart data={results} />;
}
```

### Bundle Size

- **Code-split routes**: Next.js handles this automatically
- **Lazy-load heavy components**:

  ```typescript
  import dynamic from "next/dynamic";

  const ConfettiAnimation = dynamic(() => import("./ConfettiAnimation"), {
    ssr: false, // Client-only
  });
  ```

- **Analyze bundle**:
  ```bash
  pnpm build --analyze
  ```

---

## Documentation

### Code Comments

#### ✅ DO: Explain "why", not "what"

```typescript
// We use a 2-second jitter window to stay under Firebase's 500 writes/sec limit
// at 5,000 concurrent users (5000 writes / 2 seconds = 2,500 writes/sec theoretical,
// but distributed writes prevent burst saturation).
await withJitter(() => submitVote(pollId, optionId), { windowMs: 2000 });
```

#### ❌ DON'T: State the obvious

```typescript
// Set the active module to 'poll'
setActiveModule("poll");
```

### JSDoc for Public APIs

````typescript
/**
 * Submits a vote for a poll option with jitter to prevent write saturation.
 *
 * @param pollId - The unique identifier for the poll
 * @param optionId - The option being voted for
 * @param userId - The participant's user ID (for duplicate prevention)
 * @returns Promise that resolves when the vote is recorded
 *
 * @throws {FirebaseError} If the write fails due to permissions or network issues
 *
 * @example
 * ```typescript
 * await submitVote('poll-123', 'option-a', 'user-456');
 * ```
 */
export async function submitVote(
  pollId: string,
  optionId: string,
  userId: string,
): Promise<void> {
  // Implementation
}
````

### README per App

Each app should have a README covering:

```markdown
# Audience App

## Purpose

Mobile web interface for event participants.

## Key Features

- QR code entry
- Real-time polling
- Q&A submission

## Local Development

\`\`\`bash
pnpm dev
\`\`\`

## Environment Variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

## Deployment

Deploys to Vercel on merge to `main`.
```

---

## Enforcement & Review

### Before Committing

Run these commands:

```bash
pnpm lint       # Check for linting errors
pnpm type-check # TypeScript validation
pnpm test       # Run unit tests
```

### CI/CD Checks

All PRs must pass:

1. ✅ **Lint**: ESLint with no errors
2. ✅ **Type-check**: `tsc --noEmit` in all packages
3. ✅ **Tests**: 70%+ coverage in `/packages`
4. ✅ **Build**: All apps build successfully

### Code Review Checklist

Reviewers should verify:

- [ ] Follows naming conventions
- [ ] TypeScript strict mode compliant
- [ ] Real-time listeners properly unsubscribe
- [ ] High-concurrency writes use jitter
- [ ] Components are appropriately tested
- [ ] No console.log statements (use console.error/warn if needed)
- [ ] Performance considerations for 5,000+ users

---

## Exceptions & Flexibility

**These are guidelines, not laws.** If you need to deviate:

1. Document the reason in a comment
2. Mention it in the PR description
3. Get approval from another developer

Example:

```typescript
// Temporarily bypassing jitter for admin-initiated actions
// since they represent <1% of writes and need instant feedback.
// TODO: Remove this after implementing optimistic UI updates.
await updateDoc(eventRef, { status: "ended" });
```

---

## Questions & Updates

- **Questions**: Open a discussion in the repo or ask in team chat
- **Proposed Changes**: Submit a PR to this document

**This guide is a living document.** As the project evolves, so should these standards.

---

_Document maintained by the Project Brayford team | v1.0.0_
