# E2E Testing with Playwright - Technical Brief

**Project Brayford** | End-to-End Testing Infrastructure  
_Created: 9 February 2026_  
**Status:** Approved — ready for implementation

---

## Purpose

Set up Playwright for end-to-end testing across the monorepo, starting with the creator app. E2E tests validate critical user flows that span multiple components, API routes, and Firebase interactions — the seams that unit tests can't cover.

### Why Now?

- **Invitation system** introduces multi-step flows (email link → auth → acceptance → dashboard) that are difficult to validate with unit tests alone
- **Onboarding** has two distinct paths (Flow A: create org, Flow B: accept invite) that must both work reliably
- **Multi-org switching** needs confidence that navigation state is correct across transitions
- The developer standards already reference Playwright — time to deliver on that

---

## Scope

### Phase 1: Infrastructure (This Implementation)

**Included:**

- ✅ Playwright installation and configuration for the monorepo
- ✅ Firebase Auth test helpers (mock/emulator-based authentication)
- ✅ Firestore test data seeding utilities
- ✅ Page Object Model (POM) base classes for creator app
- ✅ First critical flow tests (auth → onboarding → dashboard)
- ✅ CI integration (GitHub Actions)
- ✅ Scripts in root `package.json`

**Deferred to Phase 2:**

- ⏳ Cross-app tests (audience → stage view flows)
- ⏳ Visual regression testing
- ⏳ Performance/load testing
- ⏳ Accessibility auditing via axe-playwright
- ⏳ Mobile viewport testing matrix
- ⏳ Parallel test sharding for CI speed

---

## Architecture

### Directory Structure

```
/project-brayford
├── e2e/
│   ├── playwright.config.ts       # Playwright configuration
│   ├── global-setup.ts            # Firebase emulator bootstrap
│   ├── global-teardown.ts         # Cleanup
│   ├── fixtures/
│   │   ├── auth.fixture.ts        # Authenticated user fixtures
│   │   └── data.fixture.ts        # Firestore seed data fixtures
│   ├── helpers/
│   │   ├── firebase-emulator.ts   # Emulator connection & seeding
│   │   ├── auth-helpers.ts        # Sign-in/sign-out utilities
│   │   └── wait-helpers.ts        # Custom waitFor conditions
│   ├── page-objects/
│   │   ├── base.page.ts           # Base POM with common actions
│   │   ├── signin.page.ts         # Sign-in page interactions
│   │   ├── onboarding.page.ts     # Onboarding flow interactions
│   │   ├── dashboard.page.ts      # Dashboard page interactions
│   │   └── users.page.ts          # Team members page interactions
│   └── tests/
│       ├── auth/
│       │   ├── signin.spec.ts     # Google OAuth sign-in flow
│       │   └── signout.spec.ts    # Sign-out and redirect
│       ├── onboarding/
│       │   ├── create-org.spec.ts # Flow A: create own org
│       │   └── invite-join.spec.ts# Flow B: accept invitation
│       ├── dashboard/
│       │   ├── navigation.spec.ts # Dashboard card navigation
│       │   └── org-switcher.spec.ts
│       └── users/
│           ├── invite-user.spec.ts
│           └── manage-team.spec.ts
├── package.json                   # (updated: add e2e scripts)
└── .github/
    └── workflows/
        └── test.yml               # (updated: add e2e job)
```

### Key Design Decisions

#### 1. Dev Server Port Allocation

All four apps use explicit dev ports to ensure deterministic URLs across local development and E2E tests:

| App | Port | URL |
|---|---|---|
| **creator** | 3000 | `http://localhost:3000` |
| **audience** | 3001 | `http://localhost:3001` |
| **stage** | 3002 | `http://localhost:3002` |
| **admin** | 3003 | `http://localhost:3003` |

This is configured via `--port` flags in each app's `package.json` dev script. Without explicit ports, `pnpm dev` (which runs all apps in parallel) would assign ports non-deterministically.

