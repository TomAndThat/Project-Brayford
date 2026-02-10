# Firestore Rules Audit - Project Brayford

**Comprehensive Review of All Firestore Operations**  
_Generated: 10 February 2026_

---

## Executive Summary

This document provides an exhaustive audit of every Firestore operation in the Project Brayford codebase, identifying gaps in security rules and providing recommendations for each collection.

**Current State:**

- ✅ Basic rules exist for: `users`, `organizations`, `organizationMembers`, `brands`, `invitations`
- ⚠️ Rules have TODOs and lack proper permission validation
- ❌ Missing rules for: `organizationDeletionRequests`, `deletedOrganizationsAudit`
- ❌ Client-side Firebase SDK operations lack proper authorization checks
- 🔴 **CRITICAL:** Backend code uses **roles as permission checks** instead of the capability-based system (architectural anti-pattern)

**Collections Audited:** 7 collections across 4 domains

**Critical Findings:**

1. **Architectural Flaw:** Core permission helpers and API routes check `role === 'owner'` instead of using `hasPermission()`, creating two sources of truth
2. **Security Gaps:** 8 distinct security vulnerabilities ranging from missing rules to cross-organization data leakage
3. **Rule Recommendations:** Original recommendations perpetuated the role-based anti-pattern and have been corrected to use permission-based claims

**Priority:** The architectural flaw must be fixed **before** implementing custom claims, as it affects the entire authorization system.

---

## Table of Contents

