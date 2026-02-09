# @brayford/firebase-utils

Firebase utilities and helpers for Project Brayford. Provides type-safe Firebase operations with automatic schema validation.

## Setup

### 1. Configure Environment Variables

Each Next.js app needs Firebase configuration in its `.env.local` file:

```bash
# apps/admin/.env.local (repeat for audience, creator, stage)
cp ../../.env.example .env.local
```

Fill in your Firebase project credentials from the [Firebase Console](https://console.firebase.google.com).

### 2. Install Dependencies

```bash
# From monorepo root
pnpm install
```

## Usage

### Authentication (Google OAuth)

```tsx
import {
  signInWithGoogle,
  signOut,
  onAuthChange,
} from "@brayford/firebase-utils/auth";

// Sign in
async function handleSignIn() {
  try {
    await signInWithGoogle();
    router.push("/dashboard");
  } catch (error) {
    console.error("Sign-in failed:", error);
  }
}

// Sign out
async function handleSignOut() {
  await signOut();
  router.push("/");
}

// Listen to auth state changes
useEffect(() => {
  const unsubscribe = onAuthChange((user) => {
    if (user) {
      console.log("Signed in:", user.email);
    } else {
      console.log("Signed out");
    }
  });

  return unsubscribe; // Cleanup
}, []);
```

### Firestore Operations

All Firestore operations are type-safe and include automatic schema validation:

#### Users

```tsx
import { getUser, updateUser, toBranded } from "@brayford/firebase-utils";
import type { UserId } from "@brayford/core";

const userId = toBranded<UserId>("abc123");

// Get user
const user = await getUser(userId);
if (user) {
  console.log(user.displayName);
}

// Update user
await updateUser(userId, {
  displayName: "New Name",
  photoURL: "https://...",
});
```

#### Organizations

```tsx
import {
  createOrganization,
  getOrganization,
  getOrganizationMembers,
  inviteUserToOrganization,
} from "@brayford/firebase-utils";

// Create organization (Flow A: new user creates org)
const orgId = await createOrganization(
  {
    name: "Acme Corp",
    type: "team",
    billingEmail: "billing@acme.com",
    createdBy: fromBranded(userId),
  },
  userId,
);

// Get organization
const org = await getOrganization(orgId);

// Get all members
const members = await getOrganizationMembers(orgId);

// Invite user (Flow B: join existing org)
await inviteUserToOrganization(
  {
    organizationId: fromBranded(orgId),
    userId: fromBranded(newUserId),
    role: "member",
    brandAccess: [fromBranded(brandId)],
  },
  currentUserId,
);
```

#### Brands

```tsx
import {
  createBrand,
  getBrand,
  getOrganizationBrands,
  updateBrand,
} from "@brayford/firebase-utils";

// Create brand
const brandId = await createBrand({
  organizationId: fromBranded(orgId),
  name: "The Podcast",
  logo: "https://...",
  description: "A great show",
});

// Get brand
const brand = await getBrand(brandId);

// Get all brands for organization
const brands = await getOrganizationBrands(orgId);

// Update brand
await updateBrand(brandId, {
  name: "Updated Name",
});
```

### Jitter for Concurrent Writes

**Critical:** Always use jitter for audience-facing write operations to prevent Firestore saturation.

```tsx
import { withJitter } from "@brayford/firebase-utils";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@brayford/firebase-utils";

// Submit question with jitter (spreads writes over 2 seconds)
await withJitter(() => addDoc(collection(db, "questions"), questionData), {
  windowMs: 2000,
});
```

**When to use jitter:**

- Submitting questions in Q&A
- Casting votes
- Sending reactions
- Any audience-initiated write during live events

**When NOT to use jitter:**

- Admin/creator operations (low concurrency)
- Read operations
- One-time setup operations

## Architecture

### Type Safety

All operations use branded types from `@brayford/core` to prevent ID confusion:

```ts
// ❌ Can't accidentally use wrong ID type
const userId: UserId = ...;
const eventId: EventId = ...;
function getEvent(id: EventId) { ... }
getEvent(userId); // TypeScript error!

// ✅ Explicit conversion when needed
await getUser(toBranded<UserId>(rawId));
```

### Schema Validation

All Firestore data is validated with Zod schemas before use:

```ts
// Automatic validation on read
const user = await getUser(userId);
// user is guaranteed to match User schema

// Validation on write
await updateUser(userId, {
  displayName: "Valid Name", // ✅ OK
  email: "cannot-change", // ❌ Schema error: email not updatable
});
```

### Timestamp Conversion

Firestore Timestamps are automatically converted to JavaScript Dates:

```ts
const user = await getUser(userId);
console.log(user.createdAt); // JavaScript Date object
```

## Development

```bash
# Type check
pnpm type-check

# Lint
pnpm lint
```

## Phase 1 Scope

Current implementation includes:

- ✅ Google OAuth authentication
- ✅ User CRUD operations
- ✅ Organization CRUD operations
- ✅ Organization member management
- ✅ Brand CRUD operations
- ✅ Jitter utility

Deferred to later phases:

- ⏳ Email/password authentication
- ⏳ Real-time hooks (`useDocument`, `useCollection`)
- ⏳ Event, Module, Interaction operations
- ⏳ Participant and Analytics operations

See [ROADMAP.md](../../docs/ROADMAP.md) for full implementation plan.
