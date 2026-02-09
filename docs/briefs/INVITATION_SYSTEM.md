# Invitation System - User Onboarding Flow B

**Project Brayford** | Organization Invitation & Multi-Org Membership  
_Created: February 9, 2026_

---

## Overview

Implement a complete invitation system allowing organization owners/admins to invite users to join their organization. This is "Flow B" of user onboarding, complementing the existing "Flow A" where users create their own organization.

### Key Requirements

- **Multi-organization support**: Users can be members of multiple organizations simultaneously
- **Pre-configured access**: Invitations specify role and brand access before user accepts
- **Flexible authentication**: Support multiple sign-in methods (currently Google OAuth, future-proofed for email/password, etc.)
- **Batch invitation handling**: If user has multiple pending invitations, they can accept all at once
- **Auto-grant new brands**: Optional flag to automatically grant access to future brands
- **Secure tokens**: Invitation links expire after 7 days
- **Email integration**: Leverage existing `@brayford/email-utils` package

---

## Data Model

### Invitations Collection

**Collection:** `/invitations/{invitationId}`

```typescript
interface Invitation {
  id: InvitationId; // Branded type
  email: string; // Target user's email (normalized lowercase)
  organizationId: OrganizationId; // Organization extending invitation
  organizationName: string; // Denormalized for email templates
  role: OrganizationRole; // 'admin' | 'member' (never 'owner')
  brandAccess: BrandId[]; // Brands user will have access to
  autoGrantNewBrands: boolean; // Auto-grant access to future brands
  invitedBy: UserId; // Who sent the invitation
  invitedAt: Timestamp; // When invitation was created
  status: "pending" | "accepted" | "declined" | "expired";
  token: string; // Secure UUID for email link
  expiresAt: Timestamp; // 7 days from invitedAt
  acceptedAt?: Timestamp | null; // When user accepted (if applicable)
  metadata?: {
    inviterName?: string; // Denormalized for UX
    inviterEmail?: string;
  };
}
```

**Indexes Required:**

- `email` (for querying all invitations for a user)
- `token` (for link validation)
- `organizationId` (for org admin to see pending invitations)
- Composite: `email + status` (efficient pending query)

**Security Rules:**

```javascript
match /invitations/{invitationId} {
  // Anyone with valid token can read their own invitation
  allow read: if request.auth != null
    && request.auth.token.email == resource.data.email;

  // Only org admins/owners can create invitations
  allow create: if request.auth != null
    && hasPermission(request.auth.uid, resource.data.organizationId, 'users:invite');

  // Only the invited user can update status to accepted/declined
  allow update: if request.auth != null
    && request.auth.token.email == resource.data.email
    && request.resource.data.status in ['accepted', 'declined'];
}
```

### OrganizationMember Schema Updates

**Add new field:**

```typescript
interface OrganizationMember {
  // ... existing fields
  autoGrantNewBrands: boolean; // Default: false for members, true for owner/admin
}
```

**Migration Strategy:**

- Add field as optional in schema
- Default to `false` for existing members
- Set to `true` for all owners/admins during brand creation logic

---

## User Flows

### Flow 1: Send Invitation

**Actor:** Organization owner or admin  
**Entry Point:** `/dashboard/users` → "Invite User" button

**Steps:**

1. **User clicks "Invite User"**
   - Modal opens with invitation form

2. **User fills invitation form:**
   - **Email address** (required, validated)
   - **Role selection** (Admin or Member)
   - **Brand access** (if Member role):
     - Checkbox list of all organization brands
     - "Select all" / "Deselect all" helpers
     - **Toggle:** "Automatically grant access to new brands"
   - Submit button: "Send Invitation"

3. **Validation:**
   - Check email format
   - Check if user already a member of this organization (show error)
   - Check if pending invitation already exists (show option to resend)
   - Verify actor has `users:invite` permission

4. **Create invitation document:**

   ```typescript
   const invitation = await createInvitation({
     email: normalizeEmail(email),
     organizationId,
     organizationName,
     role,
     brandAccess: role === "admin" ? [] : selectedBrands,
     autoGrantNewBrands: role === "admin" ? true : autoGrantToggle,
     invitedBy: currentUserId,
     token: generateSecureToken(),
     expiresAt: addDays(new Date(), 7),
     status: "pending",
   });
   ```

