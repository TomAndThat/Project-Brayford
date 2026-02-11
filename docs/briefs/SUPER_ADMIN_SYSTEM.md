# Super Admin System Design

**Project Brayford** | Internal Support & Administrative Access  
_Created: February 2026_

---

## Overview

The **Super Admin System** allows Project Brayford staff to access any organization for support, configuration, and monitoring purposes without being formal members of those organizations. Super admins operate through a separate admin application and can seamlessly enter any customer organization in "Support Mode."

---

## Architecture

### Multi-App Design

```
┌─────────────────────────────────────────────────────┐
│                    Admin App                        │
│  - Super admin authentication                       │
│  - Organization browser with search                 │
│  - System-wide analytics & monitoring               │
│  - "Enter Organization" → redirects to creator app  │
└─────────────────────────────────────────────────────┘
                           ↓
                    Redirect with orgId
                           ↓
┌─────────────────────────────────────────────────────┐
│                   Creator App                       │
│  - Detects super admin via custom claims            │
│  - Shows "🛡️ Support Mode" banner                   │
│  - All normal customer features work                │
│  - "Exit Support Mode" → returns to admin app       │
└─────────────────────────────────────────────────────┘
```

**Why this design:**

- Admin app = control tower for browsing all orgs
- Creator app = in-context work with actual customer UI
- Super admins see exactly what customers see (critical for support)
- Security isolation between internal and customer apps

---

## Custom Claims

### Firebase Auth Token Structure

Super admin status is stored as a **custom claim** on the Firebase Auth token:

```typescript
{
  uid: "user123",
  email: "support@projectbrayford.com",
  iss: "https://securetoken.google.com/...",
  // Custom claims:
  superAdmin: true  // ← Only for internal staff
}
```

### Setting Super Admin Claims

Managed via **Cloud Functions** (not public API endpoints):

```typescript
// functions/src/claims.ts
export const setSuperAdmin = functions.https.onCall(async (data, context) => {
  // Only existing super admins can grant this claim
  if (!context.auth?.token.superAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized");
  }

  // Restrict to @projectbrayford.com emails (configurable)
  const targetUser = await admin.auth().getUser(data.userId);
  if (!targetUser.email?.endsWith("@projectbrayford.com")) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Super admin must use @projectbrayford.com email",
    );
  }

  // Set custom claim
  await admin.auth().setCustomUserClaims(data.userId, {
    superAdmin: true,
  });

  // Audit log
  await logAuditEvent({
    type: "superadmin_granted",
    targetUserId: data.userId,
    actorUserId: context.auth.uid,
    timestamp: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
```

**Bootstrap process:**

- First super admin created manually via Firebase Admin SDK script
- Subsequent super admins granted by existing super admins
- All grants are audit logged

---

## Firestore Security Rules

### Super Admin Bypass Pattern

Rules check for `superAdmin` claim **before** normal membership checks:

```javascript
// firestore.rules
function isSuperAdmin() {
  return request.auth.token.superAdmin == true;
}

function isOrgMember(orgId) {
  return exists(/databases/$(database)/documents/organizationMembers/$(orgId + '_' + request.auth.uid));
}

match /organizations/{orgId} {
  // Super admins bypass membership requirement
  allow read: if isSuperAdmin() || isOrgMember(orgId);
  allow write: if isSuperAdmin() || (isOrgMember(orgId) && hasPermission(orgId, 'org:settings:write'));
}

match /organizations/{orgId}/brands/{brandId} {
  allow read: if isSuperAdmin() || isOrgMember(orgId);
  allow write: if isSuperAdmin() || hasRequiredBrandPermission(orgId, brandId);
}

// Pattern repeats for events, members, etc.
```

**Key principle:** Super admins have read/write access to **everything** but don't appear in member lists (they're not in the `organizationMembers` collection).

---

## Admin App Implementation

**Status:** Not yet implemented - requires admin app authentication first

### 1. Authentication System

**Requirements:**

- Separate Firebase Auth flow from creator app
- Email/password or Google Sign-In restricted to `@projectbrayford.com` domain
- Check for `superAdmin` custom claim on login
- Redirect non-super-admins to error page

**Technical approach:**

```typescript
// apps/admin/app/signin/page.tsx
const handleSignIn = async () => {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const tokenResult = await userCredential.user.getIdTokenResult();

  if (!tokenResult.claims.superAdmin) {
    await signOut(auth);
    throw new Error("Access denied: Not a super admin");
  }

  router.push("/admin/organizations");
};
```

### 2. Organization Browser

**Route:** `/admin/organizations`

**Features:**

- **Search bar:** Filter by organization name or domain
- **Table view** with columns:
  - Organization name
  - Primary domain
  - Billing tier (Per-Brand / Flat-Rate)
  - Member count
  - Created date
  - Last activity
  - Status (Active / Soft-Deleted)
- **Filters:**
  - Billing tier dropdown
  - Status dropdown (Active / Deleted / All)
  - Sort by name, created date, last activity
