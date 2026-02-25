# Code Review — Project Brayford

**Date:** 24 February 2026  
**Scope:** Full codebase review (excluding `apps/stage/`)  
**Reviewer:** GitHub Copilot (Claude Opus 4.6)  
**Status:** 69 of ~142 findings fixed (marked with ✅ FIXED)

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Issue Tracker](#issue-tracker)
- [1. packages/core](#1-packagescore)
- [2. packages/firebase-utils](#2-packagesfirebase-utils)
- [3. apps/admin](#3-appsadmin)
- [4. apps/audience](#4-appsaudience)
- [5. apps/creator](#5-appscreator)
- [6. functions/](#6-functions)
- [7. E2E Tests](#7-e2e-tests)
- [8. Firestore Rules & Configuration](#8-firestore-rules--configuration)
- [9. Documentation](#9-documentation)
- [Positive Observations](#positive-observations)

---

## Executive Summary

The codebase is well-structured with good component decomposition, thorough JSDoc documentation, and solid Firebase integration patterns. The domain model is thoughtfully designed and the permission system is comprehensive. However, this review surfaced **~130 findings** across the full codebase, including several critical security and data integrity issues that should be addressed before any production usage.

### Top 10 Priority Items

| #   | Severity    | Area      | Issue                                                                                              |
| --- | ----------- | --------- | -------------------------------------------------------------------------------------------------- |
| 1   | 🔴 CRITICAL | Functions | Unauthenticated HTTP endpoint `triggerBatchEmailProcessing` ([F-2](#f-2)) — ✅ FIXED               |
| 2   | 🔴 CRITICAL | Functions | Postmark API key in `.env` not excluded by `functions/.gitignore` ([F-1](#f-1)) — ✅ FIXED         |
| 3   | 🔴 CRITICAL | Rules     | `events` collection globally readable without authentication ([R-1](#r-1)) — ✅ FIXED              |
| 4   | 🔴 CRITICAL | Audience  | No jitter on any Firestore writes in the 5,000-user audience app ([AU-2](#au-2)) — ✅ FIXED        |
| 5   | 🟠 HIGH     | Rules     | 9+ missing Firestore composite indexes — queries will fail at runtime ([R-6](#r-6)) — ✅ FIXED     |
| 6   | 🟠 HIGH     | Admin     | Next.js 16 `params` API mismatch — `[orgId]` page will break at runtime ([AD-1](#ad-1)) — ✅ FIXED |
| 7   | 🟠 HIGH     | Creator   | 17 instances of `alert()` / `window.confirm()` / `window.prompt()` ([CR-1](#cr-1)) — ✅ FIXED      |
| 8   | 🟠 HIGH     | Functions | `strict: false` in TypeScript config, violating project standards ([F-3](#f-3))                    |
| 9   | 🟠 HIGH     | Rules     | Firestore rules tests have potential mismatches with actual rules ([R-2](#r-2)) — ✅ FIXED         |
| 10  | 🟠 HIGH     | Docs      | Multiple documents significantly outdated ([D-1](#d-1))                                            |

### Findings by Severity

| Severity                                               | Count |
| ------------------------------------------------------ | ----- |
| 🔴 Critical (security, data loss, runtime failures)    | 10    |
| 🟠 High (significant bugs, standards violations)       | 30    |
| 🟡 Medium (correctness, consistency, missing patterns) | 42    |
| 🔵 Low (style, minor, informational)                   | 50+   |

---

## Issue Tracker

Each finding has a unique ID for reference (e.g., `CO-1` for core, `FU-1` for firebase-utils, etc.).

---

## 1. packages/core

### 🔴 Critical

#### CO-1: `getRateLimitScope` missing `org-owner-invitation` case — ✅ FIXED

**File:** `packages/core/src/schemas/email-queue.schema.ts` ~L220  
`getRateLimitScope()` has no `case` for `'org-owner-invitation'`, so it falls through to `default: return 'global'`. However, `EMAIL_RATE_LIMITS` assigns it `scope: 'organization'`. The rate-limit scope at runtime will be `'global'` instead of the intended `organization:{id}` string, silently breaking per-org rate limiting for this email type.

Similarly, `getDefaultDeliveryMode` has no case for `'org-owner-invitation'` — it falls through to `default: return 'immediate'` which is correct but fragile.

### 🟠 High

#### CO-2: Conflicting image size constants — ✅ FIXED

**Files:** `packages/core/src/schemas/image.schema.ts` ~L37 and `packages/core/src/utils/upload.ts` ~L7

- `image.schema.ts`: `MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024` (10 MB)
- `upload.ts`: `MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024` (5 MB)

These represent the same concept but differ by 2×. Additionally, the MIME type lists conflict — `image.schema.ts` allows JPEG, PNG, WebP, GIF (no SVG), while `upload.ts` allows PNG, JPEG, WebP, SVG (no GIF). The schema comment says "SVG is intentionally excluded" yet `upload.ts` includes SVG.

#### CO-3: `MODULE_TYPES` const assertion negated by type annotation — ✅ FIXED

**File:** `packages/core/src/types/module.ts` ~L24

```typescript
export const MODULE_TYPES: ModuleType[] = [
  "text",
  "image",
  "messaging",
] as const;
```

The explicit `ModuleType[]` annotation widens the type, completely negating `as const`. The array is mutable at runtime. Should be:

```typescript
export const MODULE_TYPES = [
  "text",
  "image",
  "messaging",
] as const satisfies readonly ModuleType[];
```

#### CO-4: `TextModuleConfig.content` union with `unknown` is effectively just `unknown` — ✅ FIXED

**File:** `packages/core/src/types/module.ts` ~L40

```typescript
content: Record<string, unknown> | unknown;
```

`T | unknown` simplifies to `unknown` in TypeScript, so the `Record<string, unknown>` part provides zero type safety. Should be just `Record<string, unknown>`.

#### CO-5: Missing `firebase` peer dependency — ✅ FIXED

**File:** `packages/core/src/auth/super-admin.ts` ~L1  
Imports `type { User } from "firebase/auth"` but `firebase` is not in `package.json` dependencies or peerDependencies. Works only due to pnpm hoisting — fragile outside the monorepo.

#### CO-6: `UpdateOrganizationMemberSchema` omits `permissions`

**File:** `packages/core/src/schemas/organization.schema.ts` ~L163  
When a member's role changes, permissions must also change. But the update schema excludes `permissions`, so code using this schema can't update permissions in the same validated payload. Callers must manually add permissions outside validation.

### 🟡 Medium

#### CO-7: `ImageId` not exported from main barrel — ✅ FIXED

**File:** `packages/core/src/index.ts`  
All other branded ID types are exported, but `ImageId` (defined in `types/branded.ts`) is missing from the re-exports.

#### CO-8: `EventType` schema and type not exported from schema barrel — ✅ FIXED

**File:** `packages/core/src/schemas/index.ts`  
`EventType` (Zod schema + TS type) defined in `event.schema.ts` but not re-exported. Consumers can't access this type.

#### CO-9: `Permission` type doesn't use the `Brand` utility — ✅ FIXED

**File:** `packages/core/src/permissions/types.ts` ~L8  
Inline `string & { readonly __brand: 'Permission' }` instead of using `Brand<string, 'Permission'>` from `types/branded.ts`. Every other branded type uses the utility — this should too.

#### CO-10: `EmailQueueId` defined in schema file instead of `branded.ts` — ✅ FIXED

**File:** `packages/core/src/schemas/email-queue.schema.ts` ~L22  
All other branded ID types live in `types/branded.ts`. This one is inline in the schema file and doesn't use the `Brand<>` utility. Should be moved.

#### CO-11: `ImageModuleConfig.imageId` uses `string` instead of `ImageId` brand — ✅ FIXED

**File:** `packages/core/src/types/module.ts` ~L54  
Should use the `ImageId` branded type for consistency.

#### CO-12: `BrandStylingSchema` `.optional()` on schema definition itself

**File:** `packages/core/src/schemas/brand.schema.ts` ~L96  
Double optionality — the schema definition is `.optional()` AND the field usage in `BrandSchema` would make the type `{ ... } | undefined` in both the definition and usage. Unusual pattern.

#### CO-13: `EventStatus` and `EventType` naming inconsistency

**File:** `packages/core/src/schemas/event.schema.ts` ~L23  
Every other schema follows `XxxSchema` / `Xxx` convention. These should be `EventStatusSchema` / `EventStatus` and `EventTypeSchema` / `EventType`.

#### CO-14: Duplicate `BillingTierSchemaType` / `BillingMethodSchemaType` types

**File:** `packages/core/src/schemas/organization.schema.ts` ~L36  
Functionally identical to `BillingTier` / `BillingMethod` from `types/billing.ts`. Having two type definitions for the same concept increases maintenance burden and drift risk.

#### CO-15: Test factory missing required Organization fields — ✅ FIXED

**File:** `packages/core/src/__tests__/helpers/test-factories.ts` ~L67  
`createMockOrganization` doesn't provide `billingMethod`, `billingTier`, `primaryEmailDomain`, etc. Compiles only because test files are excluded from `tsconfig.json` includes.

#### CO-16: `package.json` exports need `types` conditions — ✅ FIXED

**File:** `packages/core/package.json` ~L8  
The exports map only specifies `.js` files with no `types` condition. Modern TypeScript resolution needs explicit `.d.ts` paths.

### 🔵 Low

#### CO-17: `isToobrightForTheatre` — misspelled camelCase — ✅ FIXED

**File:** `packages/core/src/utils/color.ts` ~L90  
Should be `isTooBrightForTheatre` (capital B). Also propagates to `toobrightForTheatre` property in `ColorValidation` interface.

#### CO-18: "Post-MVP" comment in user schema — ✅ FIXED

**File:** `packages/core/src/schemas/user.schema.ts` ~L19

```
Email/password and other providers deferred to post-MVP
```

Project standards forbid MVP/prototype language in code comments.

#### CO-19: `noUnusedLocals` and `noUnusedParameters` disabled

**File:** `packages/core/tsconfig.json` ~L18  
Both are `false`. Should be `true` for production-ready code.

#### CO-20: Duplicate `skipLibCheck` in `tsconfig.json` — ✅ FIXED

**File:** `packages/core/tsconfig.json` ~L14 and ~L22  
Same value set twice — copy-paste artefact.

#### CO-21: `module: "CommonJS"` in 2026

**File:** `packages/core/tsconfig.json` ~L5  
Could be modernised to ESM for better tree-shaking.

---

## 2. packages/firebase-utils

### 🔴 Critical

#### FU-1: `getOrganizationImages` — `activeOnly` filter is inverted — ✅ FIXED

**File:** `packages/firebase-utils/src/firestore/images.ts` ~L222

```typescript
where('isActive', '==', activeOnly),
```

When `activeOnly = false`, this queries for documents where `isActive === false` (only inactive images) instead of returning all images regardless of status. Compare with the correct pattern in `brands.ts` which conditionally adds the `where` clause.

#### FU-2: Phantom package export: `./hooks` subpath doesn't exist — ✅ FIXED

**File:** `packages/firebase-utils/package.json` ~L12

```json
"./hooks": "./src/hooks/index.ts"
```

No `src/hooks/` directory exists. Any consumer importing `@brayford/firebase-utils/hooks` will get a resolution error.

### 🟠 High

#### FU-3: Memory leak in `waitForAuth` — listener not cleaned up on timeout — ✅ FIXED

**File:** `packages/firebase-utils/src/auth/google.ts` ~L253  
If the timeout fires, `reject` is called but `unsubscribe()` is never called — the `onAuthStateChanged` listener remains active indefinitely.

#### FU-4: Non-atomic organisation creation — orphaned org risk

**File:** `packages/firebase-utils/src/firestore/organizations.ts` ~L113  
`createOrganization` performs two independent writes (org doc then member doc). If the second fails, the organisation exists without an owner. Should use `writeBatch`.

#### FU-5: Missing jitter on audience-facing write operations

**Files:** `packages/firebase-utils/src/firestore/audience-sessions.ts` and `message-columns.ts`  
Per project standards, jitter is non-negotiable for audience-facing writes. These lack it:

- `createAudienceSession` — called when audience joins (up to 5,000 simultaneous joins)
- `updateSessionHeartbeat` — called periodically by all connected audience members
- `addMessageToColumn` — audience messages flow through this

#### FU-6: Auth errors lose Firebase error codes — ✅ FIXED

**File:** `packages/firebase-utils/src/auth/google.ts` ~L124

```typescript
throw new Error("Failed to sign in with Google. Please try again.");
```

The original error is discarded. Callers cannot distinguish `auth/popup-closed-by-user` (intentional cancel) from `auth/network-request-failed`. Consider `throw new Error('...', { cause: error })`.

### 🟡 Medium

#### FU-7: `any` usage in `convertEventTimestamps` — ✅ FIXED

**File:** `packages/firebase-utils/src/firestore/events.ts` ~L48  
Both parameter and return type are `any`. Should use `Record<string, unknown>` and a proper return type.

#### FU-8: Missing return types on exported functions — ✅ FIXED

**Files:** `converters.ts` (`createConverter`), `event-live-state.ts` (`getLiveStateRef`)  
Exported functions lack explicit return type annotations.

#### FU-9: Unused imports — ✅ FIXED

**Files:** `users.ts` (`convertFromFirestore`), `organizations.ts` (`Query` type)  
Imported but never used.

#### FU-10: `shouldUseJitter` is an identity function

**File:** `packages/firebase-utils/src/jitter.ts` ~L171

```typescript
export function shouldUseJitter(isHighConcurrency: boolean): boolean {
  return isHighConcurrency;
}
```

Provides no value — could make meaningful decisions but currently just returns its input.

#### FU-11: Misleading `validateConfig` error message — ✅ FIXED

**File:** `packages/firebase-utils/src/config.ts` ~L78  
`key.toUpperCase()` on camelCase keys produces wrong env var names: `apiKey` → `APIKEY` → `NEXT_PUBLIC_FIREBASE_APIKEY`. Actual env var is `NEXT_PUBLIC_FIREBASE_API_KEY`.

#### FU-12: Comment/behaviour mismatch in `inviteUserToOrganization` — ✅ FIXED

**File:** `packages/firebase-utils/src/firestore/organizations.ts` ~L241  
JSDoc says "Creates a pending organizationMember document" but the code immediately sets `joinedAt: serverTimestamp()`.

### 🔵 Low

#### FU-13: Systematic import order violations

**Files:** All Firestore modules  
Relative imports (e.g., `'../config'`) appear before `@brayford/core` imports. Convention requires: external → `@brayford/*` → relative.

#### FU-14: `let` where `const` would suffice — ✅ FIXED

**Files:** `events.ts` ~L192, ~L236, ~L279; `images.ts` ~L222  
Variables declared with `let` that are never reassigned.

#### FU-15: Module-level constants not SCREAMING_SNAKE_CASE

**File:** `packages/firebase-utils/src/config.ts` ~L33  
`isFirestoreEmulatorMode` / `isAuthEmulatorMode` should be `IS_FIRESTORE_EMULATOR_MODE` / `IS_AUTH_EMULATOR_MODE`.

#### FU-16: `zod` as unused direct dependency — ✅ FIXED

**File:** `packages/firebase-utils/package.json`  
`zod` is listed but never imported directly — Zod validation happens via `@brayford/core`.

#### FU-17: `firebase` should be a peer dependency — ✅ FIXED

**File:** `packages/firebase-utils/package.json`  
Since consuming apps must share the same Firebase app instance, `firebase` should be a peer dependency to prevent version mismatches.

---

## 3. apps/admin

### 🔴 Critical

#### AD-1: Next.js 16 `params` API mismatch — will break at runtime — ✅ FIXED

**File:** `apps/admin/app/(protected)/organisations/[orgId]/page.tsx`

```tsx
export default function OrganisationDetailPage({
  params,
}: {
  params: { orgId: string };
}) {
```

Since Next.js 15+, `params` is a `Promise`. On Next.js 16.1.6, accessing `params.orgId` synchronously will produce `undefined` or throw.

#### AD-2: Non-transactional `provisionOrganisation` — orphaned data risk — ✅ FIXED

**File:** `apps/admin/lib/provision-organisation.ts`  
Three sequential Firestore writes (org doc, invitation, emailQueue) without a batch or transaction. If step 2 or 3 fails, step 1 has already persisted.

### 🟠 High

#### AD-3: Test/debug page accessible without authentication

**File:** `apps/admin/app/test-firebase/page.tsx`  
Lives outside the `(protected)` route group — no `AuthGuard`. Exposes Firebase config details. Has no place in a production codebase.

#### AD-4: No Zod validation on Firestore reads

**File:** `apps/admin/app/(protected)/organisations/page.tsx` ~L82  
`doc.data()` returns untyped data consumed directly with `??` fallbacks. `OrganizationSchema` from `@brayford/core` should be used.

#### AD-5: No Zod validation on Firestore writes — ✅ FIXED

**File:** `apps/admin/lib/provision-organisation.ts` ~L44  
Organisation document and emailQueue document written as raw object literals without schema validation.

#### AD-6: Direct Firebase SDK imports bypass the abstraction layer — ✅ FIXED

**Files:** `organisations/page.tsx`, `provision-organisation.ts`  
Import directly from `firebase/firestore` instead of through `@brayford/firebase-utils`, losing typed operations and jitter guardrails.

### 🟡 Medium

#### AD-7: Unused `watch` destructured from `useForm` — ✅ FIXED

**File:** `apps/admin/app/(protected)/organisations/new/page.tsx` ~L85  
Dead code — `watch` is destructured but never used.

#### AD-8: Unused component: `Header.tsx` — ✅ FIXED

**File:** `apps/admin/components/layout/Header.tsx`  
Fully implemented but never imported or rendered anywhere.

#### AD-9: `globals.css` body `font-family` overrides the loaded Geist font — ✅ FIXED

**File:** `apps/admin/app/globals.css` ~L27  
Hardcoded `font-family: Arial` overrides the Geist font loaded via `next/font/google`.

#### AD-10: No success feedback after provisioning

**File:** `apps/admin/app/(protected)/organisations/new/page.tsx` ~L105  
Silent redirect after form submission — no toast or notification confirming success.

#### AD-11: Missing explicit return types on all exported components/functions

~13 exported functions/components across the admin app lack explicit return types.

### 🔵 Low

#### AD-12: README is boilerplate `create-next-app` content

References `npm run dev` (not pnpm), `localhost:3000` (admin runs on 3003).

#### AD-13: Inconsistent Tailwind colour scale in test page

Uses `gray-*` while all other files use `zinc-*`.

#### AD-14: Default scaffold SVGs in `public/` — ✅ FIXED

`file.svg`, `globe.svg`, `vercel.svg`, `window.svg` — unused.

#### AD-15: `clsx` available but array `.join(" ")` used for conditional classes

**File:** `apps/admin/app/(protected)/organisations/new/page.tsx` ~L60  
Should use `clsx` per project standards.

#### AD-16: Function name uses UK English in code

**File:** `apps/admin/lib/provision-organisation.ts`  
Function `provisionOrganisation` and filename use UK English. Per standards, code should use US English (`provisionOrganization`).

---

## 4. apps/audience

### 🔴 Critical

#### AU-1: Missing workspace dependencies in `package.json` — ✅ FIXED

**File:** `apps/audience/package.json`  
Missing `@brayford/core` and `@brayford/firebase-utils` as dependencies (every other app has them). Works accidentally due to pnpm hoisting — will break in CI or with `--strict-peer-deps`.

#### AU-2: No jitter on any Firestore writes — ✅ FIXED

**Files:** `app/api/audience/join/route.ts`, `app/api/audience/messages/route.ts`  
Neither write path uses `withJitter`. At 5,000 concurrent QR scans, the join route could saturate the server. Per standards: "Jitter is non-negotiable."

#### AU-3: `as any` type assertions without Zod validation — ✅ FIXED

**File:** `apps/audience/components/SceneRenderer.tsx` ~L140

```tsx
return <TextModule config={module.config as any} />;
return <ImageModule config={module.config as any} />;
```

The `messaging` case correctly casts to `MessagingModuleConfig` — these two are inconsistent.

### 🟠 High

#### AU-4: Dead file: `_page copy.tsx` — ✅ FIXED

**File:** `apps/audience/app/events/[eventId]/_page copy.tsx`  
Old version of the event page left behind. Contains stale code.

#### AU-5: `SceneRenderer` uses one-shot fetch instead of real-time subscription

**File:** `apps/audience/components/SceneRenderer.tsx` ~L62  
Fetches scene via `getScene()` not `onSnapshot`. If the creator updates modules within the active scene, audience devices won't see changes until the scene is switched away and back.

#### AU-6: Boilerplate metadata in layout — ✅ FIXED

**File:** `apps/audience/app/layout.tsx` ~L18  
`description: "Generated by create next app"` — visible in browser tabs and search engines.

#### AU-7: `WaitingScreen` has unnecessary `"use client"` directive — ✅ FIXED

**File:** `apps/audience/components/WaitingScreen.tsx`  
No hooks, browser APIs, or interactivity — could be a Server Component.

#### AU-8: `eslint-disable` comments suppressing `react-hooks/exhaustive-deps`

**File:** `apps/audience/app/events/[eventId]/join/[qrCodeId]/page.tsx` ~L111, ~L156  
Suppress legitimate dependency warnings. `handleEventEntry` uses `router` and `params` but isn't in the dependency array — can cause stale closure bugs.

### 🟡 Medium

#### AU-9: No debounce on message submission

No client-side debounce to prevent rapid repeated taps. The `status === "submitting"` guard resets on error, allowing rapid retries.

#### AU-10: No optimistic update for message submission

Waits for server response before showing success. On a slow connection with 5,000 concurrent users, this feels sluggish.

#### AU-11: Brand data fetched without real-time subscription

**File:** `apps/audience/app/events/[eventId]/page.tsx` ~L39  
Brand loaded once with `getBrand()` — creator updates to brand styling mid-event won't be reflected.

#### AU-12: Invalid CSS property `border-opacity` — ✅ FIXED

**File:** `apps/audience/app/globals.css` ~L103

```css
border-opacity: 0.3;
```

Not a valid CSS property. Dead/broken CSS.

#### AU-13: No CSRF protection on API routes

**Files:** `api/audience/join/route.ts`, `api/audience/messages/route.ts`  
No CSRF token validation. Rely on cookies for session management.

### 🔵 Low

#### AU-14: Missing explicit return types on all exported functions

~15 exported functions/components lack explicit return types.

#### AU-15: `clsx` not installed and template literals used for conditional classes

No `clsx` dependency. All conditional classes use template literal interpolation.

#### AU-16: Default scaffold SVGs in `public/` — ✅ FIXED

5 unused SVG files from the Next.js scaffold.

#### AU-17: `next.config.ts` is empty

No configuration for a production app serving 5,000+ users. Consider security headers, `poweredByHeader: false`, etc.

#### AU-18: Raw `<img>` tags instead of `next/image`

Multiple files use `<img>` elements with `eslint-disable` comments. Missing lazy loading, responsive sizing, and WebP optimisation.

---

## 5. apps/creator

### 🔴 Critical

<a id="cr-1"></a>

#### CR-1: `alert()` / `window.confirm()` / `window.prompt()` usage (17 instances) — ✅ FIXED

Project standards explicitly forbid `alert()` style messaging. Found:

| Type               | Count | Locations                                                                                                                                                                    |
| ------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alert()`          | 12    | `onboarding/page.tsx`, `brands/page.tsx`, `brands/[brandId]/page.tsx` (3), `events/page.tsx`, `events/[eventId]/page.tsx` (4), `users/page.tsx`, `scenes/[sceneId]/page.tsx` |
| `window.confirm()` | 3     | `join/page.tsx`, `InviteUserModal.tsx`, `PendingInvitationsList.tsx`                                                                                                         |
| `window.prompt()`  | 2     | `RichTextEditor.tsx` (2)                                                                                                                                                     |

Must replace all with proper dialog/toast components.

### 🟠 High

#### CR-2: Missing `"use client"` directive on `use-firebase-connection.ts` — ✅ FIXED

**File:** `apps/creator/hooks/use-firebase-connection.ts`  
Uses `window`, `navigator`, React hooks, and `onSnapshot` — all client-only APIs — but has no `"use client"` directive. Only works because all consumers are `"use client"` files. Latent bug.

#### CR-3: `any` type usage (4 instances)

| File                              | Context                  |
| --------------------------------- | ------------------------ |
| `join/page.tsx` ~L138             | `(inv: any) => ({...})`  |
| `scenes/new/page.tsx` ~L94        | `modules: any[]`         |
| `events/[eventId]/page.tsx` ~L144 | `e.parentEventId as any` |
| `events/page.tsx` ~L171           | `e.parentEventId as any` |

#### CR-4: Stale closure in `use-firebase-connection.ts`

**File:** `apps/creator/hooks/use-firebase-connection.ts` ~L82  
`onSnapshot` callback references `status` which is not in the `useEffect` dependency array. Could cause reconnection logic to misfire.

#### CR-5: Memory leak in `CropModal.tsx` — ✅ FIXED

**File:** `apps/creator/components/brands/CropModal.tsx` ~L32  
`URL.createObjectURL(imageFile)` called outside `useMemo`/`useEffect` — new object URL created on every re-render without revoking previous ones.

#### CR-6: Oversized single-file components

| File                        | Lines | Issue                                    |
| --------------------------- | ----- | ---------------------------------------- |
| `brands/[brandId]/page.tsx` | 1,418 | 20+ `useState` calls                     |
| `SceneEditor.tsx`           | 1,205 | Editor + sortable items + module configs |
| `events/[eventId]/page.tsx` | 940   | Event detail + QR + child events         |

Should be decomposed into sub-components.

#### CR-7: Missing explicit return types on ~20 exported API route handlers

Most API route `POST`/`GET`/`PUT`/`DELETE` handlers omit `Promise<NextResponse>` return types.

### 🟡 Medium

#### CR-8: Zero `clsx` usage for conditional CSS classes

Standards specify `clsx`. All conditional classes use template literal interpolation instead.

#### CR-9: Zero `dynamic()` imports for lazy loading

Heavy client-only components like `SceneEditor` (1,205 lines, imports `@dnd-kit/*`, `react-colorful`, TipTap), `CropModal` (imports `react-easy-crop`), `MessageModerationView` (imports `@dnd-kit/*`) are all statically imported.

#### CR-10: Zero debouncing before Firebase queries

No debounce utility used anywhere. Search in `ImagePickerDialog` and help search filter on every keystroke.

#### CR-11: Boilerplate metadata in root layout — ✅ FIXED

**File:** `apps/creator/app/layout.tsx` ~L17  
`description: "Generated by create next app"`.

#### CR-12: Duplicate `fromBranded` helper — ✅ FIXED

**File:** `apps/creator/app/dashboard/page.tsx` ~L477  
Locally redefines `fromBranded` despite it being available from `@brayford/core` (and imported elsewhere).

#### CR-13: Unsafe type casts in invitation components

**File:** `apps/creator/components/invitations/InviteUserModal.tsx` ~L109  
`(currentMember.user as { email?: string }).email` — repeated 4 times. Should use typed access.

#### CR-14: `SceneEditor.tsx` — repeated `as` casts for module config

Throughout the file, module configs accessed via `(module.config as { content?: JSONContent }).content`. Should use discriminated unions or type guards.

#### CR-15: `console.warn` TODO in `SceneControlView.tsx` — ✅ FIXED

**File:** `apps/creator/components/studio/SceneControlView.tsx` ~L286  
`console.warn("Module config update not yet implemented:", ...)` — development artefact.

### 🔵 Low

#### CR-16: `SupportModeBanner.tsx` imports `useRouter()` but never uses it — ✅ FIXED

Uses `window.location.href` directly instead.

#### CR-17: Import order not consistently enforced

Some files mix relative and `@brayford/` imports. No automated ESLint ordering rule.

#### CR-18: No Zustand usage found

Standards discuss Zustand selector patterns, but no Zustand store exists anywhere in the creator app. State managed via `useState`, React Hook Form, and custom Firebase hooks.

---

## 6. functions/

### 🔴 Critical

<a id="f-1"></a>

#### F-1: Postmark API key committed in `.env` — ✅ FIXED

**File:** `functions/.env`  
Contains a real Postmark API key. Although the root `.gitignore` excludes `.env`, the `functions/.gitignore` does **not** exclude it. Running `git add functions/` would stage it. The key should be **rotated immediately**.

<a id="f-2"></a>

#### F-2: `triggerBatchEmailProcessing` HTTP endpoint has no authentication — ✅ FIXED

**File:** `functions/src/index.ts` ~L607  
`onRequest` handler callable by anyone on the public internet. Processes up to 50 emails from the queue. No auth check — no API key, no Firebase Auth token, no IP allowlisting. An attacker could repeatedly trigger batch processing, burn Postmark credits, or exhaust rate limits.

### 🟠 High

<a id="f-3"></a>

#### F-3: `strict: false` in tsconfig.json

**File:** `functions/tsconfig.json` ~L10  
Project standards say "Strict mode enabled everywhere." This directory opts out entirely, disabling `strictNullChecks`, `noImplicitAny`, etc.

#### F-4: Non-batched Firestore deletes in `cleanupDeletedOrganizations`

**File:** `functions/src/index.ts` ~L145  
Deletes members, brands, and invitations one document at a time in sequential `for` loops. For 160 documents, that's 160 sequential writes. Should use `WriteBatch` (up to 500 ops per batch).

#### F-5: Non-idempotent email queueing

**File:** `functions/src/index.ts` ~L296  
If the scheduled function is retried after failure, `emailQueue` writes use `.add()` creating new documents each time — could queue duplicate emails.

#### F-6: `processTransactionalEmail` idempotency concern

**File:** `functions/src/index.ts` ~L349  
Function has `retry: true` but no guard checking current status before processing. On retry, an already-sent email could be re-sent.

#### F-7: Missing region on multiple Cloud Functions

Some specify `region: "europe-west2"` but most default to `us-central1`. Creates cross-region latency and inconsistent deployment. Affected: `onMembershipChange`, `cleanupDeletedOrganizations`, `onInvitationCreated`, `onBrandStylingChange`, `onBrandImageReferencesChange`, `onSceneImageReferencesChange`, `onImageUploaded`.

#### F-8: `cleanupDeletedOrganizations` doesn't clean up events

**File:** `functions/src/index.ts` ~L145  
Deletes members, brands, and invitations but not events (or their sub-resources). Event documents become orphaned.

### 🟡 Medium

#### F-9: Unused imports — ✅ FIXED

**Files:** `index.ts` (`OrganizationId`), `claims.ts` (`getPermissionsForRole`)

#### F-10: Multiple exported functions never consumed externally

`buildUserClaims`, `getUserMemberships`, `checkRateLimit`, `incrementRateLimit`, `resetRateLimit`, `testPostmarkConnection` — all exported but never imported.

#### F-11: `target: "es2017"` is very old for Node 24 — ✅ FIXED

**File:** `functions/tsconfig.json` ~L11  
Should be at least `es2022`.

### 🔵 Low

#### F-12: No tests whatsoever

Zero test files for any Cloud Function logic.

#### F-13: Inconsistent quote style

Email module files use single quotes; `index.ts` and `claims.ts` use double quotes.

#### F-14: Commented-out `helloWorld` function — ✅ FIXED

**File:** `functions/src/index.ts` ~L108  
Dead code.

#### F-15: `@brayford/core` in `devDependencies` but used at runtime

**File:** `functions/package.json`  
Misleading — works because esbuild bundles it, but should be documented with a comment.

---

## 7. E2E Tests

### 🟠 High

#### E2E-1: `alert()` tested as production behaviour

**File:** `e2e/tests/dashboard/navigation.spec.ts` ~L55  
Test explicitly validates `alert()` for permission denial — encoding a pattern that should not exist in production code.

#### E2E-2: `clearAllEmulatorData()` in every fixture creates race conditions

**File:** `e2e/fixtures/auth.fixture.ts` ~L48  
With `fullyParallel: true`, simultaneous fixtures can wipe each other's data.

#### E2E-3: `waitForTimeout(1000)` — flaky sleep-based waits — ✅ FIXED

**Files:** `e2e/helpers/auth-helpers.ts` ~L80, `navigation.spec.ts` ~L73  
Hardcoded sleeps — too long (slows tests) and too short (fails on slow CI).

### 🟡 Medium

#### E2E-4: Test name contradicts assertion — ✅ FIXED

**File:** `e2e/tests/auth/signin.spec.ts` ~L56  
Named "authenticated user with org is redirected from /signin to /dashboard" but asserts redirect to `/onboarding`.

#### E2E-5: Unused test helpers and data

Multiple exported helpers and test data constants never referenced: `deleteTestUser()`, `waitForAuthReady()`, `waitForNavigationComplete()`, `seedBrand()`, `TEST_USERS.admin`, `TEST_ORGS.soloCreator`, `TEST_BRANDS` (entire object).

#### E2E-6: `firestore-seed.ts` initialises Firestore at module level without guard — ✅ FIXED

**File:** `e2e/helpers/firestore-seed.ts` ~L12  
`const db = getFirestore()` runs immediately on import. Will throw if `firebase-admin` hasn't been initialised yet.

### 🔵 Low

#### E2E-7: Critical missing E2E coverage

No tests for: event creation/management, audience app, admin app, real-time flows ("submit question → appears on stage view"), error states, form validation failures, brand CRUD.

#### E2E-8: `BasePage.expectPath` doesn't escape regex-special characters — ✅ FIXED

**File:** `e2e/page-objects/base.page.ts` ~L35  
Path with `?` characters would be misinterpreted as regex quantifiers.

---

## 8. Firestore Rules & Configuration

### 🔴 Critical

<a id="r-1"></a>

#### R-1: `events` collection globally readable without authentication — ✅ FIXED

**File:** `firestore.rules` ~L119

```
allow list: if true;
```

Anyone on the internet can query all event metadata (organisation IDs, brand IDs, event names, dates, settings).

<a id="r-2"></a>

#### R-2: Test-rule mismatches — tests assert failure where rules allow success — ✅ FIXED

**File:** `tests/firestore-rules/firestore-rules.test.ts`  
`hasOrgPermission()` checks `'*' in request.auth.token.orgs[orgId].p`, meaning users with `['*']` should pass any permission check. Several tests contradicted this:

- Invitations update: owner fail expected, but `['*']` should succeed via `hasOrgPermission`
- Messages update: user with `['emo']` fail expected, but `['emo']` should succeed
- MessageColumns create/update: owner fail expected, but `['*']` should succeed

**Root cause:** Tests had incorrect assertions — the rules are correct and intentionally allow client-side writes for moderation. Test descriptions and assertions were written assuming a server-side-only architecture, but message moderation and column management use the client SDK.

**Fix:**

- Corrected 4 test assertions from `assertFails` → `assertSucceeds`
- Updated test descriptions to accurately describe the permission checks
- Fixed misleading comments in `firestore.rules` for invitations, messages, and messageColumns
- Verified claims construction: owners get `['*']` (not expanded), wildcard branch in `hasOrgPermission` is correct

### 🟠 High

<a id="r-3"></a>

#### R-3: `audienceSessions` list too permissive

**File:** `firestore.rules` ~L157  
`allow list: if isSignedIn()` lets any authenticated user query audience sessions across all organisations. Leaks attendance data.

#### R-4: `emailQueue` create lacks sender identity validation

**File:** `firestore.rules` ~L170  
Any authenticated user can create email queue entries. No validation that `metadata.userId == request.auth.uid`.

#### R-5: Comments contradict actual write permissions — ✅ FIXED

**File:** `firestore.rules` (multiple locations)  
Multiple collections have comments saying "writes go through server-side API routes" but the rules allow client writes with permissions. Misleading for maintainers.

<a id="r-6"></a>

#### R-6: 9+ missing Firestore composite indexes — ✅ FIXED

**File:** `firestore.indexes.json`  
These queries will fail at runtime without matching indexes:

| Collection         | Fields                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `audienceSessions` | `eventId` + `audienceUUID` + `isActive`                           |
| `audienceSessions` | `eventId` + `isActive`                                            |
| `images`           | `organizationId` + `isActive` + `uploadStatus` + `createdAt` DESC |
| `scenes`           | `eventId` + `createdAt` ASC                                       |
| `scenes`           | `brandId` + `eventId` + `createdAt` ASC                           |
| `scenes`           | `organizationId` + `brandId` + `eventId` + `createdAt` ASC        |
| `scenes`           | `organizationId` + `createdAt` ASC                                |
| `messages`         | `eventId` + `audienceUUID` + `isDeleted` + `submittedAt` range    |
| `messageColumns`   | `eventId` + `isDefault`                                           |

#### R-7: Missing Firestore rules test coverage

7 collections with rules but no tests: `events`, `scenes`, `images`, `qrCodes`, `audienceSessions`, `emailQueue`, `_connection_health`.

### 🟡 Medium

#### R-8: Storage rules lack org membership check on write

**File:** `storage.rules` ~L17  
Only requires `request.auth != null`. Any authenticated user can upload to any organisation's storage path.

#### R-9: Brand header storage allows `image/svg+xml` (XSS risk)

**File:** `storage.rules` ~L19  
Broad `image/.*` pattern allows SVGs (which can contain JavaScript). The org images rule correctly restricts to `jpeg|png|webp|gif`.

#### R-10: Missing `lint` and `type-check` root scripts — ✅ FIXED

**File:** `package.json` (root)  
Copilot instructions reference `pnpm lint` and `pnpm type-check` but neither script exists.

#### R-11: `build` script doesn't build packages first — ✅ FIXED

**File:** `package.json` (root) ~L9  
Only builds apps, not packages. Will fail if apps depend on `@brayford/core` being built first.

#### R-12: Vitest `@` alias only points to creator app — ✅ FIXED

**File:** `vitest.config.ts` ~L7  
`'@': path.resolve(__dirname, './apps/creator')` means tests for admin/audience using `@/` imports resolve incorrectly.

#### R-13: `scenes` collection is publicly readable

**File:** `firestore.rules` ~L131  
`allow read: if true;` defended by "UUID obscurity". Since `events` list is world-readable, the obscurity layer is weak.

### 🔵 Low

#### R-14: `packageManager` vs `engines` mismatch — ✅ FIXED

**File:** `package.json` (root)  
`packageManager: "pnpm@9.0.0"` pins v9 but engines allows `>=8.0.0`.

#### R-15: `docs` listed as a workspace package — ✅ FIXED

**File:** `pnpm-workspace.yaml`  
`docs` is a documentation directory, not a Node.js package.

#### R-16: No Realtime Database emulator configured

**File:** `firebase.json`  
Project overview mentions RTDB for real-time sync but no RTDB emulator is configured.

---

## 9. Documentation

<a id="d-1"></a>

### 🟠 High — Significantly Outdated Documents

#### D-1: `FIRESTORE_RULES_AUDIT.md` — most outdated document

Generated 10 February 2026. Doesn't reflect claims-based rules, doesn't cover 5+ new collections (`scenes`, `messages`, `messageColumns`, `images`, `audienceSessions`, `emailQueue`). Recommended rules don't match implemented approach (full permission strings vs. abbreviations).

#### D-2: `DEVELOPER_STANDARDS.md` — wrong directory names and ghost references

- `apps/stage-view/` → actual: `apps/stage/`
- `apps/platform-admin/` → actual: `apps/admin/`
- `packages/ui/` → does **not exist**
- `docs/API.md` → does **not exist**
- `docs/DEPLOYMENT.md` → does **not exist**

#### D-3: `README.md` — references deleted package, inaccurate auth description

- References `packages/email-utils/` (removed)
- Says "Firebase Auth (anonymous entry)" — not implemented; audience uses localStorage UUID
- Placeholder GitHub URL: `https://github.com/yourusername/project-brayford/...`

#### D-4: `ROADMAP.md` — stale checkboxes and forbidden language

- Multiple completed items still unchecked (Kanban moderation board, admin portal auth)
- "MVP" appears 3 times — forbidden per project standards
- No phases for Image Management or Admin Portal

#### D-5: `SCENE_SYSTEM.md` — heavily outdated brief

- Status says "MVP In Progress - Text Module Complete" — scenes are fully implemented
- All Phase 1-6 checkboxes unchecked — Phases 1-4 are largely complete
- References removed `isTemplate` field
- "MVP" appears 3 times

### 🟡 Medium — Accuracy Issues

#### D-6: `DOMAIN_MODEL.md` — stale numbers and lifecycle

- Says 7 domains (copilot instructions) vs 8 (document lists Asset Management)
- Event lifecycle: doc says `draft → live → archived`; actual schema has `draft | active | live | ended` with `isActive` boolean
- "26 permissions across 5 domains" — actual: 30 permissions across 6 domains

#### D-7: `EMAIL.md` — template alias contradiction

References templates with and without `pb-admin-` prefix in different sections.

#### D-8: `SUPER_ADMIN_SYSTEM.md` — wrong port and stale checkboxes

`NEXT_PUBLIC_ADMIN_APP_URL` example shows `localhost:3001` (audience port) — admin is on 3003. Phase 1 checkboxes all unchecked but features are implemented.

#### D-9: `CHANGELOG.md` — structural issues

- Massive `[Unreleased]` section spanning multiple sprints — should be versioned
- Duplicate `### Added` headers within unreleased section
- Non-standard `### To Do` sections
- Placeholder GitHub URL

#### D-10: `copilot-instructions.md` says "7-domain architecture" — ✅ FIXED

Should be 8 — Asset Management was added.

### 🔵 Low — Missing Documentation

#### D-11: Missing standalone docs

No dedicated documentation for: Image/Asset Management domain, Audience App architecture, Stage App, API route reference, Deployment guide, Claims system end-to-end.

#### D-12: `TESTING_SETUP.md` — wrong completion date

Says "December 2024" — likely should be December 2025.

#### D-13: `E2E_TESTING_PLAYWRIGHT.md` — status not updated

Status says "Approved — ready for implementation" but `e2e/` has been partially implemented.

---

## Positive Observations

Despite the findings above, the codebase demonstrates many strong patterns worth acknowledging:

### Architecture & Design

- **Well-designed domain model** — the Organisation → Brand → Event → Module hierarchy is clean and extensible
- **Comprehensive permission system** — 30 granular permissions with role-based defaults, wildcard support, and claim abbreviations for efficient Firestore rules
- **Proper branded types** — consistent use of `toBranded`/`fromBranded` across the codebase provides genuine type safety for domain IDs

### Firebase Patterns

- **onSnapshot cleanup** — all 6 real-time hooks properly return `unsubscribe` in `useEffect` cleanup. Zero memory leaks in the hook layer.
- **Singleton Firebase init** — correct `getApps().length` guard pattern
- **Zod validation at Firestore boundary** — all reads in `firebase-utils` validate data through `@brayford/core` schemas
- **Batch writes** — `moveMessage`, `softDeleteAndRemoveFromColumn`, `addMessageToColumn` all correctly use `writeBatch`

### Code Quality

- **Thorough JSDoc** — exported functions have comprehensive documentation with parameter descriptions and examples
- **Independent emulator flags** — separate auth vs Firestore emulator flags in `firebase-utils/config.ts` is a smart pattern
- **Well-structured email system** — rate limiting, dev mode, and Postmark integration in the Cloud Functions is solid

### E2E Infrastructure

- **Page Object Model** — proper POM pattern with fixtures, helpers, and typed page objects
- **Firebase emulator integration** — Admin SDK seeding with typed test data constants
- **Well-organised test data** — `as const` assertions on test fixtures with clear naming

### UI & Components

- **Good component decomposition** in most areas — shared components (`FullScreenLoader`, `FullScreenMessage`, `RichTextRenderer`) are properly abstracted
- **UK/US English correctly applied** — user-facing strings use "Organisation" while code uses `Organization`

---

_End of review. This document should be used as a working checklist — items can be marked as resolved as they are addressed._