5. **Send invitation email:**

   ```typescript
   await sendInvitationEmail({
     to: email,
     inviterName: currentUser.displayName,
     organizationName,
     role,
     invitationUrl: `${APP_URL}/join?token=${invitation.token}`,
     expiresAt: invitation.expiresAt,
   });
   ```

6. **Show success message:**
   - "Invitation sent to {email}"
   - Modal closes
   - User list refreshes (pending invitation appears with "Pending" badge)

**Edge Cases:**

- Email already registered and in org → Show error: "User already a member"
- Pending invitation exists → Show: "Resend invitation?" button
- No brands in organization → Disable member role, show info message
- Actor loses `users:invite` permission mid-flow → API rejects with 403

---

### Flow 2: Accept Invitation (New User)

**Actor:** New user receiving invitation email  
**Entry Point:** Email link `https://app.brayford.com/join?token=abc123`

**Steps:**

1. **User clicks invitation link**
   - Redirected to `/join?token=abc123`
   - Page validates token server-side

2. **Token validation:**

   ```typescript
   const invitation = await getInvitationByToken(token);

   if (!invitation) {
     return <ErrorPage message="Invalid invitation link" />;
   }

   if (invitation.status !== 'pending') {
     return <ErrorPage message="This invitation has already been used" />;
   }

   if (invitation.expiresAt < new Date()) {
     return <ErrorPage message="This invitation has expired" />;
   }
   ```

3. **Display invitation details:**
   - Organization name
   - Role being offered
   - Who invited them
   - "You've been invited to join {Organization} as a {Role}"

4. **Check for additional pending invitations:**

   ```typescript
   const allInvitations = await getPendingInvitationsByEmail(invitation.email);
   ```

5. **If multiple invitations:**
   - Show list of all organizations inviting them
   - Checkboxes to select which to accept (all selected by default)
   - "You have {count} pending invitations"

6. **Authentication prompt:**
   - "Sign in to accept your invitation"
   - Email field pre-filled and locked (read-only)
   - Sign-in method buttons (currently: "Sign in with Google")
   - Future: "Sign in with Email/Password", "Sign in with GitHub", etc.

7. **User authenticates:**
   - Google OAuth popup with email hint
   - After auth, redirect back to `/join?token=abc123`

8. **Post-authentication processing:**

   ```typescript
   // Check if user document exists
   const userId = toBranded<UserId>(auth.currentUser.uid);
   let user = await getUser(userId);

   if (!user) {
     // Create new user document (Flow B)
     user = await createUser({
       id: userId,
       email: auth.currentUser.email,
       displayName: auth.currentUser.displayName,
       photoURL: auth.currentUser.photoURL,
       createdAt: new Date(),
       lastLoginAt: new Date(),
     });
   } else {
     // Update last login
     await updateUser(userId, { lastLoginAt: new Date() });
   }

   // Accept all selected invitations
   for (const inv of selectedInvitations) {
     // Create organization member
     await createOrganizationMember({
       organizationId: inv.organizationId,
       userId,
       role: inv.role,
       brandAccess: inv.brandAccess,
       autoGrantNewBrands: inv.autoGrantNewBrands,
       invitedAt: inv.invitedAt,
       invitedBy: inv.invitedBy,
       joinedAt: new Date(),
     });

     // Mark invitation as accepted
     await updateInvitation(inv.id, {
       status: "accepted",
       acceptedAt: new Date(),
     });
   }
   ```

9. **Redirect to dashboard:**
   - If one organization: `/dashboard`
   - If multiple organizations joined: `/organizations` (org picker)
   - Show success toast: "Welcome to {Organization}!"

**Edge Cases:**

- Email mismatch (auth email ≠ invitation email) → Error: "Please sign in with {invitation.email}"
- User already member of org → Skip that invitation, show warning
- All invitations already accepted/expired → Redirect to dashboard with info message
- Network error during acceptance → Show retry button, don't mark invitation as accepted

---

### Flow 3: Accept Invitation (Existing User)

**Actor:** Existing user receiving invitation to second organization  
**Differences from Flow 2:**

