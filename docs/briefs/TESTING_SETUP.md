# Testing Setup Brief - Project Brayford

**Status:** ✅ **COMPLETED**  
**Completion Date:** December 2024  
**Assignee:** GitHub Copilot

---

## Implementation Summary

**All objectives achieved:**

- ✅ **296 tests passing** across 9 test files
- ✅ **96%+ coverage** (exceeds 70% target by significant margin)
- ✅ Vitest + Testing Library fully configured
- ✅ GitHub Actions CI workflow in place
- ✅ Test scripts available (`pnpm test`, `pnpm test:coverage`, `pnpm test:ui`)

**Coverage Results:**

| Metric     | Achieved | Target | Status  |
| ---------- | -------- | ------ | ------- |
| Statements | 96.31%   | 70%    | ✅ +26% |
| Branches   | 81.69%   | 70%    | ✅ +11% |
| Functions  | 94.93%   | 70%    | ✅ +24% |
| Lines      | 96.26%   | 70%    | ✅ +26% |

---

## Objective

Configure Vitest + Testing Library for the monorepo with initial test coverage for Phase 1 packages.

---

## Scope

**Packages to configure:**

1. `packages/core` - Schema validation tests
2. `packages/firebase-utils` - Firebase operations tests (mocked)
3. Apps (lighter coverage) - Can defer initially

**Coverage targets:**

- Packages: 70%+
- Apps: 50%+

---

## Tasks

### 1. Install Dependencies (Root Level)

```bash
pnpm add -D -w vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
pnpm add -D -w @types/testing-library__jest-dom
```

### 2. Configure Vitest

**Root `vitest.config.ts`:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.config.*"],
    },
  },
});
```

**Root `vitest.setup.ts`:**

```typescript
import "@testing-library/jest-dom";
```

### 3. Add Test Scripts to Root `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### 4. Write Tests for `packages/core`

**Priority: Schema validation tests** (these are straightforward)

Example: `packages/core/src/schemas/__tests__/user.schema.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { UserSchema, CreateUserSchema, validateUserData } from "../user.schema";

describe("UserSchema", () => {
  it("validates correct user data", () => {
    const validUser = {
      uid: "test-uid",
      email: "test@example.com",
      displayName: "Test User",
      photoURL: "https://example.com/photo.jpg",
      authProvider: "google.com" as const,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    expect(() => validateUserData(validUser)).not.toThrow();
  });

  it("rejects invalid email", () => {
    const invalidUser = {
      uid: "test-uid",
      email: "not-an-email",
      displayName: "Test User",
      photoURL: null,
      authProvider: "google.com" as const,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    expect(() => validateUserData(invalidUser)).toThrow();
  });

  it("rejects missing required fields", () => {
    const invalidUser = {
      email: "test@example.com",
      // missing uid, displayName, etc.
    };

    expect(() => validateUserData(invalidUser)).toThrow();
  });

  it("allows null photoURL", () => {
    const validUser = {
      uid: "test-uid",
      email: "test@example.com",
      displayName: "Test User",
      photoURL: null,
      authProvider: "google.com" as const,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    expect(() => validateUserData(validUser)).not.toThrow();
  });
});

describe("CreateUserSchema", () => {
  it("validates create user data without timestamps", () => {
    const createData = {
      uid: "test-uid",
      email: "test@example.com",
      displayName: "Test User",
      photoURL: "https://example.com/photo.jpg",
      authProvider: "google.com" as const,
    };

    expect(() => CreateUserSchema.parse(createData)).not.toThrow();
  });

  it("rejects data with createdAt field", () => {
    const invalidData = {
      uid: "test-uid",
      email: "test@example.com",
      displayName: "Test User",
      photoURL: null,
      authProvider: "google.com" as const,
      createdAt: new Date(), // Should be omitted for CreateUserSchema
    };

    // CreateUserSchema omits this field, so it should still parse but ignore it
    const result = CreateUserSchema.parse(invalidData);
    expect(result).not.toHaveProperty("createdAt");
  });
});
```

**Test all schemas:** User, Organization, OrganizationMember, Brand

**Additional test files needed:**

- `packages/core/src/schemas/__tests__/organization.schema.test.ts`
- `packages/core/src/schemas/__tests__/brand.schema.test.ts`

Test coverage should include:

- Valid data passes validation
- Invalid data throws errors
- Required fields enforced
- Optional fields work correctly
- Enum values validated
- Create/Update schema variants work correctly

