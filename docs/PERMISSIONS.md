# Permissions & Access Control

**Project Brayford** | Organization-Level Permission System  
_Last Updated: February 10, 2026_

---

## Overview

Project Brayford uses a **capability-based permission system** at the backend level, while presenting a simplified **three-role interface** to users. This architecture provides flexibility for future permission customization without requiring data model changes.

### Key Principles

- **Backend validates specific capabilities** (e.g., `manage:users`) not vague roles
- **Frontend shows simplified roles** (Owner/Admin/Member) for better UX
- **Roles are permission presets** - each role grants a specific set of permissions
- **Permissions are granular** - easy to add new capabilities as features grow
- **Future-proof** - supports custom permissions per member without schema changes

### Absolutely Vital Guiding Principle

- **Capabilities determine permissions, not roles** - while we may use roles to simplify capabilities for users, we _never_ check permissions against a role

---

## Billing Tiers & Email Domain Enforcement

**Project Brayford** uses billing tiers to prevent subscription sharing while maintaining flexible pricing:

### Billing Tier System

Organizations are automatically assigned a billing tier during creation based on the **founder's email domain**:

#### Per-Brand Tier

- **Assigned to:** Organizations created with free email providers (Gmail, Hotmail, Yahoo, etc.)
- **Pricing:** Pay per brand created
- **Domain Enforcement:** None - can invite users from any email domain
- **Purpose:** Individual creators or small teams using personal email addresses

#### Flat-Rate Tier

- **Assigned to:** Organizations created with corporate/work email domains
- **Pricing:** Monthly flat fee with generous brand allowance (~10 brands included)
- **Domain Enforcement:** Can be enabled (admin-only) to require matching email domains for invitations
- **Purpose:** Companies and organizations with verified corporate domains

### Email Domain Detection

The system automatically:

1. **Extracts domain** from founder's email during org creation
2. **Checks against free provider list** (~70 common providers)
3. **Assigns billing tier** based on domain type:
   - `gmail.com`, `hotmail.com`, etc. → `per_brand` tier
   - `bbc.co.uk`, `acme.com`, etc. → `flat_rate` tier
4. **Stores domain data** for future enforcement

### Domain Enforcement (Admin-Only Feature)

**Current Status:** Infrastructure in place, enforcement **disabled by default**

When enabled by Project Brayford staff through the admin app:

- **Flat-rate orgs** can only invite users with matching email domains
- **Per-brand orgs** have no domain restrictions
- Validation occurs at invitation time (prevents sending invalid invites)
- Supports multiple allowed domains per org (for subsidiaries, acquisitions)

**Organization Schema Fields:**

```typescript
{
  billingTier: 'per_brand' | 'flat_rate',     // Auto-assigned on creation
  primaryEmailDomain: string,                   // e.g., 'bbc.co.uk' or 'gmail.com'
  allowedDomains: string[],                     // For multi-domain support
  requireDomainMatch: boolean,                  // Feature flag (default: false)
  domainVerified: boolean                       // For future verification
}
```

**Utility Functions:**

```typescript
import {
  isFreeDomainEmail,
  extractDomain,
  validateEmailForOrg,
  domainMatchesAllowed,
} from "@brayford/core";

// Check if email uses free provider
const isFree = isFreeDomainEmail("user@gmail.com"); // true

// Extract domain from email
const domain = extractDomain("user@bbc.co.uk"); // 'bbc.co.uk'

// Validate email against org requirements
const result = validateEmailForOrg(
  "new.user@bbc.co.uk",
  org.requireDomainMatch,
  org.allowedDomains,
  org.billingTier,
);
```

### Future Enhancements

- **Domain Verification:** DNS TXT record verification for corporate domains
- **Upgrade Path:** Allow per-brand orgs to upgrade to flat-rate after domain verification
- **Admin UI:** Interface for viewing/modifying domain enforcement settings
- **Audit Logging:** Track domain enforcement changes

---

## Permission Categories

Permissions are organized by domain and action type:

### Organization Management

| Permission           | Description                             | Owner | Admin | Member |
| -------------------- | --------------------------------------- | ----- | ----- | ------ |
| `org:update`         | Update organization name, type          | ✅    | ✅    | ❌     |
| `org:view_settings`  | Access organization settings page       | ✅    | ❌    | ❌     |
| `org:delete`         | Delete the entire organization          | ✅    | ❌    | ❌     |
| `org:transfer`       | Transfer ownership to another user      | ✅    | ❌    | ❌     |
| `org:view_billing`   | View subscription & billing information | ✅    | ❌    | ❌     |
| `org:manage_billing` | Update payment methods, change plans    | ✅    | ❌    | ❌     |