1. User may already be signed in → Skip authentication, go straight to acceptance
2. User document already exists → Skip user creation
3. Just create new `organizationMember` record
4. Redirect to new org's dashboard or show org switcher

**Steps:**

1. **User clicks invitation link** → `/join?token=abc123`
2. **System detects authenticated user**
3. **Validate email match:**
   ```typescript
   if (auth.currentUser.email !== invitation.email) {
     return <ErrorPage message="Please sign out and use the correct account" />;
   }
   ```
4. **Show acceptance UI:** "Join {Organization}?"
5. **User clicks "Accept"**
6. **Create organization member** (same as Flow 2)
7. **Update UI:** Organization added to user's org list

---

### Flow 4: Decline Invitation

**Actor:** User receiving invitation  
**Entry Point:** `/join?token=abc123` → "Decline" button

**Steps:**

1. **User clicks "Decline"**
2. **Confirmation modal:** "Are you sure you want to decline this invitation?"
3. **Update invitation:**
   ```typescript
   await updateInvitation(invitationId, {
     status: "declined",
   });
   ```
4. **Show message:** "Invitation declined. You can still accept it later if you change your mind."
5. **Optional:** Send email to inviter (notification of decline)

**Edge Cases:**

- User declines then clicks link again → Show "You declined this invitation. Contact {inviter} if you'd like a new one."

---

### Flow 5: Resend Invitation

**Actor:** Organization admin  
**Entry Point:** `/dashboard/users` → Pending invitation row → "Resend" button

**Steps:**

1. **User clicks "Resend"**
2. **Update invitation:**
   ```typescript
   await updateInvitation(invitationId, {
     expiresAt: addDays(new Date(), 7), // Reset expiration
   });
   ```
3. **Send new email** (same template, updated expiration date)
4. **Show success toast:** "Invitation resent to {email}"

---

## Technical Implementation

### Phase 1: Schema & Database Operations

**Tasks:**

1. **Create invitation schema** (`packages/core/src/schemas/invitation.schema.ts`)
   - Zod schema with all fields
   - Validation helpers
   - TypeScript types

2. **Add InvitationId branded type** (`packages/core/src/types/branded.ts`)

3. **Update OrganizationMember schema**
   - Add `autoGrantNewBrands: boolean` field
   - Update validators

4. **Create Firestore operations** (`packages/firebase-utils/src/firestore/invitations.ts`)
   - `createInvitation()`
   - `getInvitation(invitationId)`
   - `getInvitationByToken(token)`
   - `getPendingInvitationsByEmail(email)`
   - `getOrganizationInvitations(organizationId)`
   - `updateInvitation(invitationId, data)`
   - `deleteInvitation(invitationId)`

5. **Write tests** (target: 70%+ coverage)
   - Schema validation tests
   - CRUD operation tests
   - Token generation/validation tests

---

### Phase 2: Email Integration

**Tasks:**

1. **Create invitation email template** (`packages/email-utils/src/templates/invitation.ts`)

   ```typescript
   interface InvitationEmailData {
     recipientEmail: string;
     inviterName: string;
     organizationName: string;
     role: string; // "Admin" | "Member"
     invitationUrl: string;
     expiresAt: Date;
   }
   ```

2. **Template content (UK English):**
   - Subject: "{InviterName} invited you to join {OrganizationName} on Brayford"
   - Body:
     - Personal greeting from inviter
     - Organization name and role
     - Clear call-to-action button: "Accept Invitation"
     - Expiration notice: "This invitation expires on {date}"
     - Footer: "If you weren't expecting this, you can ignore it"

3. **Add email helper** (`packages/email-utils/src/helpers.ts`)

   ```typescript
   export async function sendInvitationEmail(
     data: InvitationEmailData,
   ): Promise<void>;
   ```

4. **Write email tests**
   - Template validation
   - Rate limiting tests
   - Dev mode tests (console log instead of send)

---

### Phase 3: UI Components

#### Component 1: InviteUserModal

**Location:** `apps/creator/app/dashboard/users/InviteUserModal.tsx`

**Props:**

```typescript
interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: OrganizationId;
  currentMember: OrganizationMemberDocument;
  brands: BrandDocument[];
  onSuccess: () => void;
}
```

**Features:**