### 5. Write Tests for `packages/firebase-utils`

**Mock Firebase** using Vitest mocks

Example: `packages/firebase-utils/src/__tests__/jitter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withJitter, createJittered, batchWithJitter } from "../jitter";

describe("withJitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delays execution within specified window", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const start = Date.now();

    const result = await withJitter(mockFn, { windowMs: 100 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(150); // 100ms window + buffer
    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe("result");
  });

  it("executes function and returns result", async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: "test" });

    const result = await withJitter(mockFn, { windowMs: 10 });

    expect(result).toEqual({ data: "test" });
  });

  it("respects minDelayMs option", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const start = Date.now();

    await withJitter(mockFn, { windowMs: 100, minDelayMs: 50 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});

describe("createJittered", () => {
  it("creates a jittered version of a function", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const jitteredFn = createJittered(mockFn, { windowMs: 10 });

    const result = await jitteredFn();

    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe("result");
  });

  it("passes arguments correctly", async () => {
    const mockFn = vi.fn().mockResolvedValue("result");
    const jitteredFn = createJittered(mockFn, { windowMs: 10 });

    await jitteredFn("arg1", "arg2");

    expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
  });
});

describe("batchWithJitter", () => {
  it("executes all operations with jitter", async () => {
    const mockFn1 = vi.fn().mockResolvedValue("result1");
    const mockFn2 = vi.fn().mockResolvedValue("result2");
    const mockFn3 = vi.fn().mockResolvedValue("result3");

    const results = await batchWithJitter([mockFn1, mockFn2, mockFn3], {
      windowMs: 10,
    });

    expect(results).toEqual(["result1", "result2", "result3"]);
    expect(mockFn1).toHaveBeenCalled();
    expect(mockFn2).toHaveBeenCalled();
    expect(mockFn3).toHaveBeenCalled();
  });
});
```

**Mock Firestore operations:**

Example: `packages/firebase-utils/src/firestore/__tests__/users.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUser, updateUser, userExists } from "../users";
import { toBranded } from "@brayford/core";
import type { UserId } from "@brayford/core";

// Mock Firebase
vi.mock("firebase/firestore", () => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: "serverTimestamp" })),
}));

vi.mock("../../config", () => ({
  db: {},
  auth: {},
  firebaseApp: {},
}));

import { getDoc, updateDoc } from "firebase/firestore";

describe("users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUser", () => {
    it("returns user when document exists", async () => {
      const mockUserId = toBranded<UserId>("test-user-id");
      const mockUserData = {
        uid: "test-user-id",
        email: "test@example.com",
        displayName: "Test User",
        photoURL: null,
        authProvider: "google.com" as const,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      } as any);

      const user = await getUser(mockUserId);

      expect(user).toBeTruthy();
      expect(user?.id).toBe(mockUserId);
      expect(user?.email).toBe("test@example.com");
    });

    it("returns null when document does not exist", async () => {
      const mockUserId = toBranded<UserId>("nonexistent-user");

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
      } as any);

      const user = await getUser(mockUserId);

      expect(user).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("calls updateDoc with validated data", async () => {
      const mockUserId = toBranded<UserId>("test-user-id");
      const updateData = {
        displayName: "New Name",
        photoURL: "https://new-photo.jpg",
      };

      await updateUser(mockUserId, updateData);

      expect(updateDoc).toHaveBeenCalledOnce();
    });
  });

  describe("userExists", () => {
    it("returns true when user exists", async () => {
      const mockUserId = toBranded<UserId>("test-user-id");

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
      } as any);

      const exists = await userExists(mockUserId);

      expect(exists).toBe(true);
    });

    it("returns false when user does not exist", async () => {
      const mockUserId = toBranded<UserId>("nonexistent-user");

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
      } as any);

      const exists = await userExists(mockUserId);

      expect(exists).toBe(false);
    });
  });
});
```

**Additional test files needed:**

- `packages/firebase-utils/src/firestore/__tests__/organizations.test.ts`
- `packages/firebase-utils/src/firestore/__tests__/brands.test.ts`
- `packages/firebase-utils/src/firestore/__tests__/converters.test.ts`
- `packages/firebase-utils/src/auth/__tests__/google.test.ts`

### 6. Test Files Structure