- **Pagination:** 50 orgs per page
- **Actions per row:**
  - "Enter Organization" button → redirect to creator app
  - "View Details" → inline expansion with metadata

**Data fetching:**

```typescript
// Admin app can query all organizations directly
const q = query(
  collection(db, "organizations"),
  where("softDeletedAt", "==", null),
  orderBy("name"),
  limit(50),
);

const orgs = await getDocs(q);
```

**"Enter Organization" action:**

```typescript
function handleEnterOrg(orgId: string) {
  // Redirect to creator app with org context
  window.location.href = `${CREATOR_APP_URL}/org/${orgId}/dashboard`;
}
```

### 3. Additional Admin Features

**Nice-to-haves for future:**

- System-wide analytics dashboard
- User management (grant/revoke super admin status)
- Billing override tools
- Event monitoring (live event count, active users)
- Audit log viewer

---

## Creator App Implementation

**Status:** ✅ Ready to implement now

### 1. Custom Claims Utilities

**File:** `packages/core/src/auth/super-admin.ts`

```typescript
import { User } from "firebase/auth";

/**
 * Check if a user has super admin privileges
 */
export async function isSuperAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;

  const tokenResult = await user.getIdTokenResult();
  return tokenResult.claims.superAdmin === true;
}

/**
 * Get super admin status from token result (for already-fetched tokens)
 */
export function isSuperAdminFromToken(tokenResult: {
  claims: Record<string, unknown>;
}): boolean {
  return tokenResult.claims.superAdmin === true;
}
```

### 2. Support Mode Detection Hook

**File:** `apps/creator/hooks/use-support-mode.ts`

```typescript
import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";
import { isSuperAdmin } from "@brayford/core";

export function useSupportMode() {
  const { user } = useAuth();
  const [isSupportMode, setIsSupportMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsSupportMode(false);
      setLoading(false);
      return;
    }

    isSuperAdmin(user).then((result) => {
      setIsSupportMode(result);
      setLoading(false);
    });
  }, [user]);

  return { isSupportMode, loading };
}
```

### 3. Support Mode Banner Component

**File:** `apps/creator/components/support/SupportModeBanner.tsx`

**Features:**

- Sticky banner at top of screen
- Shows current organization name
- "Exit Support Mode" button → returns to admin app
- Distinctive styling (amber/orange background)
- Non-dismissible (always visible when in support mode)

**Visual design:**

```
┌──────────────────────────────────────────────────────────────┐
│ 🛡️ Support Mode: Acme Podcast Inc.        [Exit Support Mode] │
└──────────────────────────────────────────────────────────────┘
```

### 4. Layout Integration

**File:** `apps/creator/app/dashboard/layout.tsx`

Add banner conditionally above all dashboard content:

```typescript
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isSupportMode } = useSupportMode();

  return (
    <>
      {isSupportMode && <SupportModeBanner />}
      <div className={isSupportMode ? "mt-12" : ""}> {/* Offset for banner */}
        {children}
      </div>
    </>
  );
}
```

### 5. Exit Support Mode Logic

When user clicks "Exit Support Mode":

1. Clear any org context from localStorage
2. Redirect to admin app: `window.location.href = ADMIN_APP_URL`
3. Admin app checks custom claims on load, shows org browser

---

## Security Considerations

### 1. Token Refresh

- Custom claims are part of the ID token
- Tokens cached for 1 hour by Firebase SDK
- Force token refresh: `user.getIdToken(/* forceRefresh */ true)`
- Consider shorter session duration for super admins (30 mins)

### 2. Audit Logging

**All super admin actions should be logged:**

```typescript
// Firestore collection: auditLogs
{
  type: 'superadmin_access',
  actorUserId: 'super_admin_uid',
  actorEmail: 'support@projectbrayford.com',
  organizationId: 'org123',
  organizationName: 'Acme',
  action: 'view_dashboard' | 'update_settings' | 'delete_user' | etc.,
  timestamp: serverTimestamp(),
  metadata: { ... }  // Action-specific details
}
```

**Query for compliance:**

```typescript
// Who accessed this org?
const q = query(
  collection(db, "auditLogs"),
  where("organizationId", "==", orgId),
  where("type", "==", "superadmin_access"),
  orderBy("timestamp", "desc"),
);
```

### 3. MFA Requirement

**Strongly recommended:**

- Require MFA for all super admin accounts
- Configurable via Firebase Auth settings
- Enforce via Cloud Function on claim grant

### 4. Email Domain Restriction

**Configurable whitelist:**

```typescript
// packages/core/src/constants.ts
export const SUPER_ADMIN_DOMAINS = [
  "projectbrayford.com",
  "brayford.io", // If you have multiple domains
];
```

Validate on claim grant and login.

---

## Implementation Phases

### Phase 1: Creator App (Ready Now) ✅

- [ ] Add custom claims utilities to `@brayford/core`
- [ ] Create `useSupportMode()` hook
- [ ] Build `SupportModeBanner` component
- [ ] Integrate banner into dashboard layout
- [ ] Update Firestore rules with `isSuperAdmin()` helpers
- [ ] Add audit logging utility functions