- Form with email, role, brand selection
- Real-time validation
- Permission checks (disable if user lacks `users:invite`)
- Loading states
- Error handling
- Success feedback

**State Management:**

```typescript
const [email, setEmail] = useState("");
const [role, setRole] = useState<"admin" | "member">("member");
const [selectedBrands, setSelectedBrands] = useState<BrandId[]>([]);
const [autoGrantNewBrands, setAutoGrantNewBrands] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

---

#### Component 2: JoinPage

**Location:** `apps/creator/app/join/page.tsx`

**Query Params:** `?token=abc123`

**Features:**

- Token validation
- Multi-invitation display
- Authentication flow
- Acceptance/decline actions
- Error states (expired, invalid, already used)
- Loading states

**State Flow:**

```typescript
const [invitation, setInvitation] = useState<Invitation | null>(null);
const [allInvitations, setAllInvitations] = useState<Invitation[]>([]);
const [selectedInvitations, setSelectedInvitations] = useState<InvitationId[]>(
  [],
);
const [isAccepting, setIsAccepting] = useState(false);
```

---

#### Component 3: PendingInvitationsList

**Location:** `apps/creator/app/dashboard/users/PendingInvitationsList.tsx`

**Features:**

- Show pending invitations in team members list
- "Pending" badge with different styling
- Resend button
- Cancel/revoke button
- Shows invitation date and expiration

---

### Phase 4: Brand Creation Logic Updates

**Update:** `packages/firebase-utils/src/firestore/brands.ts`

**Modify `createBrand()` to auto-grant access:**

```typescript
export async function createBrand(
  data: CreateBrandData,
  creatorUserId: UserId,
): Promise<BrandId> {
  // Create brand document
  const brandRef = doc(collection(db, "brands"));
  const brandId = toBranded<BrandId>(brandRef.id);

  await setDoc(brandRef, {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: fromBranded(creatorUserId),
  });

  // Get all members with autoGrantNewBrands enabled
  const members = await getOrganizationMembers(data.organizationId);
  const autoGrantMembers = members.filter((m) => m.autoGrantNewBrands);

  // Update their brandAccess arrays (batch for efficiency)
  if (autoGrantMembers.length > 0) {
    await Promise.all(
      autoGrantMembers.map((member) =>
        updateOrganizationMember(member.id, {
          brandAccess: [...member.brandAccess, brandId],
        }),
      ),
    );
  }

  return brandId;
}
```

**Edge Cases:**

- Large organizations (100+ members) → Consider batching updates
- Race conditions (member removed while brand being created) → Handle update failures gracefully
- Performance: Test with 50 members, monitor Firestore write quotas

---

### Phase 5: Navigation & Integration

**Tasks:**

1. **Update team members page** (`/dashboard/users`)
   - Wire up "Invite User" button to modal
   - Display pending invitations with badges
   - Add resend/cancel actions

2. **Update dashboard navigation**
   - Already complete (Team Members card exists)

3. **Add org switcher** (if user has multiple orgs)
   - Dropdown in header showing current org
   - List all organizations user belongs to
   - Switch between dashboards

4. **Update onboarding logic**
   - Check for pending invitations on sign-in
   - If found, redirect to `/join?token=xxx` instead of `/onboarding`

---

## Security Considerations

### Token Security

- **Generate secure tokens:** Use `crypto.randomUUID()` or similar
- **Store hashed tokens:** Consider hashing tokens in database (can query by hash)
- **One-time use:** Mark invitation as used after acceptance
- **Expiration:** 7 days by default, configurable
- **HTTPS only:** Invitation links must use HTTPS in production

### Email Validation

- **Normalize emails:** Lowercase, trim whitespace
- **Validate format:** Use Zod email validator
- **No plus addressing tricks:** Consider blocking `+` in emails or normalizing

### Permission Checks

- **Backend validation:** Always check `users:invite` permission server-side
- **Frontend hints:** Disable UI but don't rely on client-side checks alone
- **Rate limiting:** Prevent invitation spam (max 10 invitations per hour per user)

### Firestore Rules

```javascript
// Invitations
match /invitations/{invitationId} {
  allow read: if request.auth != null
    && (request.auth.token.email == resource.data.email
        || isOrgMember(request.auth.uid, resource.data.organizationId));

  allow create: if request.auth != null
    && hasPermission(request.auth.uid, request.resource.data.organizationId, 'users:invite')
    && request.resource.data.invitedBy == request.auth.uid
    && request.resource.data.status == 'pending';

  allow update: if request.auth != null
    && (
      // User accepting/declining their own invitation
      (request.auth.token.email == resource.data.email
       && request.resource.data.status in ['accepted', 'declined'])
      // Or admin resending/canceling
      || (isOrgMember(request.auth.uid, resource.data.organizationId)
          && hasPermission(request.auth.uid, resource.data.organizationId, 'users:invite'))
    );

  allow delete: if request.auth != null
    && hasPermission(request.auth.uid, resource.data.organizationId, 'users:invite');
}
```

---

## Edge Cases & Error Handling

### Email Already in Use

**Scenario:** Admin invites email that's already a member

**Handling:**

- Check during invitation creation
- Show error: "User with this email is already a member"
- Suggest: "View team members" link

### Expired Invitation

**Scenario:** User clicks 8-day-old invitation link

**Handling:**

- Show friendly error page: "This invitation has expired"
- Show contact info: "Contact {inviter} for a new invitation"
- Optional: "Request new invitation" button (sends email to inviter)

### Email Mismatch

**Scenario:** User authenticates with different email than invitation

**Handling:**

- Detect mismatch after OAuth
- Show error: "Please sign in with {invitation.email}"
- Provide "Sign out" button to try again

### Multiple Sign-In Methods

**Scenario:** User has Google account but later we add email/password

**Handling:**

- Firebase allows linking multiple auth providers to one account
- Invitation flow should work regardless of auth method
- Email is the canonical identifier, not provider

### Invitation to User in Multiple Orgs

**Scenario:** User already in Org A, gets invited to Org B

**Handling:**

- Allow, this is expected behavior
- Just create new `organizationMember` record
- No new user document needed
- Dashboard shows org switcher

### Concurrent Invitations

**Scenario:** Admin A and Admin B both send invitation to same email

**Handling:**

- Both invitations created (separate documents)
- User sees both in "accept all" flow
- Both create separate `organizationMember` records (same org)
- Detect duplicate org membership, show warning, prevent creation

### Network Failure During Acceptance

**Scenario:** User clicks "Accept" but request fails

**Handling:**

- Don't mark invitation as accepted
- Show error with retry button
- Idempotency: If user retries, check if already member first
- Log errors for debugging

---

## Testing Requirements

### Unit Tests

**Schemas (`packages/core/src/schemas/__tests__/invitation.schema.test.ts`)**

- Valid invitation data
- Invalid email format
- Invalid role (e.g., trying to invite as 'owner')
- Missing required fields
- Token generation uniqueness

**Firestore Operations (`packages/firebase-utils/src/firestore/__tests__/invitations.test.ts`)**

- Create invitation
- Get invitation by ID
- Get invitation by token
- Get pending invitations by email
- Update invitation status
- Delete invitation
- Query organization invitations

**Auto-grant Logic (`packages/firebase-utils/src/firestore/__tests__/brands.test.ts`)**

- Brand created → members with autoGrantNewBrands get access
- Brand created → members without flag don't get access
- Brand created → admins/owners always get access
- Brand created with no auto-grant members → no updates

### Integration Tests

**Invitation Flow (E2E with Playwright)**

1. Admin invites user → email sent
2. User clicks link → sees invitation page
3. User authenticates → organizationMember created
4. User lands on dashboard → correct org shown

**Multi-Organization Flow**

1. User invited to Org A and Org B
2. User clicks Org A link
3. User sees both invitations
4. User accepts both
5. User can switch between orgs

**Edge Case Tests**

- Expired invitation → error page
- Invalid token → error page
- Email mismatch → error message
- Already member → graceful handling

### Manual Testing Checklist

- [ ] Send invitation from dashboard
- [ ] Receive invitation email (check formatting, UK English)
- [ ] Click invitation link (fresh browser)
- [ ] Authenticate with Google
- [ ] Verify user document created correctly
- [ ] Verify organizationMember created with correct role/brands
- [ ] Check brand access in dashboard
- [ ] Create new brand → verify auto-grant works
- [ ] Invite user to second org
- [ ] Accept both invitations
- [ ] Switch between orgs in dashboard
- [ ] Try expired invitation link
- [ ] Try invalid token
- [ ] Resend invitation
- [ ] Cancel pending invitation

---

## Performance Considerations

### Database Queries

- **Index on `email + status`** for fast pending invitation lookup
- **Index on `token`** for link validation
- **Limit invitation queries** to 50 results (pagination if needed)

### Email Sending

- **Rate limiting:** Max 10 invitations per hour per user
- **Batch emails:** If inviting multiple users, queue and send in batches
- **Retry logic:** Already handled by `@brayford/email-utils`

### Auto-Grant Updates

- **Batch writes:** Update multiple members in parallel with `Promise.all()`
- **Monitor quota:** Firestore has 500 writes/sec limit per database
- **Consider:** If org has 100+ members, use jitter for write spreading

---

## Future Enhancements

### Phase 2+ Features (Not in Initial Implementation)

1. **Invitation Templates**
   - Custom welcome messages
   - Personalized onboarding content

2. **Invitation Analytics**
   - Track acceptance rates
   - Time-to-accept metrics
   - Conversion funnel

3. **Bulk Invitations**
   - CSV upload
   - Multiple emails at once
   - Batch role/brand assignment

4. **Invitation Revocation**
   - Admin can cancel pending invitation
   - Send notification email to revoked user

5. **Email Reminders**
   - Send reminder after 3 days if not accepted
   - Configurable reminder schedule

6. **Custom Expiration**
   - Allow admin to set expiration (1 day, 7 days, 30 days, never)

7. **Invitation Approval**
   - Require owner approval for admin invitations
   - Multi-step invitation workflow

---

## Success Metrics

### Implementation Complete When:

- ✅ All schemas, validators, and types created
- ✅ Firestore operations functional with tests (70%+ coverage)
- ✅ Email template created and tested
- ✅ Invite modal working in dashboard
- ✅ Join page working with all flows
- ✅ Multi-org acceptance working
- ✅ Auto-grant brand access working
- ✅ Security rules deployed
- ✅ Documentation updated (ROADMAP.md, CHANGELOG.md)

### User Experience Success:

- ⏱️ Invitation sent in < 5 seconds
- ⏱️ Invitation accepted in < 30 seconds (including auth)
- 📧 Email arrives within 2 minutes
- 🎯 Clear error messages for all edge cases
- 🔒 No security vulnerabilities

---

## Dependencies

### Existing Packages

- `@brayford/core` - Schemas, types, permissions
- `@brayford/firebase-utils` - Firestore operations
- `@brayford/email-utils` - Email sending

### New Dependencies

- None required (use existing stack)

### Environment Variables

```bash
# Already configured
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID
POSTMARK_API_KEY
EMAIL_DEV_MODE