#### 2. Firebase Emulators for Isolation

E2E tests **must** run against Firebase emulators, not production or staging. This ensures:

- Tests are deterministic and repeatable
- No cost implications from Firestore reads/writes
- Auth flows can be simulated without real OAuth
- Tests can run offline / in CI

```typescript
// e2e/helpers/firebase-emulator.ts
export const EMULATOR_CONFIG = {
  auth: { host: "localhost", port: 9099 },
  firestore: { host: "localhost", port: 8080 },
} as const;
```

#### 3. Firebase Auth in Tests

Firebase Auth Emulator supports creating users programmatically and generating sign-in tokens without going through real OAuth. This is critical because Playwright can't interact with Google's OAuth popup reliably.

**Approach:** Use the Auth Emulator REST API to:

- Create test users with specific emails
- Generate custom tokens
- Sign in via `signInWithCustomToken()` injected into the page context

```typescript
// e2e/helpers/auth-helpers.ts
export async function createTestUser(
  email: string,
  displayName: string,
): Promise<string> {
  // POST to Auth Emulator REST API to create user
  // Returns uid
}

export async function signInAsTestUser(page: Page, uid: string): Promise<void> {
  // Inject Firebase auth state into the page via evaluate()
  // Uses signInWithCustomToken against emulator
}
```

#### 4. Page Object Model

Every app page gets a POM class that encapsulates selectors and actions. Tests read like user stories, not DOM queries.

```typescript
// e2e/page-objects/dashboard.page.ts
export class DashboardPage extends BasePage {
  readonly teamMembersCard: Locator;
  readonly brandsList: Locator;
  readonly orgSwitcher: Locator;

  constructor(page: Page) {
    super(page);
    this.teamMembersCard = page.getByTestId("team-members-card");
    this.brandsList = page.getByTestId("brands-list");
    this.orgSwitcher = page.getByTestId("org-switcher");
  }

  async navigateToTeamMembers(): Promise<void> {
    await this.teamMembersCard.click();
    await this.page.waitForURL("**/dashboard/users");
  }
}
```

#### 5. Test Data Fixtures

Reusable Firestore seed data for consistent test scenarios:

```typescript
// e2e/fixtures/data.fixture.ts
export const TEST_ORGS = {
  bbcOrg: {
    name: "BBC Test Org",
    type: "team",
    billingEmail: "billing@bbc-test.com",
  },
  soloCreator: {
    name: "Jane Smith Productions",
    type: "individual",
    billingEmail: "jane@test.com",
  },
} as const;

export const TEST_USERS = {
  owner: { email: "owner@test.com", displayName: "Test Owner" },
  admin: { email: "admin@test.com", displayName: "Test Admin" },
  member: { email: "member@test.com", displayName: "Test Member" },
  newUser: { email: "new@test.com", displayName: "New User" },
} as const;
```

---

## Configuration

### Playwright Config

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "on-failure" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Phase 2: Add Firefox, Safari, mobile viewports
  ],

  // Start creator app dev server before tests
  webServer: {
    command: "pnpm --filter creator dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
});
```

### Environment Variables

```bash
# .env.test (committed — emulator-only values, no secrets)
NEXT_PUBLIC_FIREBASE_API_KEY=test-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-brayford
NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
```

---

## Dependencies

### New (Root Level)

```bash
pnpm add -D -w @playwright/test
```

After install:

```bash
npx playwright install chromium
```

### Firebase Emulators

Already available via `firebase-tools` (global install or `npx firebase`). The `firebase.json` at root already exists and can be extended with emulator config if not present.

---

## Scripts

### Root `package.json` Additions

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=e2e/playwright.config.ts",
    "test:e2e:ui": "playwright test --config=e2e/playwright.config.ts --ui",
    "test:e2e:headed": "playwright test --config=e2e/playwright.config.ts --headed",
    "test:e2e:debug": "playwright test --config=e2e/playwright.config.ts --debug"
  }
}
```