**Outcome:** Creator app is "super admin ready" - will automatically detect and display support mode when admin app redirects super admins.

### Phase 2: Admin App Foundation (Future)

- [ ] Set up admin app authentication
- [ ] Create first super admin via SDK script
- [ ] Implement sign-in page with domain validation
- [ ] Create dashboard shell

### Phase 3: Organization Browser (Future)

- [ ] Build organization list/search UI
- [ ] Add filters and pagination
- [ ] Implement "Enter Organization" navigation
- [ ] Add organization detail views

### Phase 4: Advanced Admin Tools (Future)

- [ ] System analytics dashboard
- [ ] User management (grant/revoke super admin)
- [ ] Audit log viewer
- [ ] Billing overrides

---

## Environment Configuration

### Creator App

```env
# .env.local
NEXT_PUBLIC_ADMIN_APP_URL=https://admin.projectbrayford.com  # Production
# or
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3001  # Local development
```

### Admin App

```env
# .env.local
NEXT_PUBLIC_CREATOR_APP_URL=https://creator.projectbrayford.com  # Production
# or
NEXT_PUBLIC_CREATOR_APP_URL=http://localhost:3000  # Local development
```

---

## Testing Strategy

### Creator App (Can Test Now)

**Manual testing with mocked claims:**

```typescript
// Test by manually setting custom claim via Firebase Console
// Then verify:
// 1. Support banner appears
// 2. Can access any organization
// 3. Exit button redirects correctly
```

**E2E tests:**

```typescript
// e2e/tests/support-mode/banner.spec.ts
test("super admin sees support mode banner", async ({ page }) => {
  // Sign in as super admin (test fixture)
  await signInAsSuperAdmin(page);

  // Navigate to any org
  await page.goto("/org/test-org-id/dashboard");

  // Verify banner
  await expect(
    page.locator('[data-testid="support-mode-banner"]'),
  ).toBeVisible();
  await expect(page.locator("text=/Support Mode:/")).toBeVisible();
});
```

### Admin App (Test When Implemented)

**Manual:** Sign in with super admin account, browse orgs, enter one  
**E2E:** Full flow from admin app → creator app → exit → admin app

---

## Documentation Updates

When implementing, update:

- [DOMAIN_MODEL.md](../DOMAIN_MODEL.md) - Add "Super Admin Access" section
- [PERMISSIONS.md](../PERMISSIONS.md) - Document super admin bypass
- [FIRESTORE_RULES_AUDIT.md](../FIRESTORE_RULES_AUDIT.md) - Add `isSuperAdmin()` pattern
- [DEVELOPER_STANDARDS.md](../DEVELOPER_STANDARDS.md) - Security best practices
- **README.md** - Local development setup for testing super admin mode

---

## Related Files

### Creator App

- `packages/core/src/auth/super-admin.ts` - Utilities
- `apps/creator/hooks/use-support-mode.ts` - Detection hook
- `apps/creator/components/support/SupportModeBanner.tsx` - Banner UI
- `apps/creator/app/dashboard/layout.tsx` - Integration point

### Admin App (Future)

- `apps/admin/app/signin/page.tsx` - Auth flow
- `apps/admin/app/organizations/page.tsx` - Org browser
- `apps/admin/components/OrganizationTable.tsx` - List UI

### Cloud Functions

- `functions/src/claims.ts` - Grant/revoke super admin
- `functions/src/audit-log.ts` - Logging utilities

### Firestore Rules

- `firestore.rules` - Add `isSuperAdmin()` checks

---

## Questions / Decisions

1. **Admin app domain:** Separate subdomain (`admin.projectbrayford.com`) or path-based (`projectbrayford.com/admin`)?
   - **Recommendation:** Separate subdomain for clearer security boundary

2. **Session duration:** Should super admins have shorter sessions (e.g., 30 min)?
   - **Recommendation:** Yes, 30 min with MFA re-prompt

3. **Visibility:** Should organizations know when super admins access them?
   - **Recommendation:** Yes, display "Recently accessed by support" in org settings (audit transparency)

4. **First super admin creation:** Manual SDK script or CLI tool?
   - **Recommendation:** Node.js script in `scripts/create-super-admin.ts` for auditability

---

## Success Criteria

**Creator App (Phase 1):**

- ✅ Support mode banner appears for super admins
- ✅ Super admins can access any organization
- ✅ Exit button returns to admin app
- ✅ No console errors or permission denied messages
- ✅ Firestore rules allow super admin access

**Admin App (Future Phases):**

- ✅ Only super admins can sign into admin app
- ✅ Organization browser loads with search/filter
- ✅ "Enter Organization" redirects to creator app correctly
- ✅ Full round-trip flow works seamlessly

---

## Next Steps

1. **Implement creator app support** (this sprint)
2. **Create first super admin manually** via Firebase Console for testing
3. **Test support mode** with real organization data
4. **Design admin app auth flow** (separate planning session)
5. **Build organization browser mockups** (UX review)