# New (optional)
INVITATION_EXPIRY_DAYS=7  # Default: 7
INVITATION_RATE_LIMIT=10   # Max per hour per user
```

---

## Implementation Timeline

**Estimated:** 6-8 hours for complete implementation

- **Phase 1:** Schema & DB ops (1-2 hours)
- **Phase 2:** Email integration (30-60 min)
- **Phase 3:** UI components (2-3 hours)
- **Phase 4:** Brand auto-grant logic (30-60 min)
- **Phase 5:** Integration & testing (2 hours)

**Actual timeline may vary based on edge case discoveries and testing thoroughness.**

---

## Questions for Clarification

1. **Email provider:** Confirm Postmark configuration is production-ready for invitation emails
2. **App URL:** Confirm base URL for invitation links (production vs staging)
3. **UI design system:** Any specific design requirements for invitation modal/pages?
4. **Organization switching:** Should we build org switcher now or defer?
5. **Notification preferences:** Should inviter get notified when invitation is accepted?

---

## Approval Checklist

Before implementation begins:

- [ ] Technical approach approved
- [ ] Data model reviewed
- [ ] User flows validated
- [ ] Security considerations addressed
- [ ] Testing strategy confirmed
- [ ] Timeline acceptable

---

**Status:** Ready for implementation  
**Next Step:** Begin Phase 1 - Schema & Database Operations