---

## CI Integration

### GitHub Actions Update

Add an E2E job to the existing `.github/workflows/test.yml`. The current workflow has `test` and `build` jobs; the E2E job runs after `test` passes.

**Note:** E2E runs on Node 20.x only (no matrix). Browser compatibility is what matters for E2E — the Node matrix in unit tests already covers runtime differences.

```yaml
e2e-tests:
  name: E2E Tests
  runs-on: ubuntu-latest
  needs: [test] # Run after unit tests / lint / type-check pass
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: "pnpm"

    - run: pnpm install --frozen-lockfile

    # Install Playwright browsers
    - run: npx playwright install --with-deps chromium

    # Install Firebase CLI for emulators
    - run: npm install -g firebase-tools

    # Start Firebase emulators in background
    - run: firebase emulators:start --only auth,firestore --project demo-brayford &

    # Wait for emulators to be ready (poll ports instead of sleep)
    - name: Wait for Firebase emulators
      run: |
        echo "Waiting for Auth emulator on port 9099..."
        timeout 30 bash -c 'until curl -s http://localhost:9099 > /dev/null 2>&1; do sleep 1; done'
        echo "Waiting for Firestore emulator on port 8080..."
        timeout 30 bash -c 'until curl -s http://localhost:8080 > /dev/null 2>&1; do sleep 1; done'
        echo "Emulators ready."

    # Run E2E tests
    - run: pnpm test:e2e

    # Upload test artifacts on failure
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: e2e/playwright-report/
        retention-days: 7
```

---

## Data-Testid Conventions

All interactive elements that E2E tests target should use `data-testid` attributes. This decouples tests from CSS classes or text content (which may change for i18n).

### Naming Convention

```
data-testid="{component}-{element}"
```

**Examples:**

| Element                    | Attribute                                 |
| -------------------------- | ----------------------------------------- |
| Sign-in page Google button | `data-testid="signin-google-btn"`         |
| Onboarding org name input  | `data-testid="onboarding-org-name"`       |
| Dashboard team card        | `data-testid="team-members-card"`         |
| Invite modal email input   | `data-testid="invite-email-input"`        |
| Invite modal submit        | `data-testid="invite-submit-btn"`         |
| Org switcher dropdown      | `data-testid="org-switcher"`              |
| Org switcher item          | `data-testid="org-switcher-item-{orgId}"` |

### Guideline

- Add `data-testid` only to elements that E2E tests need to interact with or assert on
- Don't add them to every element — only test boundaries
- Prefer semantic queries (`getByRole`, `getByLabel`) in Playwright where possible; fall back to `getByTestId` when semantics are ambiguous

---

## Initial Test Coverage Plan

### Priority 1: Auth & Onboarding (Creator App)

| Test                                                                        | Validates              |
| --------------------------------------------------------------------------- | ---------------------- |
| Unauthenticated user redirected to `/signin`                                | Auth guard works       |
| Sign in with test credentials → redirected to `/onboarding` or `/dashboard` | Auth flow              |
| New user completes onboarding (Flow A)                                      | Org creation, redirect |
| Existing user with org skips onboarding                                     | Smart routing          |

### Priority 2: Invitation Flows (Creator App)

> **Note:** These tests will be implemented once the invitation system is built. Until then, spec files will contain `test.skip` placeholders with TODOs so the test structure is in place without false failures.

| Test                                                    | Validates           |
| ------------------------------------------------------- | ------------------- |
| Admin opens invite modal, fills form, sends             | Invitation creation |
| New user clicks invite link → sees invitation page      | Token validation    |
| New user authenticates → joins org → lands on dashboard | Full Flow B         |
| Existing user accepts invite → org added                | Multi-org join      |
| Expired token shows error page                          | Edge case           |
| Email mismatch shows error                              | Security            |

### Priority 3: Dashboard Navigation