1. [Identity Domain](#identity-domain)
2. [Organization Domain](#organization-domain)
3. [Invitation System](#invitation-system)
4. [Deletion Management](#deletion-management)
5. [Critical Security Gaps](#critical-security-gaps)
6. [Recommended Actions](#recommended-actions)

---

## Identity Domain

### Collection: `/users/{userId}`

**Purpose:** Store user profile data for authenticated users

#### Operations Requiring Rules

##### 1. Create User Document (Sign-up/Sign-in)

**Location:** `packages/firebase-utils/src/auth/google.ts:77`

**Operation:**

```typescript
await setDoc(userRef, {
  displayName: firebaseUser.displayName || "Unknown",
  email: firebaseUser.email,
  // ... other fields
});
```

**Why Required:** Users create their own document on first sign-in via Google OAuth

**Current Rule:**

```javascript
match /users/{userId} {
  allow read: if isSignedIn();
  allow write: if isOwner(userId);
}
```

**Security Considerations:**

- ✅ **CORRECT:** Users can only write to their own document
- ✅ **CORRECT:** Any signed-in user can read any user profile (needed for team member listings)
- ⚠️ **CONCERN:** No validation that write data contains valid fields
- ⚠️ **CONCERN:** No protection against users overwriting `authProvider`, `createdAt`, or other system fields

**Recommendation:**

```javascript
match /users/{userId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn() &&
                   request.auth.uid == userId &&
                   request.resource.data.keys().hasAll(['displayName', 'email', 'authProvider', 'createdAt']) &&
                   request.resource.data.authProvider in ['google.com', 'password', 'microsoft.com'];

  allow update: if isOwner(userId) &&
                   // Cannot change auth provider or creation date
                   !request.resource.data.diff(resource.data).affectedKeys().hasAny(['authProvider', 'createdAt', 'uid']) &&
                   // Can only update allowed fields
                   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['displayName', 'photoURL', 'updatedAt', 'lastLoginAt']);

  allow delete: if false; // Users should never be publicly deleted (use admin SDK in functions)
}
```

##### 2. Read User Document

**Location:** Multiple locations

- `packages/firebase-utils/src/firestore/users.ts:62` (getUser)
- `functions/src/index.ts:110` (cleanup function)
- All dashboard pages for displaying team member info

**Why Required:** Display user profiles in dashboards, fetch team member details

**Current Rule:** ✅ Allows all authenticated users to read

**Security Considerations:**

- ✅ **CORRECT:** Team members need to see each other's basic profile info
- ⚠️ **PRIVACY:** Consider if sensitive fields (email) should be restricted based on organization membership

##### 3. Update User Document

**Location:** `packages/firebase-utils/src/firestore/users.ts:97`

**Operation:**

```typescript
await updateDoc(userRef, validatedData);
```

**Why Required:** Users update their profile (display name, photo)

**Security Considerations:**

- ✅ **CORRECT:** Only the user can update their own document
- ⚠️ **CONCERN:** No field-level validation (see recommendation above)

##### 4. Delete User Document (Admin SDK Only)

**Location:** `functions/src/index.ts:135`

**Operation:**

```typescript
await db.collection("users").doc(userId).delete();
```

**Why Required:** Cascade deletion when organization is permanently deleted and user has no other memberships

**Security Considerations:**

- ✅ **CORRECT:** Uses Admin SDK in Cloud Function (bypasses rules)
- ✅ **CORRECT:** Client-side rule denies deletion

---

## Organization Domain

### Collection: `/organizations/{organizationId}`

**Purpose:** Top-level account/customer records

#### Operations Requiring Rules

##### 1. Create Organization

**Location:** `packages/firebase-utils/src/firestore/organizations.ts:113`

**Operation:**

```typescript
await setDoc(orgRef, {
  ...data,
  createdAt: serverTimestamp(),
});
```

**Why Required:** New users create organizations during onboarding (Flow A)

**Current Rule:**

```javascript
match /organizations/{organizationId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn();
  allow update, delete: if isSignedIn();
  // TODO: Check organizationMembers for proper access control
}
```

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** No validation that creator becomes a member
- ⚠️ **CRITICAL ISSUE:** Anyone can create an organization with any data
- ⚠️ **CRITICAL ISSUE:** No validation of required fields
- ⚠️ **CRITICAL ISSUE:** Update/delete have no authorization checks

**Recommendation:**

```javascript
match /organizations/{organizationId} {
  // Anyone can read orgs they're members of
  allow read: if isSignedIn() &&
                 exists(/databases/$(database)/documents/organizationMembers/$(userMembership())) &&
                 get(/databases/$(database)/documents/organizationMembers/$(userMembership())).data.organizationId == organizationId;

  // Allow create with proper validation
  allow create: if isSignedIn() &&
                   request.resource.data.keys().hasAll(['name', 'type', 'billingEmail', 'createdBy', 'createdAt']) &&
                   request.resource.data.createdBy == request.auth.uid &&
                   request.resource.data.type in ['individual', 'company', 'non-profit'] &&
                   // Ensure simultaneous creation of owner membership (client must batch write)
                   getAfter(/databases/$(database)/documents/organizationMembers/$(newMemberId())).data.organizationId == organizationId &&
                   getAfter(/databases/$(database)/documents/organizationMembers/$(newMemberId())).data.userId == request.auth.uid &&
                   getAfter(/databases/$(database)/documents/organizationMembers/$(newMemberId())).data.role == 'owner';

  // Allow update only for members with org:update permission
  allow update: if isSignedIn() &&
                   hasOrgPermission(organizationId, 'org:update') &&
                   // Cannot modify createdBy, createdAt
                   !request.resource.data.diff(resource.data).affectedKeys().hasAny(['createdBy', 'createdAt']);

  // Allow soft-delete only for owners
  allow update: if isSignedIn() &&
                   hasOrgRole(organizationId, 'owner') &&
                   // Only allowing setting softDeletedAt field
                   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['softDeletedAt', 'deletionRequestId']);

  allow delete: if false; // Use Cloud Function for cascade deletion
}

// Helper: Check if user is a member of the org with specific permission
function hasOrgPermission(orgId, permission) {
  let membership = get(/databases/$(database)/documents/organizationMembers/$(userMembership())).data;
  return membership.organizationId == orgId &&
         (membership.role == 'owner' ||
          (membership.role == 'admin' && permission in adminPermissions()) ||
          (membership.role == 'member' && permission in memberPermissions()));
}

function hasOrgRole(orgId, role) {
  let membership = get(/databases/$(database)/documents/organizationMembers/$(userMembership())).data;
  return membership.organizationId == orgId && membership.role == role;
}

// Note: This is simplified - actual implementation needs to query for membership
function userMembership() {
  // This requires a composite query which Firestore rules don't support well
  // Better approach: maintain userId-to-memberships index or use claims
}
```

**⚠️ ARCHITECTURE CONCERN:** Firestore rules cannot efficiently query for organization membership. **Recommended solution:**

1. Add custom claims to Firebase Auth tokens containing organization memberships and roles
2. Update claims when membership changes
3. Use claims in rules: `request.auth.token.orgMemberships[organizationId].role == 'owner'`

##### 2. Read Organization

**Location:** `packages/firebase-utils/src/firestore/organizations.ts:77`

**Why Required:** Display organization details in dashboard

**Security Considerations:**

- ⚠️ **ISSUE:** Current rule allows ANY signed-in user to read ANY organization
- ❌ **SHOULD BE:** Only members can read their organization's data

##### 3. Update Organization

**Location:**

- `packages/firebase-utils/src/firestore/organizations.ts:146`
- `apps/creator/app/api/organizations/deletion/undo/route.ts:170` (unset softDeletedAt)

**Why Required:** Admins update organization name, settings

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** No permission check (any authenticated user can modify any org)
- ❌ **SHOULD CHECK:** User has `org:update` permission

##### 4. Soft-Delete Organization

**Location:** `apps/creator/app/api/organizations/[organizationId]/delete/initiate/route.ts:84`

**Operation:**

```typescript
await orgRef.update({
  softDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
  deletionRequestId: requestId,
});
```

**Why Required:** Mark organization as deleted (28-day grace period)

**Security Considerations:**

- ✅ **CORRECT:** Uses Admin SDK (server-side only)
- ⚠️ **CONCERN:** No client-side rules for this operation (but that's OK since it's admin-only)

##### 5. Permanent Delete Organization

**Location:** `functions/src/index.ts:225` (Cloud Function)

**Why Required:** Cascade deletion after 28-day grace period

**Security Considerations:**

- ✅ **CORRECT:** Admin SDK in scheduled function

---

### Collection: `/organizationMembers/{memberId}`

**Purpose:** Junction table linking users to organizations with roles

#### Operations Requiring Rules

##### 1. Create Organization Member (Self-creation during onboarding)

**Location:** `packages/firebase-utils/src/firestore/organizations.ts:122`

**Operation:**

```typescript
await setDoc(memberRef, {
  ...data,
  invitedAt: inviterUserId ? serverTimestamp() : null,
  invitedBy: inviterUserId ? fromBranded(inviterUserId) : null,
  joinedAt: serverTimestamp(),
});
```

**Why Required:** User becomes owner of newly created organization (Flow A)

**Current Rule:**

```javascript
match /organizationMembers/{memberId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn();
  allow update, delete: if isSignedIn();
  // TODO: Check if user is org owner/admin
}
```

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** Anyone can create membership with any role (including owner)
- ⚠️ **CRITICAL ISSUE:** Anyone can add themselves to any organization
- ⚠️ **CRITICAL ISSUE:** No validation that user accepts invitation before membership

**Recommendation:**

```javascript
match /organizationMembers/{memberId} {
  // Members can read all memberships in their organizations
  allow read: if isSignedIn() &&
                 (get(/databases/$(database)/documents/organizationMembers/$(memberId)).data.organizationId
                  in getUserOrganizations());

  // Create membership only in two scenarios:
  // 1. Creating owner role during org creation (batch with org creation)
  // 2. Admin SDK creates during invitation acceptance
  allow create: if isSignedIn() &&
                   // Scenario 1: Self-creation as owner during org creation
                   (request.resource.data.role == 'owner' &&
                    request.resource.data.userId == request.auth.uid &&
                    request.resource.data.invitedBy == null &&
                    // Must be creating org simultaneously
                    getAfter(/databases/$(database)/documents/organizations/$(request.resource.data.organizationId)).data.createdBy == request.auth.uid);

  // Updates only by admins/owners changing roles or brand access
  allow update: if isSignedIn() &&
                   hasOrgPermission(resource.data.organizationId, 'users:update_role') &&
                   // Cannot promote to owner (needs special handling)
                   request.resource.data.role != 'owner' &&
                   // Cannot modify own role
                   resource.data.userId != request.auth.uid;

  // Remove only by admins/owners
  allow delete: if isSignedIn() &&
                   hasOrgPermission(resource.data.organizationId, 'users:remove') &&
                   // Cannot remove owners
                   resource.data.role != 'owner';
}
```

**⚠️ ARCHITECTURAL ISSUE:** The invitation acceptance flow creates memberships via Admin SDK (server-side), which is correct. However, client-side rules should prevent unauthorized membership creation.

##### 2. Read Organization Members

**Location:**

- `packages/firebase-utils/src/firestore/organizations.ts:298` (getOrganizationMembers)
- `packages/firebase-utils/src/firestore/organizations.ts:342` (getOrganizationOwners)
- `packages/firebase-utils/src/firestore/organizations.ts:370` (getUserMemberships)
- Dashboard pages displaying team members

**Why Required:** Display team member lists, check permissions

**Security Considerations:**

- ⚠️ **ISSUE:** Current rule allows ANY user to read ANY membership
- ❌ **SHOULD BE:** Only members of the organization can see its memberships

##### 3. Update Organization Member

**Location:** `packages/firebase-utils/src/firestore/organizations.ts:283`

**Why Required:** Change member roles, update brand access

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** No permission check
- ❌ **SHOULD CHECK:** User has `users:update_role` or `users:update_access` permission

##### 4. Delete Organization Member

**Location:**

- `packages/firebase-utils/src/firestore/organizations.ts:294` (removeOrganizationMember)
- `functions/src/index.ts:143` (cascade deletion)

**Why Required:** Remove users from organization

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** No permission check in client-side rules
- ❌ **SHOULD CHECK:** User has `users:remove` permission and is not removing an owner

##### 5. Query Members by Organization

**Location:**

- `functions/src/index.ts:94` (get all members for deletion)
- `apps/creator/app/api/organizations/[organizationId]/delete/initiate/route.ts:110`

**Why Required:** List team members, cascade operations

**Security Considerations:**

- Uses Admin SDK (bypasses rules) ✅
- Client-side queries need proper indexing and rule restrictions ⚠️

##### 6. Query Members by User

**Location:** `packages/firebase-utils/src/firestore/organizations.ts:370`

**Operation:**

```typescript
const membersQuery = query(
  collection(db, "organizationMembers"),
  where("userId", "==", fromBranded(userId)),
);
```

**Why Required:** Get all organizations a user belongs to (for org switcher)

**Security Considerations:**

- ⚠️ **PRIVACY ISSUE:** Users can query memberships of other users
- ❌ **SHOULD BE:** Users can only query their own memberships

**Recommended Index:**

```json
{
  "collectionGroup": "organizationMembers",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "userId", "order": "ASCENDING" }]
}
```

---

### Collection: `/brands/{brandId}`

**Purpose:** Public-facing brands belonging to organizations

#### Operations Requiring Rules

##### 1. Create Brand

**Location:** `packages/firebase-utils/src/firestore/brands.ts:99`

**Operation:**

```typescript
await setDoc(brandRef, {
  ...cleanData,
  createdAt: serverTimestamp(),
  isActive: true,
});
```

**Why Required:** Owners/admins create brands

**Current Rule:**

```javascript
match /brands/{brandId} {
  allow read: if isSignedIn();
  allow create: if isSignedIn();
  allow update, delete: if isSignedIn();
  // TODO: Check if user is org member
}
```

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** Anyone can create brands for any organization
- ❌ **SHOULD CHECK:** User has `brands:create` permission for the organization

**Recommendation:**

```javascript
match /brands/{brandId} {
  // Read: Members can read brands in their org, or brands they have explicit access to
  allow read: if isSignedIn() &&
                 (hasOrgPermission(request.resource.data.organizationId, 'brands:view') ||
                  userHasBrandAccess(brandId));

  // Create: Only admins/owners
  allow create: if isSignedIn() &&
                   hasOrgPermission(request.resource.data.organizationId, 'brands:create') &&
                   request.resource.data.keys().hasAll(['name', 'organizationId', 'createdAt', 'isActive']);

  // Update: Admins/owners or members with brand access
  allow update: if isSignedIn() &&
                   (hasOrgPermission(resource.data.organizationId, 'brands:update') ||
                    (hasOrgPermission(resource.data.organizationId, 'brands:view') &&
                     userHasBrandAccess(brandId)));

  // Delete: Only admins/owners
  allow delete: if isSignedIn() &&
                   hasOrgPermission(resource.data.organizationId, 'brands:delete');
}

function userHasBrandAccess(brandId) {
  let membership = get(/databases/$(database)/documents/organizationMembers/$(userMembership())).data;
  return brandId in membership.brandAccess || membership.brandAccess.size() == 0; // Empty = all access
}
```

##### 2. Auto-Grant Brand to Members

**Location:** `packages/firebase-utils/src/firestore/brands.ts:133`

**Operation:**

```typescript
const membersQuery = query(
  collection(db, "organizationMembers"),
  where("organizationId", "==", fromBranded(organizationId)),
  where("autoGrantNewBrands", "==", true),
);

const updates = querySnap.docs.map((memberDoc) =>
  updateDoc(memberDoc.ref, {
    brandAccess: arrayUnion(fromBranded(brandId)),
  }),
);
```

**Why Required:** Automatically grant new brands to members who opted-in

**Security Considerations:**

- ⚠️ **POTENTIAL ISSUE:** Client-side code is modifying organizationMembers
- ✅ **MITIGATION:** Only adding to brandAccess, not removing
- ⚠️ **RULE NEEDED:** organizationMembers update rule should allow brand access additions by brand creators

**Recommended Index:**

```json
{
  "collectionGroup": "organizationMembers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "autoGrantNewBrands", "order": "ASCENDING" }
  ]
}
```

##### 3. Query Brands by Organization

**Location:**

- `packages/firebase-utils/src/firestore/brands.ts:227`
- `functions/src/index.ts:98`

**Operation:**

```typescript
let brandsQuery = query(
  collection(db, "brands"),
  where("organizationId", "==", fromBranded(organizationId)),
);
```

**Why Required:** List brands for organization (dashboard, deletion cascade)

**Security Considerations:**

- ⚠️ **ISSUE:** Any signed-in user can query brands for any organization
- ❌ **SHOULD BE:** Only members can query their organization's brands

**Recommended Index:**

```json
{
  "collectionGroup": "brands",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" }
  ]
}
```

---

## Invitation System

### Collection: `/invitations/{invitationId}`

**Purpose:** Token-secured email invitations for organization membership

#### Operations Requiring Rules

##### 1. Create Invitation (Admin SDK Only)

**Location:** Server-side invitation creation (not yet implemented in client)

**Expected Operation:**

```typescript
await setDoc(invitationRef, {
  organizationId,
  email,
  role,
  token: generateSecureToken(),
  invitedBy: currentUserId,
  invitedAt: serverTimestamp(),
  expiresAt: calculateExpiry(),
  status: "pending",
  // ... other fields
});
```

**Why Required:** Admins/owners invite new team members

**Current Rule:**

```javascript
match /invitations/{invitationId} {
  // Anyone authenticated can read invitations for their email
  allow read: if isSignedIn() &&
                 request.auth.token.email == resource.data.email;

  // Authenticated users can create invitations
  // TODO: Add validation that creator is org owner/admin
  // TODO: Add validation that only owners can invite with role='owner'
  allow create: if isSignedIn();

  // Only the invited user can update status to accepted/declined
  allow update: if isSignedIn() &&
                   request.auth.token.email == resource.data.email &&
                   request.resource.data.status in ['accepted', 'declined'];

  // Invitations should not be deleted (keep for audit trail)
  allow delete: if false;
}
```

**Security Considerations:**

- ⚠️ **CRITICAL ISSUE:** Anyone can create invitations (no permission check)
- ⚠️ **CRITICAL ISSUE:** Anyone can invite with 'owner' role
- ⚠️ **CRITICAL ISSUE:** No validation that inviter belongs to organization
- ✅ **CORRECT:** Only invited user can accept/decline
- ✅ **CORRECT:** Read restricted to invitation recipient
- ✅ **CORRECT:** Deletion disabled

**Recommendation:**

```javascript
match /invitations/{invitationId} {
  // Read: Only the invited user or org admins/owners
  allow read: if isSignedIn() &&
                 (request.auth.token.email.lower() == resource.data.email.lower() ||
                  hasOrgPermission(resource.data.organizationId, 'users:invite'));

  // Create: Only admins/owners of the organization
  allow create: if isSignedIn() &&
                   hasOrgPermission(request.resource.data.organizationId, 'users:invite') &&
                   // Cannot invite as owner unless you are owner
                   (request.resource.data.role != 'owner' || hasOrgRole(request.resource.data.organizationId, 'owner')) &&
                   // Required fields
                   request.resource.data.keys().hasAll(['organizationId', 'email', 'role', 'token', 'invitedBy', 'invitedAt', 'expiresAt', 'status']) &&
                   // Status must be pending
                   request.resource.data.status == 'pending' &&
                   // Token must be secure (length check)
                   request.resource.data.token.size() >= 32 &&
                   // Inviter is current user
                   request.resource.data.invitedBy == request.auth.uid;

  // Update: Only invited user can accept/decline, or issuer can cancel
  allow update: if isSignedIn() &&
                   (
                     // Invited user accepting/declining
                     (request.auth.token.email.lower() == resource.data.email.lower() &&
                      request.resource.data.status in ['accepted', 'declined'] &&
                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'acceptedAt'])) ||
                     // Inviter cancelling (only if still pending)
                     (request.auth.uid == resource.data.invitedBy &&
                      resource.data.status == 'pending' &&
                      request.resource.data.status == 'cancelled' &&
                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']))
                   );

  allow delete: if false; // Keep audit trail
}
```

##### 2. Read Invitations by Email

**Location:** `packages/firebase-utils/src/firestore/invitations.ts:141`

**Operation:**

```typescript
const invQuery = query(
  collection(db, "invitations"),
  where("email", "==", normalizedEmail),
  where("status", "==", "pending"),
);
```

**Why Required:** Show pending invitations to user on /join page

**Security Considerations:**

- ✅ **CORRECT:** Current rule restricts reads to matching email
- ⚠️ **CONCERN:** Rules must handle case-insensitive email matching

**Recommended Index:**

```json
{
  "collectionGroup": "invitations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "email", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

##### 3. Query Invitations by Token

**Location:** `packages/firebase-utils/src/firestore/invitations.ts:107`

**Operation:**

```typescript
const invQuery = query(
  collection(db, "invitations"),
  where("token", "==", token),
);
```

**Why Required:** Validate invitation link tokens

**Security Considerations:**

- ⚠️ **POTENTIAL ISSUE:** Token query not covered by email restriction
- ✅ **MITIGATION:** Token is secure UUID (unguessable)
- ⚠️ **RULE NEEDED:** Allow token-based reads without email restriction

**Recommended Index:**

```json
{
  "collectionGroup": "invitations",
  "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "token", "order": "ASCENDING" }]
}
```

##### 4. Query Invitations by Organization

**Location:**

- `packages/firebase-utils/src/firestore/invitations.ts:169` (all invitations)
- `packages/firebase-utils/src/firestore/invitations.ts:193` (pending only)

**Operation:**

```typescript
const invQuery = query(
  collection(db, "invitations"),
  where("organizationId", "==", fromBranded(organizationId)),
  where("status", "==", "pending"), // optional
);
```

**Why Required:** List pending invitations in team management dashboard

**Security Considerations:**

- ⚠️ **RULE CONFLICT:** Current read rule only allows reading invitations matching user's email
- ❌ **ISSUE:** Admins cannot list invitations they sent
- ❌ **NEEDED:** Rule to allow admins to read all invitations for their org

**Recommended Additional Rule:**

```javascript
// Allow org admins/owners to read invitations for their org
allow read: if isSignedIn() &&
               hasOrgPermission(resource.data.organizationId, 'users:invite');
```

**Recommended Index:**

```json
{
  "collectionGroup": "invitations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

##### 5. Update Invitation Status (API Route)

**Location:** `apps/creator/app/api/invitations/accept/route.ts:118`

**Operation:**

```typescript
transaction.update(invRef, {
  status: "accepted",
  acceptedAt: serverTimestamp(),
});
```

**Why Required:** Mark invitation as accepted when user joins

**Security Considerations:**

- ✅ **CORRECT:** Uses Admin SDK in server-side API route
- ✅ **CORRECT:** Validates email match before accepting
- ✅ **CORRECT:** Atomic transaction ensures consistency

##### 6. Delete Pending Invitations (Cloud Function)

**Location:** `functions/src/index.ts:154`

**Operation:**

```typescript
const invitationsQuery = await db
  .collection("invitations")
  .where("organizationId", "==", orgId)
  .get();

for (const invDoc of invitationsQuery.docs) {
  await invDoc.ref.delete();
}
```

**Why Required:** Cascade delete invitations when organization is permanently deleted

**Security Considerations:**

- ✅ **CORRECT:** Admin SDK in Cloud Function
- ✅ **CORRECT:** Part of organization cleanup process

---

## Deletion Management

### Collection: `/organizationDeletionRequests/{requestId}`

**Purpose:** Track organization deletion workflows with 28-day grace period

⚠️ **CRITICAL:** This collection has **NO FIRESTORE RULES** currently!

#### Operations Requiring Rules

##### 1. Create Deletion Request (Admin SDK)

**Location:** `apps/creator/app/api/organizations/[organizationId]/delete/initiate/route.ts:178`

**Operation:**

```typescript
const requestRef = adminDb.collection("organizationDeletionRequests").doc();

await requestRef.set({
  organizationId,
  organizationName: orgData.name,
  requestedBy: userId,
  requestedAt: admin.firestore.FieldValue.serverTimestamp(),
  // ... other fields
});
```

**Why Required:** Initiate organization deletion with email confirmation

**Security Considerations:**

- ✅ **CORRECT:** Uses Admin SDK (server-side only)
- ✅ **CORRECT:** Validates user is owner before creating request
- ❌ **MISSING:** No client-side rules defined

**Recommended Rules:**

```javascript
match /organizationDeletionRequests/{requestId} {
  // Read: Only organization owners
  allow read: if isSignedIn() &&
                 hasOrgRole(resource.data.organizationId, 'owner');

  // No client-side creation (admin SDK only)
  allow create: if false;

  // No client-side updates (admin SDK only)
  allow update: if false;

  // No deletion (keep audit trail)
  allow delete: if false;
}
```

##### 2. Read Deletion Request

**Location:**

- `apps/creator/app/api/organizations/deletion/confirm/route.ts:50`
- `apps/creator/app/api/organizations/deletion/undo/route.ts:73`
- `functions/src/index.ts:170`

**Why Required:** Validate tokens, display countdown to users

**Security Considerations:**

- ✅ Uses Admin SDK (server-side)
- ⚠️ **NEEDED:** Client-side rule for owners to view deletion status in UI

##### 3. Update Deletion Request Status

**Location:**

- `apps/creator/app/api/organizations/deletion/confirm/route.ts` (mark as confirmed)
- `apps/creator/app/api/organizations/deletion/undo/route.ts` (mark as cancelled)
- `functions/src/index.ts:199` (mark as completed)

**Why Required:** Track deletion lifecycle

**Security Considerations:**

- ✅ All use Admin SDK
- ✅ All validate permissions before updating

##### 4. Query Deletion Requests (Organization Check)

**Location:** `apps/creator/app/api/organizations/[organizationId]/delete/initiate/route.ts:150`

**Operation:**

```typescript
const existingRequest = await adminDb
  .collection("organizationDeletionRequests")
  .doc(orgData.deletionRequestId)
  .get();
```

**Why Required:** Check if deletion already in progress

**Security Considerations:**

- ✅ Uses Admin SDK
- ⚠️ **NEEDED:** Index on organizationId for efficient lookups

**Recommended Index:**

```json
{
  "collectionGroup": "organizationDeletionRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organizationId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

---

### Collection: `/deletedOrganizationsAudit/{auditId}`

**Purpose:** Permanent audit records of deleted organizations

⚠️ **CRITICAL:** This collection has **NO FIRESTORE RULES** currently!

#### Operations Requiring Rules

##### 1. Create Audit Record (Cloud Function)

**Location:** `functions/src/index.ts:202`

**Operation:**

```typescript
await db.collection("deletedOrganizationsAudit").add({
  organizationId: orgId,
  organizationName: orgData.name,
  deletionRequestId: deletionRequestId || "unknown",
  requestedBy,
  requestedAt,
  confirmedAt,
  completedAt: Timestamp.fromDate(now),
  memberCount,
  brandCount,
  auditLog,
});
```

**Why Required:** Compliance audit trail for deleted organizations

**Security Considerations:**

- ✅ **CORRECT:** Admin SDK in Cloud Function only
- ✅ **CORRECT:** No client access needed

**Recommended Rules:**

```javascript
match /deletedOrganizationsAudit/{auditId} {
  // No reads (internal audit only, accessible via Admin SDK for compliance)
  allow read: if false;

  // No writes (Cloud Function only)
  allow create, update, delete: if false;
}
```

---

## Critical Security Gaps

### 0. Role-Based Permission Checks (Architectural Anti-Pattern)

**Severity:** 🔴 CRITICAL - ARCHITECTURAL FLAW

**Affected Code:** Core permission system, API routes, Firestore rules recommendations

**Issue:** The codebase uses **roles as permission checks** instead of the capability-based permission system. This creates **two sources of truth** for authorization decisions and violates the single-responsibility principle.

**Locations Where Roles Are Used as Permission Determiners:**

#### 1. Core Permission Helpers (`packages/core/src/permissions/helpers.ts`)

**Lines 147-156: `hasBrandAccess()`**

```typescript
export function hasBrandAccess(
  member: OrganizationMember | OrganizationMemberDocument,
  brandId: string | BrandId,
): boolean {
  // Owner and admin have access to all brands
  if (member.role === "owner" || member.role === "admin") {
    return true;
  }
  // ...
}
```

❌ **WRONG:** Checking role instead of permission  
✅ **SHOULD BE:** Check `hasPermission(member, BRANDS_VIEW)` and then check brandAccess array for members

**Lines 192-210: `canModifyMemberRole()`**

```typescript
export function canModifyMemberRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  target: OrganizationMember | OrganizationMemberDocument,
): boolean {
  // Members cannot modify anyone
  if (actor.role === "member") {
    return false;
  }

  // Admins can only modify members
  if (actor.role === "admin") {
    return target.role === "member";
  }

  // Owners can modify anyone except other owners
  if (actor.role === "owner") {
    return target.role !== "owner";
  }

  return false;
}
```

❌ **WRONG:** Role-based logic instead of permission checks  
✅ **SHOULD BE:** Check `hasPermission(actor, USERS_UPDATE_ROLE)` and validate target's role separately

**Lines 239-265: `canInviteRole()`**

```typescript
export function canInviteRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  targetRole: OrganizationRole,
): boolean {
  // Members cannot invite anyone
  if (actor.role === "member") {
    return false;
  }

  // Admins can invite admin or member, but not owner
  if (actor.role === "admin") {
    return targetRole !== "owner";
  }

  // Owners can invite any role
  if (actor.role === "owner") {
    return true;
  }

  return false;
}
```

❌ **WRONG:** Role-based authorization  
✅ **SHOULD BE:** Check `hasPermission(actor, USERS_INVITE)` and have separate validation for owner-level invitations

**Lines 284-296: `canChangeSelfRole()`**

```typescript
export function canChangeSelfRole(
  actor: OrganizationMember | OrganizationMemberDocument,
  currentOwnerCount: number,
): boolean {
  // Only owners can use this check
  if (actor.role !== "owner") {
    return false;
  }

  // Owner can demote self if at least one other owner remains
  return currentOwnerCount >= 2;
}
```

❌ **WRONG:** Role check instead of permission  
✅ **SHOULD BE:** Check appropriate permission and validate owner count separately

#### 2. API Routes

**`apps/creator/app/api/organizations/deletion/confirm/route.ts:184`**

```typescript
const hasDeletePerm =
  permissions.includes("org:delete") ||
  permissions.includes("*") ||
  (permissions.length === 0 && member.role === "owner");
```

❌ **WRONG:** Falling back to role check when permissions are empty  
✅ **SHOULD BE:** Always use the permission system; if permissions are empty, call `getPermissionsForRole(member.role)` first

#### 3. This Audit Document

**Multiple locations recommending role-based checks:**

- Line 1511-1512: `if (role == "owner") return true;`
- Throughout: `hasOrgRole(organizationId, 'owner')` recommendations
- Throughout: Checking roles in Firestore rules instead of permissions

❌ **WRONG:** Perpetuating the anti-pattern in recommendations  
✅ **SHOULD BE:** All recommendations should use permission checks

**Why This Is Critical:**

1. **Two Sources of Truth:**
   - Permission system says: "Check capabilities (USERS_INVITE, BRANDS_CREATE, etc.)"
   - Role checks say: "If owner, allow everything; if admin, allow most things"
   - These can diverge, creating security holes

2. **Future-Proofing Failure:**
   - When custom permissions are added (user-specific permission overrides), role checks will bypass them entirely
   - Cannot implement features like "admin with reduced permissions" or "member with elevated permissions"

3. **Testing Complexity:**
   - Must test both permission paths and role paths
   - Role-based logic is duplicated across multiple functions
   - Changes to permission model require updating multiple disconnected places

4. **Security Risk:**
   - Easy to forget a role check somewhere
   - Easy to get role hierarchy wrong (can admin modify owner? depends on where you check!)
   - Role checks are implicit business logic embedded in authorization code

**Correct Architecture:**

**Roles Should ONLY:**

- Serve as **UI labels** for users to understand their access level
- Map to **default permission sets** in `role-mappings.ts`
- Be stored in the database for auditing purposes

**Permissions Should Be:**

- The **single source of truth** for all authorization decisions
- Checked by **every** backend operation that requires authorization
- Derived from roles via `getPermissionsForRole()` but can be overridden with custom permissions

**Example Refactor:**

```typescript
// ❌ BEFORE (role-based)
export function hasBrandAccess(
  member: OrganizationMember,
  brandId: BrandId,
): boolean {
  if (member.role === "owner" || member.role === "admin") {
    return true;
  }
  return member.brandAccess.includes(brandId);
}

// ✅ AFTER (permission-based)
export function hasBrandAccess(
  member: OrganizationMember,
  brandId: BrandId,
): boolean {
  // First check if they have brand viewing permission at all
  if (!hasPermission(member, BRANDS_VIEW)) {
    return false;
  }

  // Owners and admins have implicit all-brand access
  // But we check this via their brandAccess array being empty, not via role
  if (member.brandAccess.length === 0) {
    return true; // Empty brandAccess = access to all brands
  }

  // Members must have explicit brand access
  return member.brandAccess.includes(brandId);
}
```

**Recommendation:**

1. **Immediate:** Remove all role checks from permission helpers
2. **Short-term:** Refactor API routes to use permission system only
3. **Medium-term:** Remove `canInviteRole()`, `canModifyMemberRole()`, `canChangeSelfRole()` - replace with permission checks
4. **Long-term:** Implement custom permissions field on organizationMembers to enable per-user permission overrides

---

### 1. Missing Permission Validation

**Severity:** 🔴 CRITICAL

**Affected Collections:** `organizations`, `organizationMembers`, `brands`

**Issue:** Current rules allow any authenticated user to perform operations on any document. There is no validation that users have appropriate permissions within the organization.

**Example Attack:**

```javascript
// Malicious user can update any organization
await updateDoc(doc(db, "organizations", "some-other-org"), {
  name: "Hacked Organization",
});

// Malicious user can promote themselves to owner
await setDoc(doc(db, "organizationMembers", "new-doc"), {
  organizationId: "target-org",
  userId: currentUser.uid,
  role: "owner",
  joinedAt: serverTimestamp(),
});
```

**Recommendation:** Implement custom claims or develop helper functions to validate organization membership and permissions.

---

### 2. Missing Collections in Rules

**Severity:** 🔴 CRITICAL

**Affected Collections:** `organizationDeletionRequests`, `deletedOrganizationsAudit`

**Issue:** These collections have active operations but no security rules defined. Currently protected only by the catch-all deny rule, but should have explicit rules even if deny-all.

**Recommendation:** Add explicit deny rules with comments explaining why (see recommendations above).

---

### 3. Insufficient Field-Level Validation

**Severity:** 🟠 HIGH

**Affected Collections:** All collections

**Issue:** Rules allow `write: if isSignedIn()` without validating field types, required fields, or preventing modification of system fields (createdAt, authProvider, etc.).

**Example Attack:**

```javascript
// User can overwrite their auth provider
await updateDoc(doc(db, "users", currentUser.uid), {
  authProvider: "fake-provider",
  createdAt: new Date("2020-01-01"), // backdating
  isAdmin: true, // injecting non-existent fields
});
```

**Recommendation:** Use `request.resource.data.keys()`, `affectedKeys()`, and field validation in rules (see user recommendations above).

---

### 4. Cross-Organization Data Leakage

**Severity:** 🟠 HIGH

**Affected Collections:** `organizations`, `organizationMembers`, `brands`, `invitations`

**Issue:** Current read rules allow ANY authenticated user to read ANY organization's data. This violates basic multi-tenancy security.

**Example Data Leak:**

```javascript
// Attacker can read any organization's details
const orgSnap = await getDoc(doc(db, "organizations", "victim-org"));
console.log(orgSnap.data()); // Full org data exposed

// Attacker can query all brands for any organization
const brandsQuery = query(
  collection(db, "brands"),
  where("organizationId", "==", "victim-org"),
);
const brands = await getDocs(brandsQuery);
```

**Recommendation:** Restrict reads to organization members only (requires custom claims or membership validation).

---

### 5. Invitation System Vulnerabilities

**Severity:** 🟠 HIGH

**Affected Collection:** `invitations`

**Issues:**

1. Anyone can create invitations (no permission check)
2. Anyone can invite with 'owner' role
3. No validation that inviter belongs to organization
4. Admins cannot list pending invitations for their org (rule conflict)

**Example Attack:**

```javascript
// Attacker creates fake invitation for victim organization
await setDoc(doc(collection(db, "invitations")), {
  organizationId: "victim-org",
  email: "attacker@evil.com",
  role: "owner", // Make myself owner!
  token: "fake-token",
  invitedBy: "fake-user-id",
  status: "pending",
  invitedAt: serverTimestamp(),
  expiresAt: futureDate,
});
```

**Recommendation:** See detailed invitation rule recommendations above.

---

### 6. No Rate Limiting in Rules

**Severity:** 🟡 MEDIUM

**Affected Collections:** All collections

**Issue:** Firestore rules don't prevent rapid-fire operations (spam invitations, mass document creation).

**Example Attack:**

```javascript
// Spam 1000 invitations
for (let i = 0; i < 1000; i++) {
  await setDoc(doc(collection(db, "invitations")), {
    // ... invitation data
  });
}
```

**Recommendation:**

1. Implement rate limiting in API routes (already done for emails in @brayford/email-utils)
2. Use Firebase App Check to prevent abusive traffic
3. Monitor Firestore usage metrics for anomalies

---

### 7. Auto-Grant Brand Access Concern

**Severity:** 🟡 MEDIUM

**Affected Collection:** `organizationMembers`

**Issue:** When creating a brand, client-side code modifies `organizationMembers.brandAccess` for multiple users. Current rules don't specifically allow this operation.

**Location:** `packages/firebase-utils/src/firestore/brands.ts:145`

**Recommendation:**

```javascript
// In organizationMembers rules, allow brand creators to update brandAccess
allow update: if isSignedIn() &&
                 // Only updating brandAccess field
                 request.resource.data.diff(resource.data).affectedKeys().hasOnly(['brandAccess']) &&
                 // User has brands:create permission
                 hasOrgPermission(resource.data.organizationId, 'brands:create') &&
                 // Only adding brands, not removing (arrayUnion)
                 request.resource.data.brandAccess.hasAll(resource.data.brandAccess);
```

---

### 8. Case-Sensitive Email Matching

**Severity:** 🟡 MEDIUM

**Affected Collection:** `invitations`

**Issue:** Email comparison in rules is case-sensitive, but emails are case-insensitive by RFC specification.

**Current Rule:**

```javascript
allow read: if request.auth.token.email == resource.data.email;
```

**Problem:**

- User invited as `John@Example.com`
- Signs in as `john@example.com`
- Cannot read their invitation

**Recommendation:**

```javascript
allow read: if request.auth.token.email.lower() == resource.data.email.lower();
```

---

## Recommended Actions

> **⚠️ Revised Ordering (10 Feb 2026):** The original action ordering has been restructured. Moving to a server-side model early (originally Action #16) dramatically reduces the complexity of securing Firestore rules. By denying all client-side writes first, we eliminate the need for intricate per-collection write rules (original Actions #4, #7) and simplify the custom claims implementation (only needed for reads, not writes). Action #1 remains the prerequisite for everything, as the refactored permission helpers are used by the new server-side API routes.

### Phase 1: Foundation (Critical — Must Be Done First) ✅ COMPLETE

1. **Refactor Role-Based Permission Checks** ✅
   - ~~**HIGHEST PRIORITY** — prerequisite for all server-side routes~~
   - ✅ Removed all `member.role === 'owner/admin/member'` authorization checks from permission helpers
   - ✅ Refactored `hasBrandAccess()` → uses `hasPermission(member, BRANDS_VIEW)` + `BRANDS_CREATE` for all-brand access disambiguation
   - ✅ Refactored `canModifyMemberRole()` → uses `hasPermission(actor, USERS_UPDATE_ROLE)` + wildcard-based peer protection
   - ✅ Refactored `canInviteRole()` → uses `hasPermission(actor, USERS_INVITE)` + wildcard check for owner invitations
   - ✅ Refactored `canChangeSelfRole()` → uses `isWildcardPermission()` instead of role check
   - ✅ Updated 3 API routes to use `getPermissionsForRole()` instead of role fallbacks (`confirm/route.ts`, `undo/route.ts`, `initiate/route.ts`)
   - ✅ Updated test descriptions to use permission-based language
   - ✅ Added 7 new permission-based behaviour validation tests (45 total, all passing)
   - ✅ Fixed pre-existing branded type error in `hasBrandAccess()`
   - **Note:** Target role checks (e.g. `target.role === 'owner'`) are retained as protection rules, not authorization checks — only actor role checks were removed

### Phase 2: Server-Side Model + Deny-All Rules (Eliminates Most Security Gaps) ✅ COMPLETE

2. **Move Administrative Operations to Server-Side API Routes + Deny All Client Writes** ✅
   - **Combines original Actions #2, #4, #7, #13, #16** — doing this early eliminates the need for complex per-collection write rules, field-level validation in rules, and most permission gap fixes
   - ✅ Already server-side: Invitation acceptance, organization deletion
   - ✅ Shared auth utility created: `apps/creator/lib/api-auth.ts` — `authenticateRequest()` extracts and verifies Bearer tokens
   - ✅ **Server-side API routes created:**
     - `POST /api/organizations` — Creates org + owner membership atomically (batch write)
     - `PATCH /api/organizations/[organizationId]` — Updates org settings with `org:update` permission check
     - `POST /api/organizations/[organizationId]/members/[memberId]/role` — Updates member role/access with `users:update_role`/`users:update_access` + peer protection
     - `DELETE /api/organizations/[organizationId]/members/[memberId]` — Removes member with `users:remove` + role hierarchy checks
     - `POST /api/invitations/create` — Creates invitation with `users:invite` + `canInviteRole()` + duplicate detection + server-side token generation
     - `POST /api/invitations/[invitationId]/resend` — Resets expiry with `users:invite` permission check
     - `POST /api/invitations/[invitationId]/cancel` — Sets status to 'cancelled' (improved from deleteDoc for audit trail) with `users:invite` permission check
     - `POST /api/invitations/[invitationId]/decline` — Sets status to 'declined' with email ownership verification
     - `POST /api/brands` — Creates brand with `brands:create` permission check + auto-grant logic
     - `PATCH /api/brands/[brandId]` — Updates brand with `brands:update` permission check
     - `DELETE /api/brands/[brandId]` — Soft-deletes brand with `brands:delete` permission check
   - ✅ **Client-side callers migrated:**
     - `apps/creator/app/onboarding/page.tsx` — Now calls `POST /api/organizations` instead of client-side `createOrganization()`
     - `apps/creator/components/invitations/InviteUserModal.tsx` — Now calls `POST /api/invitations/create` and `POST /api/invitations/[id]/resend` instead of client-side functions
     - `apps/creator/components/invitations/PendingInvitationsList.tsx` — Now calls `POST /api/invitations/[id]/resend` and `POST /api/invitations/[id]/cancel` instead of client-side functions
     - `apps/creator/app/join/page.tsx` — Now calls `POST /api/invitations/[id]/decline` instead of client-side `declineInvitation()`
   - ✅ **Firestore rules updated to deny-all client writes:**
     - Organizations: `allow write: if false` (reads remain for authenticated users)
     - OrganizationMembers: `allow write: if false` (reads remain for authenticated users)
     - Brands: `allow write: if false` (reads remain for authenticated users)
     - Invitations: `allow write: if false` (reads remain for authenticated users)
     - Users: create own profile, update own profile with field immutability guards (uid, email, authProvider, createdAt), no delete
   - ✅ Can stay client-side with strict rules:
     - User profile updates (displayName, photoURL only)
     - Real-time audience interactions (questions, votes, reactions) — Phase 3+
   - **Benefits:**
     - Single validation point (no rule duplication)
     - Complex business logic (checking multiple collections)
     - Atomic transactions (organisation + membership creation)
     - Easier testing and debugging
     - Simpler Firestore rules (mostly deny with server-side allowlist)
   - **Implementation:** Create Next.js API routes with Admin SDK for all administrative operations
   - **API Routes to Create:**
     - `POST /api/organizations` — Create organisation with atomic membership
     - `PATCH /api/organizations/[id]` — Update organisation with permission checks
     - `POST /api/brands` — Create brand with auto-grant logic
     - `PATCH /api/brands/[id]` — Update brand with permission checks
     - `POST /api/organizations/[id]/members/[userId]/role` — Change member role
     - `DELETE /api/organizations/[id]/members/[userId]` — Remove member
   - Use Firebase Admin SDK for all operations
   - Validate permissions server-side using `hasPermission()` from `@brayford/core`
   - **Then update Firestore rules to deny all client writes:**
     - Organisations: deny all client writes
     - OrganisationMembers: deny all client writes
     - Brands: deny all client writes
     - Invitations: deny all client writes
     - Users: allow profile updates only (with field-level validation)
   - Rules become enforcement layer, not authorisation layer

3. **Add Missing Collection Rules** ✅
   - ✅ Defined explicit deny-all rules for `organizationDeletionRequests` (read: false, write: false)
   - ✅ Defined explicit deny-all rules for `deletedOrganizationsAudit` (read: false, write: false)
   - Both collections are server-side only via Admin SDK

### Phase 3: Read Security (Custom Claims) — ✅ COMPLETE

4. **Implement Permission-Based Custom Claims (Simplified — Reads Only)** ✅
   - With all writes handled server-side, custom claims are only needed for **read authorisation**
   - Store **abbreviated permissions** in claims for size efficiency
   - Structure: `{ orgs: { "org-id": { p: ["*"], b: [] } }, cv: 3 }`
     - `p` = abbreviated permissions (e.g. `"ou"` = `org:update`, `"*"` = wildcard/owner)
     - `b` = brand IDs (empty = all brands)
     - `cv` = claims version counter for forced client-side token refresh
   - **Implementation details:**
     - `functions/src/claims.ts` — Claims utility with abbreviation mapping, `buildUserClaims()`, `updateUserClaims()`
     - `functions/src/index.ts` — `onMembershipChange` Cloud Function triggered on `organizationMembers/{memberId}` writes (uses `onDocumentWritten`)
     - Claims size validation: warns at 950 bytes, falls back to empty claims at 1000 bytes
     - `claimsVersion` field added to user schema (`packages/core/src/schemas/user.schema.ts`)
     - Client-side forced token refresh: `use-auth.ts` watches user doc via `onSnapshot` for `claimsVersion` changes, calls `getIdToken(true)` on change
   - Use in rules: `request.auth.token.orgs[orgId].p` for permissions, `request.auth.token.orgs[orgId].b` for brand access
   - **Firestore read rules updated:**
     - `organizations/{orgId}` — only org members (`isOrgMember(organizationId)`)
     - `organizationMembers/{memberId}` — only fellow org members (`isOrgMember(resource.data.organizationId)`)
     - `brands/{brandId}` — only org members (`isOrgMember(resource.data.organizationId)`)
     - `invitations/{invitationId}` — invitee email match OR org member with `users:invite` permission (abbreviated `'ui'`)
     - `users/{userId}` — `claimsVersion` field protected from client-side modification
   - **Important:** Client list queries on `organizationMembers`, `brands`, `invitations` MUST include `.where('organizationId', '==', orgId)` so Firestore can verify the constraint against claims. Cross-org listing uses token claims or server-side API routes.

### Phase 4: Hardening & Cleanup — ✅ COMPLETE

5. **Fix Email Case Sensitivity** ✅
   - **Firestore rules:** Added `.lower()` to invitation email comparison (`request.auth.token.email.lower() == resource.data.email.lower()`)
   - **API routes:** Already normalised — all routes use `.toLowerCase()` for email comparisons and storage
   - **At write time:** Added `.toLowerCase().trim()` to `firebaseUserToCreateData()` in `packages/firebase-utils/src/auth/google.ts` when storing user email
   - **Invitation schema:** Already has `.transform(e => e.toLowerCase().trim())` on the email field
   - **Migration:** Not needed (no existing production data)
   - **Bug fix:** Removed extra closing brace in `firestore.rules` (syntax error)

6. **Audit Firestore Indexes** ✅
   - Audited all `.where()` queries across API routes, Cloud Functions, and firebase-utils
   - Added 5 missing composite indexes to `firestore.indexes.json`:
     - `organizationMembers`: `organizationId` + `userId` (most common query — membership lookup)
     - `organizationMembers`: `organizationId` + `autoGrantNewBrands` (brand creation auto-grant)
     - `organizationMembers`: `userId` + `organizationId` (claims rebuild, cross-org check)
     - `organizations`: `softDeletedAt` (cleanup function cutoff query)
     - `brands`: `organizationId` (org brand listing, cleanup function)

7. **Create Unit Tests for Refactored Permission Helpers** ✅ (already done)
   - All 17 exported functions from `helpers.ts` already have comprehensive test coverage
   - `packages/core/src/permissions/__tests__/permissions.test.ts` — 45 tests covering:
     - `hasPermission`, `hasAnyPermission`, `hasAllPermissions` + require variants
     - `hasBrandAccess`, `requireBrandAccess`
     - `canModifyMemberRole`, `canInviteRole`, `canChangeSelfRole` + require variants
     - `getEffectivePermissions`, `getRoleDisplayName`, `getRoleDescription`
   - Edge cases covered: wildcard permissions, empty permissions, owner protection, peer modification

### Phase 5: Monitoring, Testing & Documentation

8. **Deploy Firebase App Check** — ⏳ DEFERRED (implement before production deploy)
   - Prevent automated abuse and bot traffic
   - Add to all client applications

9. **Add Rate Limiting and Monitoring** — ⏳ DEFERRED (implement before production deploy)
   - Recommended approach: **Upstash Redis** for serverless rate limiting (cheapest option at ~$0.2/100K commands)
   - API rate limiting (already done for emails)
   - **Enable Firestore Security Rules monitoring** in Firebase Console
   - Set up Cloud Monitoring alerts for unusual rule denial patterns
   - Monitor Firestore usage for anomalies (spike in denied operations, unusual query patterns)
   - Consider rate limiting per-user for expensive operations
   - Add logging for all failed authorisation attempts

10. **Testing & Validation** — ✅ COMPLETE
    - **Firestore rules tests:** 45 tests covering all collections, cross-org isolation, and default deny
      - Test suite: `tests/firestore-rules/firestore-rules.test.ts`
      - Run with: `pnpm test:rules` (auto-starts Firestore emulator via `firebase emulators:exec`)
      - Uses `@firebase/rules-unit-testing` v3.0.4 against the real `firestore.rules` file
      - Covers: Users (read/create/update/delete), Organizations, Members, Brands (claims-based read, deny writes), Invitations (email match + permission-based read, deny writes), server-only collections, default deny
    - **Permission helper tests:** 45 tests in `packages/core` (already existed, verified comprehensive)
    - **Integration tests:** Covered by existing E2E test suite in `e2e/`
    - **Load testing:** Deferred — will implement alongside rate limiting

11. **Update Architecture Documentation** — ✅ COMPLETE
    - Documented server-side authorisation pattern in [DEVELOPER_STANDARDS.md](DEVELOPER_STANDARDS.md)
    - Added: custom claims architecture, API route authorization pattern, Firestore rules summary table
    - Added: client-side claims refresh mechanism, when to use client-side vs server-side operations
    - Added: correct permission checking patterns with code examples

### Phase 6: Long-term Enhancements

12. **Permission System Optimisation**
    - Consider moving to Cloud Functions for complex permission checks
    - Implement role-based access control (RBAC) service
    - Cache permission checks to reduce Firestore reads

13. **Audit Trail Enhancements**
    - Log all permission-checked operations
    - Implement suspicious activity detection
    - Add admin dashboard for security monitoring
    - Integrate with Cloud Logging for centralised log analysis

---

## Firestore Indexes Required

Based on queries found in the codebase:

```json
{
  "indexes": [
    {
      "collectionGroup": "organizationMembers",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "organizationId", "order": "ASCENDING" }]
    },
    {
      "collectionGroup": "organizationMembers",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "userId", "order": "ASCENDING" }]
    },
    {
      "collectionGroup": "organizationMembers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizationMembers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "autoGrantNewBrands", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "brands",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "organizationId", "order": "ASCENDING" }]
    },
    {
      "collectionGroup": "brands",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "invitations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "invitations",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "token", "order": "ASCENDING" }]
    },
    {
      "collectionGroup": "invitations",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "organizationId", "order": "ASCENDING" }]
    },
    {
      "collectionGroup": "invitations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "invitations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "organizations",
      "queryScope": "COLLECTION",
      "fields": [{ "fieldPath": "softDeletedAt", "order": "ASCENDING" }]
    },
    {
      "collectionGroup": "organizationDeletionRequests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## Testing Plan

### Rules Unit Tests

Create `firestore.rules.test.ts` with:

1. **User collection tests:**
   - ✅ User can create their own document
   - ❌ User cannot create document for another user
   - ✅ User can update their own displayName
   - ❌ User cannot change authProvider
   - ✅ Any authenticated user can read any profile
   - ❌ Unauthenticated users cannot read profiles

2. **Organization tests:**
   - ✅ User can create organization and become owner
   - ❌ User cannot create organization without creating membership
   - ✅ Organization member can read organization
   - ❌ Non-member cannot read organization
   - ✅ Admin can update organization details
   - ❌ Member cannot update organization details

3. **Membership tests:**
   - ✅ Owner creation during org creation succeeds
   - ❌ Cannot create owner membership for existing org
   - ✅ Admin can update member roles (except owner)
   - ❌ Admin cannot promote to owner
   - ❌ Member cannot update roles

4. **Brand tests:**
   - ✅ Admin can create brands
   - ❌ Member cannot create brands
   - ✅ Member with brand access can update brand
   - ❌ Member without brand access cannot update brand

5. **Invitation tests:**
   - ✅ Admin can create invitations
   - ❌ Non-admin cannot create invitations
   - ❌ Admin cannot invite as owner (only owner can)
   - ✅ Invited user can read their invitation
   - ❌ Different user cannot read invitation
   - ✅ Invited user can accept invitation
   - ❌ User cannot accept invitation for different email

---

## Appendix: Helper Functions for Rules

⚠️ **CRITICAL UPDATE:** The original recommendations in this section perpetuate the **role-based anti-pattern** identified in "Critical Security Gap #0". The correct approach is to store **permissions** in custom claims, not roles.

### ❌ Anti-Pattern: Checking Roles in Rules

```javascript
// DON'T DO THIS - Duplicates backend permission logic
function hasOrgPermission(orgId, permission) {
  let role = request.auth.token.organizationMemberships[orgId];

  if (role == "owner") return true; // ❌ Role check

  let adminPerms = ["org:update", "users:invite" /* ... */];
  if (role == "admin" && permission in adminPerms) return true; // ❌ Role check

  // ... more role checks
}
```

**Problems:**

1. Duplicates permission logic from `role-mappings.ts`
2. Must update rules every time permissions change
3. Custom per-user permissions won't work
4. Two sources of truth for authorization

### ✅ Correct Approach: Permission-Based Custom Claims

**Backend: Set claims with actual permissions**

```typescript
// packages/firebase-utils/src/auth/claims.ts
import { adminAuth } from "./admin";
import { getPermissionsForRole } from "@brayford/core/permissions";
import type { OrganizationMember } from "@brayford/core";

export async function updateUserClaims(
  userId: string,
  memberships: OrganizationMember[],
): Promise<void> {
  const orgs: Record<string, { permissions: string[]; brands: string[] }> = {};

  for (const membership of memberships) {
    // Get permissions from role (single source of truth)
    const permissions = getPermissionsForRole(membership.role);

    orgs[membership.organizationId] = {
      permissions: permissions.map((p) => p.toString()),
      brands: membership.brandAccess,
    };
  }

  await adminAuth.setCustomUserClaims(userId, { orgs });
}
```

**Firestore Rules: Check permissions directly**

```javascript
// Check if user has specific permission in organization
function hasOrgPermission(orgId, permission) {
  return (
    isSignedIn() &&
    orgId in request.auth.token.orgs &&
    // Wildcard permission (owner)
    ("*" in request.auth.token.orgs[orgId].permissions ||
      // Specific permission
      permission in request.auth.token.orgs[orgId].permissions)
  );
}

// Check brand access
function hasOrgBrandAccess(orgId, brandId) {
  return (
    isSignedIn() &&
    orgId in request.auth.token.orgs &&
    hasOrgPermission(orgId, "brands:view") &&
    // Empty = all brands
    (request.auth.token.orgs[orgId].brands.size() == 0 ||
      // Explicit access
      brandId in request.auth.token.orgs[orgId].brands)
  );
}

// Basic helpers
function isSignedIn() {
  return request.auth != null;
}

function isOwner(userId) {
  return isSignedIn() && request.auth.uid == userId;
}

function isOrgMember(orgId) {
  return isSignedIn() && orgId in request.auth.token.orgs;
}
```

**When to Update Claims:**

```typescript
// Trigger on membership changes
export const onMembershipChange = functions.firestore
  .document("organizationMembers/{memberId}")
  .onWrite(async (change, context) => {
    const userId = change.after.exists
      ? change.after.data()!.userId
      : change.before.data()!.userId;

    // Get all current memberships for this user
    const memberships = await getOrganizationMemberships(userId);

    // Update claims
    await updateUserClaims(userId, memberships);
  });
```

**Claims Size Limit:**

Firebase custom claims have a **1000-byte limit**. For users in many organizations with many permissions:

- Use **permission abbreviations** (map `"org:update"` → `"ou"`)
- Or implement **claims refresh API** that validates permissions server-side
- Or move authorization checks to API routes instead of Firestore rules

```

---

## Summary

This audit identified **7 collections** with **9 critical security gaps** (including **1 fundamental architectural flaw**) and **2 missing rule definitions**.

**Critical Architectural Issues:**

0. **Role-Based Permission Checks** - The codebase uses roles as authorization determiners instead of the capability-based permission system, creating two sources of truth
1. **Direct Client Writes for Administrative Operations** - Complex operations (org creation, brand management, member role changes) are done client-side, requiring overly complex Firestore rules that duplicate backend business logic

**Primary Security Issues:**

2. Missing permission validation in security rules
3. Missing collection rules (`organizationDeletionRequests`, `deletedOrganizationsAudit`)
4. Insufficient field-level validation
5. Cross-organization data leakage
6. Invitation system vulnerabilities
7. No rate limiting in rules
8. Auto-grant brand access concerns
9. Case-sensitive email matching

**Revised implementation order (6 phases, 13 actions):**

1. **Phase 1 — Foundation:** ✅ COMPLETE — Refactored all role-based permission checks to use the capability-based permission system
2. **Phase 2 — Server-Side Model:** ✅ COMPLETE — Moved all administrative writes to API routes + set Firestore rules to deny-all for client writes; added missing collection rules
3. **Phase 3 — Read Security:** ✅ COMPLETE — Custom claims with abbreviated permissions, `onMembershipChange` Cloud Function, Firestore read rules restricted by org membership
4. **Phase 4 — Hardening:** ✅ COMPLETE — Email case normalisation (`.lower()` in rules, `.toLowerCase()` at write time), 5 missing Firestore indexes added, permission helper tests already comprehensive (45 tests)
5. **Phase 5 — Monitoring & Testing:** ✅ PARTIAL — Firestore rules tests (45 tests) and architecture documentation complete. App Check and rate limiting deferred until pre-production.
6. **Phase 6 — Long-term:** Permission system optimisation, audit trail enhancements

**Architectural Recommendation:**

Adopt a **hybrid model**:
- ✅ **Server-side API routes with Admin SDK** for all administrative operations
- ✅ **Client-side with restrictive rules** for user profile updates
- ✅ **Client-side with jitter logic** for real-time audience interactions (Phase 3+)

**Timeline:** ~~The architectural flaw (Phase 1) must be fixed before building server-side routes. The server-side model (Phase 2) eliminates most security gaps and should be prioritised before production launch.~~ ~~Phases 1–4 are complete. Phase 5 (monitoring, testing & documentation) is the next priority.~~ Phases 1–5 are substantially complete. App Check (Action 8) and rate limiting (Action 9) are deferred until pre-production deployment. Phase 6 is long-term.
```