### User & Team Management

| Permission            | Description                        | Owner | Admin | Member |
| --------------------- | ---------------------------------- | ----- | ----- | ------ |
| `users:invite`        | Send invitations to new users      | ✅    | ✅    | ❌     |
| `users:view`          | View list of organization members  | ✅    | ✅    | ❌     |
| `users:update_role`   | Change member roles (except owner) | ✅    | ✅\*  | ❌     |
| `users:update_access` | Modify brand access for members    | ✅    | ✅    | ❌     |
| `users:remove`        | Remove members from organization   | ✅    | ✅\*  | ❌     |

_\* Admins cannot modify or remove owners_

### Brand Management

| Permission           | Description                       | Owner | Admin | Member |
| -------------------- | --------------------------------- | ----- | ----- | ------ |
| `brands:create`      | Create new brands                 | ✅    | ✅    | ❌     |
| `brands:view`        | View brand details                | ✅    | ✅    | ✅\*\* |
| `brands:update`      | Edit brand settings & information | ✅    | ✅    | ✅\*\* |
| `brands:delete`      | Delete brands                     | ✅    | ✅    | ❌     |
| `brands:manage_team` | Assign members to brands          | ✅    | ✅    | ❌     |

_\*\* Members only for brands in their `brandAccess` array_

### Event Management

| Permission              | Description                       | Owner | Admin | Member |
| ----------------------- | --------------------------------- | ----- | ----- | ------ |
| `events:create`         | Create new events                 | ✅    | ✅    | ✅\*\* |
| `events:view`           | View event details                | ✅    | ✅    | ✅\*\* |
| `events:update`         | Edit event settings               | ✅    | ✅    | ✅\*\* |
| `events:publish`        | Make events live                  | ✅    | ✅    | ✅\*\* |
| `events:delete`         | Delete events                     | ✅    | ✅    | ✅\*\* |
| `events:manage_modules` | Configure Q&A, polls, reactions   | ✅    | ✅    | ✅\*\* |
| `events:moderate`       | Moderate participant interactions | ✅    | ✅    | ✅\*\* |

_\*\* Members only for events under brands in their `brandAccess` array_

### Analytics & Reporting

| Permission             | Description                      | Owner | Admin | Member |
| ---------------------- | -------------------------------- | ----- | ----- | ------ |
| `analytics:view_org`   | View organization-wide analytics | ✅    | ✅    | ❌     |
| `analytics:view_brand` | View brand-level analytics       | ✅    | ✅    | ✅\*\* |
| `analytics:view_event` | View event-level analytics       | ✅    | ✅    | ✅\*\* |
| `analytics:export`     | Export reports (CSV, PDF)        | ✅    | ✅    | ✅\*\* |

_\*\* Members only for brands/events they have access to_

---

## Role Definitions

### Owner

**Description:** The organisation's primary account holder(s) with full control.

**Key Responsibilities:**

- Billing and subscription management
- Organisation deletion and transfer
- Ultimate authority over all resources
- Inviting additional owners (with appropriate warnings)

**Default Permissions:** All permissions (`*` wildcard)

**Multiple Owners:**

- Organisations can have multiple owners for large teams or ownership transitions
- Only existing owners can invite new owners (admins cannot)
- Owner invitations require explicit confirmation due to elevated permissions

**Restrictions:**

- Last owner cannot demote themselves (prevents org lockout)
- Owners with 2+ other owners can demote themselves to admin/member

**Owner-to-Owner Actions:**

- Owners can modify other owners' roles (demote to admin/member)
- Owners can remove other owners from the organisation
- These actions should be performed with care — consider adding confirmation prompts

**Invitation Rules:**

- Owners can invite: Owner, Admin, Member
- Admins can invite: Admin, Member (not Owner)
- Members cannot invite anyone

---

### Admin

**Description:** Trusted team members who manage day-to-day operations.

**Key Responsibilities:**

- Invite and manage team members
- Create and manage all brands
- Full access to all events and analytics

**Permissions:**

```
org:update
users:invite
users:view
users:update_role
users:update_access
users:remove
brands:create
brands:view
brands:update
brands:delete
brands:manage_team
events:create
events:view
events:update
events:publish
events:delete
events:manage_modules
events:moderate
analytics:view_org
analytics:view_brand
analytics:view_event
analytics:export
```

**Restrictions:**

- Cannot modify or remove owners
- Cannot access billing information
- Cannot delete the organization

---

