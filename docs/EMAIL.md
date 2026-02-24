# Email System

Project Brayford uses [Postmark](https://postmarkapp.com) for transactional and bulk email delivery, orchestrated through Firebase Cloud Functions and a Firestore-backed queue.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How to Send an Email](#how-to-send-an-email)
3. [Email Types and Delivery Modes](#email-types-and-delivery-modes)
4. [Postmark Templates and Layouts](#postmark-templates-and-layouts)
5. [The `pb-admin` Layout](#the-pb-admin-layout)
6. [Rate Limiting](#rate-limiting)
7. [Cloud Functions](#cloud-functions)
8. [Environment Variables](#environment-variables)
9. [Development Mode](#development-mode)
10. [Key Files](#key-files)
11. [Adding a New Email](#adding-a-new-email)

---

## Architecture Overview

```
Your code
  │
  │  writes document
  ▼
/emailQueue/{emailId}          (Firestore)
  │
  │  triggers / scheduled poll
  ▼
Cloud Function
  │
  ├─ check rate limit (/emailQueue/_rateLimits/…)
  │
  ├─ inject layout variables (pb-admin templates)
  │
  └─ Postmark API → delivered email
```

The queue pattern is intentional:

- **Decouples** email sending from the action that triggered it. If Postmark is unavailable, documents accumulate and are processed when it recovers.
- **Enables rate limiting** across multiple concurrent Cloud Function instances via shared Firestore counters.
- **Provides an audit trail** — every queued email and its eventual status is permanently recorded.

---

## How to Send an Email

Write a document to `/emailQueue` in Firestore. The Cloud Function takes it from there.

```typescript
await db.collection("emailQueue").add({
  type: "invitation", // EmailType — drives rate limiting
  deliveryMode: "immediate", // 'immediate' | 'batch'
  status: "pending",
  to: "user@example.com",
  templateAlias: "pb-admin-organization-invitation", // Postmark template alias
  templateData: {
    // Variables specific to this template.
    // Layout variables (product_name, etc.) are injected automatically
    // for pb-admin-* templates — do NOT include them here.
    organizationName: "Acme Corp",
    inviterName: "Jane Smith",
    inviteLink: "https://app.brayford.live/join?token=abc123",
  },
  metadata: {
    userId: "user-abc",
    organizationId: "org-xyz",
  },
  rateLimitScope: "organization:org-xyz", // optional — see Rate Limiting
  createdAt: FieldValue.serverTimestamp(),
  attempts: 0,
});
```

### Field reference

| Field            | Type                      | Required | Notes                                   |
| ---------------- | ------------------------- | -------- | --------------------------------------- |
| `type`           | `EmailType`               | ✅       | Determines rate limit config            |
| `deliveryMode`   | `'immediate' \| 'batch'`  | ✅       | See delivery modes below                |
| `status`         | `'pending'`               | ✅       | Always set to `'pending'` when creating |
| `to`             | `string` (email)          | ✅       | Normalised to lowercase on send         |
| `templateAlias`  | `string`                  | ✅       | Postmark template alias                 |
| `templateData`   | `Record<string, unknown>` | ✅       | Template-specific variables             |
| `metadata`       | `EmailMetadata`           | ✅       | For tracking; used by rate limiter      |
| `from`           | `EmailSender`             | ❌       | Overrides default sender                |
| `replyTo`        | `string` (email)          | ❌       | Reply-to address                        |
| `rateLimitScope` | `string`                  | ❌       | Defaults to org or global scope         |
| `createdAt`      | `Timestamp`               | ✅       | `FieldValue.serverTimestamp()`          |
| `attempts`       | `number`                  | ✅       | Always `0` when creating                |

The full schema is defined in `packages/core/src/schemas/email-queue.schema.ts` and validated with Zod.

---

## Email Types and Delivery Modes

### Delivery modes

| Mode        | Trigger                                            | Use for                                                                  |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| `immediate` | `onDocumentCreated` Cloud Function fires instantly | Transactional emails where timing matters (invitations, password resets) |
| `batch`     | Scheduled Cloud Function polls every minute        | Bulk sends (event reminders, digests, marketing)                         |

### Email types

| Type                    | Mode      | Rate limit scope | Limit     |
| ----------------------- | --------- | ---------------- | --------- |
| `invitation`            | immediate | per organisation | 10 / min  |
| `org-owner-invitation`  | immediate | per organisation | 10 / min  |
| `password-reset`        | immediate | per user         | 5 / min   |
| `verification`          | immediate | per user         | 5 / min   |
| `billing-invoice`       | immediate | per organisation | 20 / min  |
| `organization-deletion` | immediate | per organisation | 1 / min   |
| `event-reminder`        | batch     | global           | 100 / min |
| `weekly-digest`         | batch     | global           | 100 / min |
| `marketing`             | batch     | global           | 100 / min |

The type field drives rate limiting only — it does not dictate which template is used.

---

## Postmark Templates and Layouts

Postmark uses a two-level system:

- A **layout** (`pb-admin`) provides the outer HTML shell — masthead, footer, company details.
- A **template** provides the body content (`{{{ @content }}}`) and inherits a layout.

You never reference a layout directly in API calls. The relationship is set inside the Postmark dashboard on each template. When you call `sendEmailWithTemplate`, you pass a `TemplateAlias` and a `TemplateModel`; Postmark resolves the layout automatically and merges variables from the model into both the template body and the layout.

### Current templates

| Template alias                   | Type                    | Layout       | Description                                                      |
| -------------------------------- | ----------------------- | ------------ | ---------------------------------------------------------------- |
| `organization-invitation`        | `invitation`            | _(none yet)_ | Member invitation to join an organisation                        |
| `organization-deletion-complete` | `organization-deletion` | _(none yet)_ | Notifies former members that their organisation has been deleted |

> **Note:** These templates do not yet use the `pb-admin` layout. When you move them to the layout in Postmark, rename their aliases to follow the `pb-admin-*` convention (see below) and update the references in `functions/src/index.ts`.

---

## The `pb-admin` Layout

The `pb-admin` layout is used for outbound emails sent **from Project Brayford to Creator App users** (e.g. invitations, account emails). It provides a consistent branded wrapper with masthead and footer.

### Naming convention

Any Postmark template whose alias starts with **`pb-admin-`** is assumed to use this layout, e.g.:

```
pb-admin-organization-invitation
pb-admin-organization-deletion-complete
pb-admin-password-reset
```

### Layout variables

The layout requires five variables. These are **injected automatically at send time** for any `pb-admin-*` template — you do not need to include them in `templateData` when queuing an email.

| Variable             | Source                          | Example value             |
| -------------------- | ------------------------------- | ------------------------- |
| `product_name`       | `POSTMARK_PRODUCT_NAME` env var | `Project Brayford`        |
| `product_url`        | `POSTMARK_PRODUCT_URL` env var  | `https://brayford.live`   |
| `bf_company_name`    | `BF_COMPANY_NAME` env var       | `TomAndThat Ltd`          |
| `bf_company_address` | `BF_COMPANY_ADDRESS` env var    | `71-75 Shelton Street...` |
| `current_year`       | Computed at send time           | `2026`                    |

### How injection works

In `functions/src/email/postmark-client.ts`, before calling `sendEmailWithTemplate`, the template alias is tested with `usesPbAdminLayout()`. If it matches, a layout vars object is spread into `TemplateModel` ahead of the caller's `templateData`:

```typescript
const layoutVars = usesPbAdminLayout(email.templateAlias)
  ? {
      product_name: config.pbAdminLayout.productName,
      product_url: config.pbAdminLayout.productUrl,
      bf_company_name: config.pbAdminLayout.companyName,
      bf_company_address: config.pbAdminLayout.companyAddress,
      current_year: new Date().getFullYear(),
    }
  : {};

TemplateModel: { ...layoutVars, ...email.templateData }
```

`templateData` is spread last, so per-template values always take precedence if a key clashes.

### Updating layout values

Edit the environment variables (`functions/.env` for local, Firebase Functions config for production) and redeploy. No Postmark changes required.

---

## Rate Limiting

Rate limiting is enforced in Firestore at `/emailQueue/_rateLimits/{scope}/{type}` using a one-minute sliding window. Documents at this path are managed entirely by the Cloud Functions — you never write to them directly.

### Scopes

| Scope format                    | Used for                       |
| ------------------------------- | ------------------------------ |
| `user:{userId}`                 | Password resets, verification  |
| `organization:{organizationId}` | Invitations, billing, deletion |
| `global`                        | Bulk/marketing sends           |

If a `rateLimitScope` field is absent from the queue document, the function derives the scope from `metadata.organizationId` (falls back to `global`).

### Behaviour on rate limit exceeded

The queue document's status is set to `rate-limited` with an error detail. **The email is not retried automatically.** If you need a retry mechanism for rate-limited emails, that is a future enhancement (see `ROADMAP.md`).

### Overriding limits

Rate limits can be raised per-environment without a code change via environment variables:

```
EMAIL_RATE_LIMIT_INVITATION=20
EMAIL_RATE_LIMIT_BILLING_INVOICE=50
```

The full list of override variables is in [`functions/.env`](../functions/.env).

---

## Cloud Functions

### `processTransactionalEmail`

- **Trigger:** `onDocumentCreated` on `/emailQueue/{emailId}`
- **Region:** `europe-west2`
- **Retries:** Yes (Firebase automatic retry on failure)
- **Flow:**
  1. Exits immediately if `deliveryMode === 'batch'`
  2. Sets status → `processing`
  3. Checks rate limit
  4. Calls `sendEmail()` → Postmark
  5. Sets status → `sent` or `failed` / `rate-limited`

### `processBulkEmailBatch`

- **Trigger:** Scheduled — every 1 minute (`Europe/London` timezone)
- **Region:** `europe-west2`
- **Batch size:** 50 documents per run
- **Jitter:** 500–2000 ms between sends to avoid thundering-herd on Postmark
- **Flow:** Same as above but queries `deliveryMode === 'batch'` documents ordered by `createdAt asc`

### `triggerBatchEmailProcessing`

- **Trigger:** HTTP GET/POST (no auth — for emulator use only)
- **Purpose:** Allows manual triggering of batch processing during local development, since scheduled functions don't fire automatically in the emulator
- **Usage:** `curl http://localhost:5001/PROJECT_ID/europe-west2/triggerBatchEmailProcessing`

### `onInvitationCreated`

- **Trigger:** `onDocumentCreated` on `/invitations/{invitationId}`
- **Purpose:** Watches for new invitation documents and queues the corresponding email automatically
- **Template used:** `organization-invitation`
- **Rate limit scope:** `organization:{organizationId}`

---

## Environment Variables

All email-related environment variables live in `functions/.env` (local) and must be set in Firebase Functions configuration for production deployment.

| Variable                | Required  | Description                                                        |
| ----------------------- | --------- | ------------------------------------------------------------------ |
| `POSTMARK_API_KEY`      | ✅ (prod) | Server API key from Postmark dashboard                             |
| `POSTMARK_FROM_EMAIL`   | ✅ (prod) | Sender address, e.g. `noreply@brayford.live`                       |
| `POSTMARK_FROM_NAME`    | ❌        | Display name for the sender. Defaults to `Project Brayford`        |
| `POSTMARK_PRODUCT_NAME` | ❌        | Injected as `product_name` into `pb-admin` layouts                 |
| `POSTMARK_PRODUCT_URL`  | ❌        | Injected as `product_url` into `pb-admin` layouts                  |
| `BF_COMPANY_NAME`       | ❌        | Company name in email footer (`bf_company_name`)                   |
| `BF_COMPANY_ADDRESS`    | ❌        | Company address in email footer (`bf_company_address`)             |
| `EMAIL_DEV_MODE`        | ❌        | Set to `true` to log emails to console instead of sending          |
| `CREATOR_APP_URL`       | ❌        | Base URL for invitation links. Defaults to `http://localhost:3000` |
| `EMAIL_RATE_LIMIT_*`    | ❌        | Per-type rate limit overrides (see `.env` for full list)           |

---

## Development Mode

Set `EMAIL_DEV_MODE=true` in `functions/.env`.

In dev mode:

- **No emails are sent to Postmark.** The Cloud Function logs the full email payload to the Firebase Functions console instead.
- A mock `messageId` of the form `dev-mode-{emailId}-{timestamp}` is returned.
- The queue document is still updated to `status: 'sent'` so the rest of the flow behaves identically to production.
- Batch processing still runs and logs a summary.
- The Postmark connection test is skipped.

The dev-mode log output (visible in `firebase emulators:start` or Cloud Functions logs) looks like:

```
────────────────────────────────────────────────────────────
📧 [DEV MODE] Email queued but not sent
────────────────────────────────────────────────────────────
   ID:       abc123
   To:       user@example.com
   Type:     invitation
   Mode:     immediate
   Template: pb-admin-organization-invitation
   Data:     { "organizationName": "Acme Corp", ... }
────────────────────────────────────────────────────────────
```

---

## Key Files

| File                                              | Purpose                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `functions/src/email/config.ts`                   | Environment config, `EmailConfig` interface, `usesPbAdminLayout()` helper                                      |
| `functions/src/email/postmark-client.ts`          | Postmark API client, `sendEmail()`, layout variable injection                                                  |
| `functions/src/email/rate-limiter.ts`             | Firestore-backed sliding-window rate limiter                                                                   |
| `functions/src/email/dev-mode.ts`                 | Console logging utilities for dev mode                                                                         |
| `functions/src/email/index.ts`                    | Re-exports for the email module                                                                                |
| `functions/src/index.ts`                          | Cloud Function definitions (`processTransactionalEmail`, `processBulkEmailBatch`, `onInvitationCreated`, etc.) |
| `packages/core/src/schemas/email-queue.schema.ts` | Zod schemas, types, helper functions, rate limit defaults                                                      |
| `functions/.env`                                  | Local environment variables (never committed with real keys)                                                   |

---

## Adding a New Email

### 1. Decide whether it needs the `pb-admin` layout

If it is a creator-facing email sent from Project Brayford (invitation, account, billing), use the `pb-admin` layout. If it is audience-facing or uses a different brand, use a different layout or none.

### 2. Create the template in Postmark

- Name the alias following the convention: `pb-admin-{descriptor}` for `pb-admin` layout templates, or a plain name otherwise.
- Set the `LayoutTemplate` property in Postmark to `pb-admin` if applicable.
- Define your template variables. **Do not add the layout variables** (`product_name`, `bf_company_name`, etc.) — they are injected automatically.

### 3. Add the email type (if new)

If you are introducing a new `EmailType`, update the schema in `packages/core/src/schemas/email-queue.schema.ts`:

- Add it to `EmailTypeSchema`
- Add its rate limit to `EMAIL_RATE_LIMITS`
- Add its default delivery mode to `getDefaultDeliveryMode()`
- Add its rate limit scope logic to `getRateLimitScope()`

### 4. Queue the email

Write the queue document in your Cloud Function (see [How to Send an Email](#how-to-send-an-email)). If the email is triggered by a Firestore document change, consider adding a dedicated `onDocumentCreated` / `onDocumentUpdated` trigger (following the pattern of `onInvitationCreated`) to keep concerns separated.

### 5. Add rate limit env override (optional)

If the new type may need environment-specific overrides, add a commented-out entry to `functions/.env`:

```
# EMAIL_RATE_LIMIT_MY_NEW_TYPE=10
```