| Test                                              | Validates        |
| ------------------------------------------------- | ---------------- |
| Dashboard loads with correct org data             | Data fetching    |
| Team members card navigates to `/dashboard/users` | Navigation       |
| Org switcher shows all user's orgs                | Multi-org UX     |
| Switching org reloads dashboard data              | State management |

---

## Firebase Emulator Considerations

### Emulator Config Addition to `firebase.json`

**Status:** `firebase.json` currently has **no emulator section**. The following must be added:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

### Connecting the Creator App to Emulators

**Status:** `@brayford/firebase-utils/src/config.ts` currently has **no emulator connection logic**. It also calls `validateConfig()` on import which throws if _any_ env var is missing (including `storageBucket`, `messagingSenderId`, `appId` — none of which are needed for emulator-only runs).

**Implementation plan:**

1. Make `validateConfig()` skip non-essential keys when `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` (only `apiKey`, `authDomain`, and `projectId` are required for emulator mode)
2. Add emulator connection after auth/firestore initialisation:

```typescript
import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";

// After auth and db are initialised:
if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
}
```

---

## Limitations & Risks

| Risk                                    | Mitigation                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------- |
| Firebase emulator startup time slows CI | Cache emulator binaries; run only after unit tests pass                    |
| Google OAuth can't be tested directly   | Use Auth Emulator's custom token flow                                      |
| Flaky tests from timing issues          | Use Playwright's auto-waiting; add explicit `waitForResponse` where needed |
| Port conflicts in CI                    | Use fixed ports with `firebase.json`; fail fast if ports occupied          |
| Test data leakage between tests         | Clear emulator data between test files via REST API                        |

---

## Success Criteria

- ✅ `pnpm test:e2e` runs all tests against Firebase emulators
- ✅ Tests pass in CI (GitHub Actions) with no manual intervention
- ✅ Auth flows work without real OAuth interaction
- ✅ Page Object Model established for creator app pages
- ✅ At least 5 critical flow tests passing
- ✅ Test artifacts (screenshots, traces) uploaded on failure in CI
- ✅ Documentation updated (DEVELOPER_STANDARDS.md reference fulfilled)

---

## Implementation Timeline

**Estimated:** 3-4 hours

- **Infrastructure setup** (config, emulator helpers, fixtures): 1-1.5 hours
- **Page Object Models**: 30-45 min
- **Initial test suite** (auth, onboarding, dashboard): 1-1.5 hours
- **CI integration**: 30 min

---

## Resolved Questions

| # | Question | Answer |
|---|---|---|
| 1 | Firebase emulator config in `firebase.json`? | **Not present** — needs adding (auth:9099, firestore:8080, ui:4000) |
| 2 | Existing CI workflow? | **Yes** — `.github/workflows/test.yml` (not `ci.yml`). Has `test` and `build` jobs. E2E job will be added after `test`. |
| 3 | Creator app port? | **Now fixed at 3000** via `--port` flag. All four apps have explicit ports (3000–3003). |
| 4 | Test user auth approach? | **Both** — Auth Emulator REST API to create users, `signInWithCustomToken()` to authenticate in the browser context. |
| 5 | `validateConfig()` vs emulators? | **Relax validation** when `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` — skip non-essential keys rather than requiring dummy values. |
| 6 | Invitation flow tests? | **Placeholder specs with `test.skip`** until the invitation system is implemented. Structure in place, no false failures. |
| 7 | Node matrix for E2E in CI? | **20.x only** — browser compatibility matters more than Node version for E2E. Unit tests already cover the Node matrix. |
| 8 | `data-testid` additions? | **Part of this work** — prerequisite for tests, not a separate task. |
| 9 | Emulator startup in CI? | **Poll ports** instead of `sleep 5` — more reliable on cold CI runners. |

---

**Status:** Approved — ready for implementation  
**Next Step:** Implement Phase 1 infrastructure alongside or after invitation system