### Member

**Description:** Contributors with access to specific brands only.

**Key Responsibilities:**

- Create and manage events for assigned brands
- Moderate interactions during live events
- View analytics for their events

**Permissions:**

```
brands:view (restricted)
brands:update (restricted)
events:create (restricted)
events:view (restricted)
events:update (restricted)
events:publish (restricted)
events:delete (restricted)
events:manage_modules (restricted)
events:moderate (restricted)
analytics:view_brand (restricted)
analytics:view_event (restricted)
analytics:export (restricted)
```

**Restrictions:**

- Can only access brands in their `brandAccess` array
- Cannot invite or manage other users
- Cannot create or delete brands
- All event permissions apply only to events under accessible brands

---

## Brand-Level Access Control

Members and admins can be assigned to specific brands via the `brandAccess` field:

```typescript
{
  userId: "user123",
  organizationId: "org456",
  role: "member",
  brandAccess: ["brand_abc", "brand_xyz"] // Access only these brands
}
```

**Access Rules:**

- **Empty array = full access** (for owners/admins who manage all brands)
- **Non-empty array = restricted access** (member can only see/manage listed brands)
- Events inherit brand access (if you can access a brand, you can access its events)

---

## Implementation Details

### Backend: Permission Checking

```typescript
import { hasPermission, requirePermission } from "@brayford/core/permissions";

// Soft check - returns boolean
if (hasPermission(member, "users:invite")) {
  // Allow action
}

// Hard check - throws error
requirePermission(member, "brands:delete");
```

### Frontend: Role Display

The client apps show simplified role labels:

```typescript
// Display to user
<Badge>{member.role}</Badge> // "Owner", "Admin", or "Member"

// But backend validates granular permissions
const canInvite = hasPermission(member, 'users:invite');
```

### Role Management Helpers

For invitation and role modification workflows, use these specialized helpers:

```typescript
import {
  canInviteRole,
  canChangeSelfRole,
  canModifyMemberRole,
} from "@brayford/core/permissions";

// Check if current member can invite someone with a specific role
if (canInviteRole(currentMember, "owner")) {
  // Show owner option in invite modal
}

// Check if owner can demote themselves (requires 2+ owners)
const ownerCount = await getOwnerCount(organizationId);
if (canChangeSelfRole(currentMember, ownerCount)) {
  // Allow role change
} else {
  // Show error: "You are the only owner..."
}

// Check if current member can modify another member's role
if (canModifyMemberRole(actor, target)) {
  // Allow role change
}
```

**Helper Function Rules:**

- `canInviteRole(actor, targetRole)`: Owners can invite any role; admins can invite admin/member; members cannot invite anyone
- `canChangeSelfRole(actor, ownerCount)`: Owners can demote themselves only if ownerCount >= 2
- `canModifyMemberRole(actor, target)`: Owners can modify anyone (including other owners); admins can modify members only

### Firestore Security Rules

```javascript
function hasPermission(userId, organizationId, permission) {
  let member = get(/databases/$(database)/documents/organizationMembers/$(userId + '_' + organizationId));
  return member.data.permissions.hasAny([permission, '*']);
}

match /brands/{brandId} {
  allow create: if hasPermission(request.auth.uid, resource.data.organizationId, 'brands:create');
  allow delete: if hasPermission(request.auth.uid, resource.data.organizationId, 'brands:delete');
}
```

---

## Future Enhancements

The granular permission system supports these future features without schema changes:

### Custom Roles

```typescript
// Future: Create "Event Manager" role
const eventManagerPermissions = [
  "events:create",
  "events:update",
  "events:publish",
  "analytics:view_event",
];
```

### Per-User Custom Permissions

```typescript
// Future: Grant specific member extra permission
{
  userId: "user123",
  role: "member",
  permissions: [
    ...MEMBER_PERMISSIONS,
    'brands:create' // Custom addition
  ]
}
```

### Permission Presets/Templates

```typescript
// Future: "Marketing Team" template
const marketingTeamPermissions = [
  "analytics:view_org",
  "analytics:export",
  "events:view",
];
```

---

## Permission Changes & Migration

When adding new features that require new permissions:

1. **Add permission to `packages/core/src/permissions/constants.ts`**
2. **Update role mappings in `role-mappings.ts`**
3. **Existing members automatically receive new permissions** based on their role
4. **No database migration needed** - permissions are computed from role

---

## Questions?

See implementation details in:

- `packages/core/src/permissions/` - Permission system code
- `packages/core/src/schemas/organization.schema.ts` - Data models
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) - Architecture overview
