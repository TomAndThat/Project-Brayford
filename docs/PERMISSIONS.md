# Permissions & Access Control

**Project Brayford** | Organization-Level Permission System  
_Last Updated: February 9, 2026_

---

## Overview

Project Brayford uses a **capability-based permission system** at the backend level, while presenting a simplified **three-role interface** to users. This architecture provides flexibility for future permission customization without requiring data model changes.

### Key Principles

- **Backend validates specific capabilities** (e.g., `manage:users`) not vague roles
- **Frontend shows simplified roles** (Owner/Admin/Member) for better UX
- **Roles are permission presets** - each role grants a specific set of permissions
- **Permissions are granular** - easy to add new capabilities as features grow
- **Future-proof** - supports custom permissions per member without schema changes

---

## Permission Categories

Permissions are organized by domain and action type:

### Organization Management

| Permission           | Description                              | Owner | Admin | Member |
| -------------------- | ---------------------------------------- | ----- | ----- | ------ |
| `org:update`         | Update organization name, type, settings | ✅    | ✅    | ❌     |
| `org:delete`         | Delete the entire organization           | ✅    | ❌    | ❌     |
| `org:transfer`       | Transfer ownership to another user       | ✅    | ❌    | ❌     |
| `org:view_billing`   | View subscription & billing information  | ✅    | ❌    | ❌     |
| `org:manage_billing` | Update payment methods, change plans     | ✅    | ❌    | ❌     |

### User & Team Management

| Permission            | Description                        | Owner | Admin | Member |
| --------------------- | ---------------------------------- | ----- | ----- | ------ |
| `users:invite`        | Send invitations to new users      | ✅    | ✅    | ❌     |
| `users:view`          | View list of organization members  | ✅    | ✅    | ✅     |
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

**Description:** The organization's primary account holder with full control.

**Key Responsibilities:**

- Billing and subscription management
- Organization deletion and transfer
- Ultimate authority over all resources

**Default Permissions:** All permissions (`*` wildcard)

**Restrictions:**

- Only one owner per organization
- Cannot be removed by other members
- Can only transfer ownership, not demote self

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
users:view
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
