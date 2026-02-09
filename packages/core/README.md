# @brayford/core

Shared types, schemas, and constants for Project Brayford.

**Single source of truth** for all domain models, validation rules, and type definitions used across the monorepo.

## What's Inside

### Branded Types (`/types/branded.ts`)

Type-safe ID wrappers that prevent accidental misuse of IDs:

```typescript
import { UserId, EventId, toBranded, fromBranded } from '@brayford/core';

const userId: UserId = toBranded<UserId>('abc123');
const eventId: EventId = toBranded<EventId>('xyz789');

function getEvent(id: EventId) { ... }
getEvent(userId); // ❌ TypeScript error: UserId not assignable to EventId
getEvent(eventId); // ✅ OK

// Extract raw string for Firestore queries
const docRef = firestore.collection('users').doc(fromBranded(userId));
```

### Schemas (`/schemas/`)

Zod schemas for runtime validation and TypeScript type inference:

#### User Schema (Identity & Access Domain)

```typescript
import {
  UserSchema,
  CreateUserSchema,
  validateUserData,
  type User,
  type UserDocument,
} from "@brayford/core";

// Validate Firestore data
const userData = validateUserData({
  uid: "firebase-uid",
  email: "user@example.com",
  displayName: "Jane Smith",
  photoURL: "https://...",
  authProvider: "google.com",
  createdAt: new Date(),
  lastLoginAt: new Date(),
});
```

#### Organization Schema (Organization Domain)

```typescript
import {
  OrganizationSchema,
  OrganizationMemberSchema,
  validateCreateOrganizationData,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
} from "@brayford/core";

// Create new organization
const orgData = validateCreateOrganizationData({
  name: "Acme Corp",
  type: "team",
  billingEmail: "billing@acme.com",
  createdBy: userId,
});
```

#### Brand Schema (Organization Domain)

```typescript
import {
  BrandSchema,
  validateCreateBrandData,
  type Brand,
  type BrandDocument,
} from "@brayford/core";

// Create new brand
const brandData = validateCreateBrandData({
  organizationId: orgId,
  name: "Acme Podcast",
  logo: "https://...",
  description: "The best podcast ever",
});
```

## Usage Patterns

### In Firebase Operations

```typescript
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  validateUserData,
  type User,
  type UserId,
  toBranded,
} from "@brayford/core";

// Writing to Firestore
async function createUser(uid: string, userData: User) {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

// Reading from Firestore
async function getUser(uid: string): Promise<User> {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error("User not found");
  }

  // Validate data from Firestore
  return validateUserData({
    ...snapshot.data(),
    createdAt: snapshot.data().createdAt.toDate(),
    lastLoginAt: snapshot.data().lastLoginAt.toDate(),
  });
}
```

### In API Routes

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCreateOrganizationData } from "@brayford/core";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate incoming data
    const orgData = validateCreateOrganizationData(body);

    // Use validated data (fully type-safe)
    // ...

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }
    throw error;
  }
}
```

### In React Components

```typescript
import { useEffect, useState } from 'react';
import { type UserDocument, toBranded, type UserId } from '@brayford/core';

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDocument | null>(null);

  useEffect(() => {
    const typedUserId = toBranded<UserId>(userId);
    // Fetch user with type-safe ID
    fetchUser(typedUserId).then(setUser);
  }, [userId]);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h1>{user.displayName}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

## Adding New Schemas

When implementing new domains (Events, Modules, etc.):

1. Create schema file in `/src/schemas/<domain>.schema.ts`
2. Define Zod schemas with `.describe()` for documentation
3. Export TypeScript types with `z.infer<typeof Schema>`
4. Create validation helpers
5. Add exports to `/src/schemas/index.ts`
6. Add branded types to `/src/types/branded.ts` if needed

## Development

```bash
# Type check
pnpm type-check

# Lint
pnpm lint
```

## Important Notes

- **Always validate Firestore data** with schema parsers before using
- **Always convert Firestore Timestamps** to JavaScript `Date` objects before validation
- **Use branded types** for all domain IDs to prevent type confusion
- **Schemas are the single source of truth** - do not duplicate in docs