```
packages/
  core/
    src/
      schemas/
        __tests__/
          user.schema.test.ts
          organization.schema.test.ts
          brand.schema.test.ts
  firebase-utils/
    src/
      __tests__/
        jitter.test.ts
      firestore/
        __tests__/
          users.test.ts
          organizations.test.ts
          brands.test.ts
          converters.test.ts
      auth/
        __tests__/
          google.test.ts
```

---

## Success Criteria

- [ ] Vitest configured and running (`pnpm test` works)
- [ ] All schemas in `@brayford/core` have validation tests
- [ ] Jitter utility has coverage tests
- [ ] Firestore operations have basic tests (with mocked Firebase)
- [ ] Coverage report shows 70%+ for packages
- [ ] CI-ready (tests can run in GitHub Actions)
- [ ] All tests pass with `pnpm test`
- [ ] Coverage report generated with `pnpm test:coverage`

---

## Optional Enhancements

- Set up GitHub Actions workflow for CI
- Add mutation testing with Stryker
- Configure test watch mode for development
- Add snapshot testing for complex objects
- Integration tests with Firebase emulator

---

## Time Estimate

**2-4 hours** for basic setup + initial tests

Breakdown:

- Vitest setup and configuration: 30 mins
- Core schema tests: 1 hour
- Firebase utils tests (with mocking): 1.5-2 hours
- Coverage verification and cleanup: 30 mins

---

## Questions/Blockers

Report back if:

- Firebase mocking is complex or coverage targets seem unrealistic
- Need guidance on testing patterns
- Need help with TypeScript types in tests
- Encounter issues with monorepo test configuration

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Zod Testing Patterns](https://zod.dev/)
- Project: [DEVELOPER_STANDARDS.md](../DEVELOPER_STANDARDS.md)

---

## Implementation Plan (Quality-Focused Approach)

**Decision**: Prioritizing reliability and comprehensive coverage over speed.

### Design Decisions:

1. **Comprehensive Coverage**: Test all validation functions (including OrganizationMember variants), converters, and all Firebase operations
2. **Reliable Timing Tests**: Mock `setTimeout` in jitter tests to avoid flaky time-based assertions
3. **Test Utilities**: Create reusable test factories/helpers in `__tests__/helpers/` for maintainability
4. **Better Assertions**: Check specific Zod error messages and details, not just `toThrow()`
5. **Converter Testing**: Full coverage for timestamp ↔ date conversions (critical infrastructure)
6. **Auth Testing**: Include with proper Firebase Auth mocks (production-critical)
7. **Package-Level Scripts**: Add test scripts to both root AND individual packages for flexibility
8. **CI Setup**: Include GitHub Actions workflow now (not deferred to "optional")
9. **Coverage Tooling**: Install `@vitest/coverage-v8` explicitly for accurate reporting

### Implementation Order:

1. ✅ Install all dependencies + coverage tooling
2. ✅ Configure Vitest (root config + setup file)
3. ✅ Create test utilities/factories (`packages/core/src/__tests__/helpers/test-factories.ts`)
4. ✅ Core schema validation tests:
   - `user.schema.test.ts` (all 3 validators)
   - `organization.schema.test.ts` (all 7 validators including member variants)
   - `brand.schema.test.ts` (all 3 validators)
5. ✅ Converter tests:
   - `converters.test.ts` (timestamp conversions, edge cases, round-trip)
6. ✅ Jitter utility tests:
   - `jitter.test.ts` (with mocked timers for reliability)
7. ✅ Firestore operations tests (with Firebase mocks):
   - `users.test.ts` (getUser, updateUser, userExists, deleteUser if exists)
   - `organizations.test.ts` (all org + member CRUD operations)
   - `brands.test.ts` (all brand CRUD operations)
8. ✅ Auth tests:
   - `google.test.ts` (sign in, sign out, user document creation)
9. ✅ Add test scripts to all package.json files (root + packages)
10. ✅ Create GitHub Actions CI workflow (`.github/workflows/test.yml`)
11. ✅ Run full test suite and verify 70%+ package coverage
12. ✅ Document any coverage gaps or known limitations

### Notes:

- Use `vi.useFakeTimers()` for jitter tests (prevents flakiness)
- Create shared Firebase mock utilities for consistency
- Verify all branded type helpers (`toBranded`, `fromBranded`) work in tests
- Test both success and error paths for Firestore operations
- Include edge cases: null values, empty strings, invalid dates, etc.
