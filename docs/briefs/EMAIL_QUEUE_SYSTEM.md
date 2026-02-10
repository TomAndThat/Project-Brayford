# Email Queue System - Technical Brief

**Package:** `@brayford/core` + Cloud Functions  
**Created:** 10 February 2026  
**Status:** Implemented  
**Supersedes:** [EMAIL_INFRASTRUCTURE.md](./EMAIL_INFRASTRUCTURE.md)

---

## Purpose

Implement a robust, queue-based email delivery system using Firestore and Cloud Functions that provides:

1. **Reliable delivery** with automatic retries for transactional emails
2. **Efficient bulk sending** for marketing/digest emails without overwhelming infrastructure
3. **Distributed rate limiting** that works across multiple Cloud Function instances
4. **Development workflow** with console logging instead of live email sends

This architecture replaces direct API route email sending with a resilient queue + background processor pattern.

---

## Architectural Shift

### Previous Architecture (API Routes)

```
Next.js App → API Route → Postmark API
```

**Problems:**

- No retries if Postmark is down (email lost forever)
- In-memory rate limiting breaks in serverless/distributed environments
- User waits for email send during HTTP request (slow UX)
- No visibility into send failures

### New Architecture (Cloud Functions + Queue)

```
Next.js App → Firestore emailQueue → Cloud Function → Postmark API
                           ↓
                    Status updates (sent/failed)
```

**Benefits:**

- Automatic retries (Cloud Functions built-in)
- Firestore-backed rate limiting works across instances
- Instant UI response (write to queue returns immediately)
- Full audit trail of send attempts in Firestore
- Separate handlers for transactional vs batch emails

---

## Core Concepts

### 1. Two Delivery Modes

| **Delivery Mode** | **Use Case**                                                      | **Handler**                 | **Trigger**                 | **Speed**              |
| ----------------- | ----------------------------------------------------------------- | --------------------------- | --------------------------- | ---------------------- |
| `immediate`       | Invitations, password resets, billing alerts, account actions     | `processTransactionalEmail` | `onCreate`                  | < 2 seconds            |
| `batch`           | Marketing emails, weekly digests, event reminders (to many users) | `processBulkEmailBatch`     | `onSchedule` (every minute) | Queued, sent in chunks |

**Rule:** If a user is waiting for the email (e.g., "Check your inbox for the link"), use `immediate`. If it's not time-sensitive or sent to hundreds of users, use `batch`.

### 2. Development Mode

**Environment Variable:** `EMAIL_DEV_MODE=true|false`

- **`true` (development):** Emails are logged to Cloud Functions console with full details (recipient, template, data). No emails sent to Postmark.
- **`false` (production):** Emails sent via Postmark API.

Set in:

- `/functions/.env` for Cloud Functions
- App `.env.local` files (for consistency, though functions control actual sending)

**Console log format (dev mode):**

```
📧 [DEV MODE] Email queued but not sent
   To: user@example.com
   Type: invitation
   Template: brayford-invitation-member
   Data: { organizationName: "Acme Corp", inviteLink: "..." }
```

### 3. Rate Limiting (Firestore-Backed)

Rate limits stored in Firestore subcollection `_rateLimits/{scope}/{type}` with sliding window counters:

```typescript
{
  count: 3,              // Emails sent in current window
  windowStart: Timestamp, // Window start time
  lastReset: Timestamp    // Last counter reset
}
```

**Scopes:**

- `user:{userId}` — Per-user limits (password resets, verification)
- `organization:{orgId}` — Per-organization limits (invitations, deletion)
- `global` — Global limits (bulk emails)

---

## Firestore Schema

### Collection: `emailQueue`

```typescript
interface EmailQueueDocument {
  // Core fields
  type: EmailType; // 'invitation' | 'password-reset' | 'marketing' | etc.
  deliveryMode: "immediate" | "batch";
  status: "pending" | "processing" | "sent" | "failed" | "rate-limited";

  // Recipient
  to: string; // Email address (normalized to lowercase)

  // Postmark template
  templateAlias: string; // e.g., 'brayford-invitation-member'
  templateData: Record<string, unknown>; // Variables for template interpolation

  // Optional sender override
  from?: {
    email: string;
    name: string;
  };
  replyTo?: string;

  // Metadata for tracking/filtering
  metadata: {
    userId?: string; // User who triggered the email
    organizationId?: string; // Related organization
    eventId?: string; // Related event (if applicable)
    campaignId?: string; // Marketing campaign ID
    [key: string]: unknown; // Additional context
  };

  // Timestamps
  createdAt: Timestamp; // When queued
  processedAt?: Timestamp; // When Cloud Function picked it up
  sentAt?: Timestamp; // When Postmark confirmed send

  // Delivery tracking
  attempts: number; // Send attempt count (0 initially)
  lastAttemptAt?: Timestamp; // Last send attempt
  postmarkMessageId?: string; // Postmark's message ID (on success)

  // Error handling
  error?: {
    code: string; // Error code (e.g., 'RATE_LIMIT_EXCEEDED', 'INVALID_TEMPLATE')
    message: string; // Human-readable error
    timestamp: Timestamp; // When error occurred
  };

  // Rate limiting context
  rateLimitScope?: string; // e.g., 'user:abc123' or 'organization:org-456'
}
```

**Indexes Required:**

```javascript
// firestore.indexes.json
{
  "collectionGroup": "emailQueue",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "deliveryMode", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}
```

---

## Cloud Functions Implementation

### Function 1: `processTransactionalEmail`

**Trigger:** `onDocumentCreated('emailQueue/{emailId}')`  
**Purpose:** Handle immediate-delivery emails (invitations, password resets, etc.)

**Logic:**

1. Check `deliveryMode` field
2. If `batch`, exit early (processed by separate function)
3. If `immediate`:
   - Check Firestore-backed rate limit for scope
   - If rate-limited, update status to `rate-limited` and exit
   - If allowed, call `sendEmail()` from `@brayford/email-utils`
   - Update document with `status: 'sent'` or `status: 'failed'` + error details
4. Cloud Functions automatically retries on failure (3 attempts)

**Configuration:**

```typescript
export const processTransactionalEmail = onDocumentCreated(
  "emailQueue/{emailId}",
  {
    region: "europe-west2",
    memory: "256MiB",
    timeoutSeconds: 60,
    retry: true, // Automatic retries on failure
  },
  async (event) => {
    /* ... */
  },
);
```

### Function 2: `processBulkEmailBatch`

**Trigger:** `onSchedule('every 1 minutes')`  
**Purpose:** Process batch-delivery emails in controlled chunks

**Logic:**

1. Query Firestore: `WHERE deliveryMode == 'batch' AND status == 'pending' LIMIT 50`
2. For each email (with jitter to spread load):
   - Check Firestore-backed rate limit
   - Send via `sendEmail()`
   - Update status to `sent` or `failed`
3. If more than 50 pending, next invocation (1 minute later) processes next batch
4. Respect global rate limit (e.g., 100 emails/minute for marketing)

**Configuration:**

```typescript
export const processBulkEmailBatch = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Europe/London",
    region: "europe-west2",
    memory: "512MiB",
    timeoutSeconds: 540, // 9 minutes (max for scheduled functions)
  },
  async (event) => {
    /* ... */
  },
);
```

**Batch Processing Strategy:**

- Process 50 emails per minute = ~3,000 emails/hour
- Add jitter (500ms–2000ms between sends) to avoid Postmark rate limits
- For larger campaigns, emails naturally queue and process over time

---

## Postmark Template Standards

### Naming Convention

**Format:** `brayford-{category}-{variant}`

**Examples:**

- `brayford-invitation-member` — Organization member invitation
- `brayford-invitation-owner` — Organization owner invitation (first user)
- `brayford-auth-password-reset` — Password reset link
- `brayford-auth-email-verification` — Email verification for new accounts
- `brayford-deletion-confirm` — Account deletion confirmation (with cancel link)
- `brayford-deletion-alert` — "Your account will be deleted in 30 days" warning
- `brayford-deletion-complete` — "Account deletion complete" confirmation
- `brayford-billing-invoice` — Monthly invoice email
- `brayford-marketing-product-update` — Product update newsletter
- `brayford-event-reminder` — Reminder for upcoming live event

**Rules:**

- Lowercase only
- Hyphens to separate words
- Start with `brayford-` prefix (brand namespace)
- Category groups related emails (e.g., `auth`, `invitation`, `billing`, `deletion`, `marketing`, `event`)

### Template Structure (Postmark Dashboard)

Each template must include:

1. **Subject Line:** UK English, dynamic variables in `{{ }}` syntax
2. **HTML Body:** Responsive design, tested on mobile/desktop
3. **Plain Text Body:** Always provide fallback (accessibility + spam filters)
4. **Variables:** Document all required variables in template description

**Example Template Variables Documentation:**

```
Template: brayford-invitation-member

Required Variables:
- organizationName (string): Name of the organization user is invited to
- inviterName (string): Full name of person who sent the invitation
- inviteLink (string): Full HTTPS URL to accept invitation (expires in 7 days)
- recipientEmail (string): Email address of invitee (for display/confirmation)

Optional Variables:
- customMessage (string): Personal message from inviter (defaults to empty)

Example Payload:
{
  "organizationName": "Acme Podcasts",
  "inviterName": "Sarah Smith",
  "inviteLink": "https://creator.projectbrayford.com/join/abc123def456",
  "recipientEmail": "john@example.com",
  "customMessage": "Looking forward to working with you!"
}
```

---

## Developer Workflow: Adding a New Email

### Step 1: Define Email Type

**File:** `packages/email-utils/src/types.ts`

```typescript
export type EmailType =
  | "invitation"
  | "password-reset"
  | "verification"
  | "organization-deletion"
  | "your-new-type-here"; // ← Add new type
// ...
```

### Step 2: Configure Rate Limit

**File:** `packages/email-utils/src/rate-limiter.ts`

```typescript
const RATE_LIMIT_CONFIGS: Record<EmailType, RateLimitConfig> = {
  "your-new-type-here": {
    maxPerMinute: 10, // Adjust based on expected volume
    scope: "organization", // 'user' | 'organization' | 'global'
  },
  // ...
};
```

### Step 3: Register Template in Registry

**File:** `packages/email-utils/src/templates/registry.ts`

```typescript
import { z } from "zod";

// Define schema for template variables
const YourNewEmailSchema = z.object({
  userName: z.string(),
  actionLink: z.string().url(),
  // ... other required fields
});

// Register template
export const TEMPLATES = {
  "brayford-category-variant": {
    alias: "brayford-category-variant",
    schema: YourNewEmailSchema,
    description: "Brief description of when this email is sent",
    requiredVariables: ["userName", "actionLink"],
  },
  // ...
} as const;
```

### Step 4: Create Helper Function (Optional)

**File:** `packages/email-utils/src/helpers/your-new-email.ts`

```typescript
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export interface YourNewEmailData {
  userName: string;
  actionLink: string;
}

/**
 * Queue a new email of this type
 */
export async function sendYourNewEmail(
  db: Firestore,
  to: string,
  data: YourNewEmailData,
  metadata: {
    userId: string;
    organizationId: string;
  },
): Promise<void> {
  await addDoc(collection(db, "emailQueue"), {
    type: "your-new-type-here",
    deliveryMode: "immediate", // or 'batch'
    status: "pending",
    to,
    templateAlias: "brayford-category-variant",
    templateData: data,
    metadata,
    createdAt: serverTimestamp(),
    attempts: 0,
  });
}
```

### Step 5: Create Postmark Template Documentation

**File:** `packages/email-utils/docs/templates/brayford-category-variant.md`

````markdown
# Template: brayford-category-variant

**Email Type:** `your-new-type-here`  
**Delivery Mode:** `immediate`  
**Rate Limit:** 10 per minute (per organization)

## Purpose

Explain when this email is sent and what user action triggers it.

## Template Variables

### Required

- `userName` (string): Full name of the recipient
- `actionLink` (string): HTTPS URL the user should click (e.g., confirmation link)

### Optional

- `supportEmail` (string): Defaults to `support@projectbrayford.com`

## Example Payload

\```json
{
"userName": "John Smith",
"actionLink": "https://creator.projectbrayford.com/confirm/abc123",
"supportEmail": "support@projectbrayford.com"
}
\```

## Subject Line

**UK English:** "Action Required: [Brief Description]"

## Copy Guidelines

- Use UK English (e.g., "organisation" not "organization")
- Friendly but professional tone
- Clear call-to-action button
- Include support contact in footer

## Postmark Setup

1. Create new template in Postmark dashboard
2. Set **Template Alias:** `brayford-category-variant`
3. Copy HTML/text from design brief
4. Add all variables to template description
5. Send test email with example payload
6. Verify mobile and desktop rendering
````

### Step 6: Add Tests

**File:** `packages/email-utils/src/__tests__/your-new-email.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { sendYourNewEmail } from "../helpers/your-new-email";

describe("sendYourNewEmail", () => {
  it("should queue email with correct fields", async () => {
    // Mock Firestore
    const mockAddDoc = vi.fn().mockResolvedValue({ id: "email-123" });

    await sendYourNewEmail(
      mockDb,
      "user@example.com",
      { userName: "John", actionLink: "https://..." },
      { userId: "user-123", organizationId: "org-456" },
    );

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "your-new-type-here",
        deliveryMode: "immediate",
        status: "pending",
        to: "user@example.com",
      }),
    );
  });
});
```

### Step 7: Update CHANGELOG.md

```markdown
## [Unreleased]

### Added

- **Email:** New `your-new-type-here` email for [describe use case]
```

---

## Testing Strategy

### Local Development (EMAIL_DEV_MODE=true)

1. Start Firebase Emulator: `pnpm firebase:emulators`
2. Queue test email by writing to `emailQueue` collection
3. Check Cloud Functions logs for console output:
   ```
   📧 [DEV MODE] Email queued but not sent
      To: test@example.com
      Template: brayford-invitation-member
      Data: { ... }
   ```
4. Verify rate limiting by queuing multiple emails rapidly

### Postmark Testing (Production-Like)

1. Set `EMAIL_DEV_MODE=false` in `/functions/.env`
2. Use Postmark's **Sandbox Server** (alternative API token that doesn't send)
3. Check Postmark dashboard for "sent" emails (won't actually deliver)
4. Verify template variable substitution

### Integration Tests

**File:** `functions/src/__tests__/email-functions.test.ts`

Test both Cloud Functions with emulated Firestore:

- Queue email → verify function processes it
- Test rate limit enforcement
- Test batch processing with 100+ emails
- Test error handling (invalid template, missing variables)

---

## Environment Variables

### Cloud Functions (`/functions/.env`)

```bash
# Postmark Configuration
POSTMARK_API_KEY=your-production-api-key-here
POSTMARK_FROM_EMAIL=noreply@projectbrayford.com
POSTMARK_FROM_NAME=Project Brayford

# Development Mode (logs to console instead of sending)
EMAIL_DEV_MODE=true  # Set to 'false' in production

# Optional: Override default rate limits (per minute)
EMAIL_RATE_LIMIT_INVITATION=10
EMAIL_RATE_LIMIT_PASSWORD_RESET=5
EMAIL_RATE_LIMIT_VERIFICATION=5
EMAIL_RATE_LIMIT_MARKETING=100
```

### Next.js Apps (`/apps/*/. env.local`)

**Note:** Apps don't send emails directly anymore, but keep for consistency:

```bash
# Email Development Mode (matches Cloud Functions setting)
EMAIL_DEV_MODE=true
```

---

## Security & Firestore Rules

### Write Access to `emailQueue`

```javascript
// firestore.rules
match /emailQueue/{emailId} {
  // Only authenticated users can queue emails
  allow create: if request.auth != null
                && request.resource.data.status == 'pending'
                && request.resource.data.attempts == 0
                && isValidEmail(request.resource.data.to);

  // Only Cloud Functions can update status
  allow update: if false; // Cloud Functions use Admin SDK (bypasses rules)

  // Users can read their own queued emails
  allow read: if request.auth != null
              && request.auth.uid == resource.data.metadata.userId;
}

function isValidEmail(email) {
  return email.matches('^[^@]+@[^@]+\\.[^@]+$');
}
```

**Admin SDK (Cloud Functions):** Bypasses all rules, can update any document.

---

## Migration Notes

### Existing Email-Sending Code

**Before (API Route):**

```typescript
// apps/creator/app/api/send-invitation/route.ts
await sendEmail({
  type: 'invitation',
  to: email,
  templateAlias: 'brayford-invitation-member',
  templateData: { ... },
});
```

**After (Cloud Functions Queue):**

```typescript
// apps/creator/app/actions/send-invitation.ts
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

await addDoc(collection(db, 'emailQueue'), {
  type: 'invitation',
  deliveryMode: 'immediate',
  status: 'pending',
  to: email,
  templateAlias: 'brayford-invitation-member',
  templateData: { ... },
  metadata: {
    userId: currentUser.uid,
    organizationId: org.id,
  },
  createdAt: serverTimestamp(),
  attempts: 0,
});
```

**UI Change:** Optionally listen to document status for real-time feedback:

```typescript
const emailRef = doc(db, "emailQueue", emailId);
onSnapshot(emailRef, (snap) => {
  if (snap.data()?.status === "sent") {
    toast.success("Invitation sent!");
  }
});
```

---

## Performance Considerations

### Firestore Costs

- **Write cost:** 1 write per email queued + 1 write per status update = ~2 writes/email
- **Read cost:** Batch function reads 50 emails per minute
- **Estimated monthly cost (10,000 transactional emails/month):**
  - Writes: 20,000 writes = ~£0.15
  - Reads: Negligible
  - **Total: < £1/month for moderate volume**

### Cloud Functions Costs

- **Transactional function:** Invoked per email (sub-second execution)
- **Batch function:** Runs every minute (60 invocations/hour = 1,440/day)
- **Estimated monthly cost (10,000 emails/month + 50,000 invocations):**
  - Compute time: ~£0.50
  - Invocations: ~£0.10
  - **Total: < £1/month**

### Postmark Costs

- Separate from Firebase, charged per email sent
- Rate limits protect against accidental overage

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Email queue depth:** Count of `status == 'pending'` documents (should be near-zero)
2. **Failure rate:** Count of `status == 'failed'` over time
3. **Rate limit hits:** Count of `status == 'rate-limited'`
4. **Average processing time:** `sentAt - createdAt` for immediate emails

### Firestore Dashboard Query

```javascript
// Count pending emails (should be < 10 under normal load)
db.collection("emailQueue").where("status", "==", "pending").count();
```

### Cloud Functions Logs (GCP Console)

Filter for errors:

```
resource.type="cloud_function"
resource.labels.function_name="processTransactionalEmail"
severity="ERROR"
```

---

## Common Issues & Troubleshooting

### Issue: Emails stuck in `pending` status

**Causes:**

- Cloud Functions not deployed
- Function crashed due to missing environment variables
- Firestore indexes not created

**Fix:**

1. Check Cloud Functions logs for errors
2. Verify `EMAIL_DEV_MODE` and `POSTMARK_API_KEY` set in `/functions/.env`
3. Deploy indexes: `firebase deploy --only firestore:indexes`

### Issue: Rate limit always exceeded

**Causes:**

- Rate limit window not resetting properly
- Multiple users sharing same scope (e.g., same organization)

**Fix:**

1. Check `_rateLimits` subcollection documents
2. Manually reset window: Update `windowStart` to current timestamp
3. Adjust rate limits in `rate-limiter.ts` if legitimate traffic

### Issue: Dev mode not working (emails still sent)

**Causes:**

- `EMAIL_DEV_MODE` not set in `/functions/.env` (only app `.env.local`)
- Environment variable casing incorrect

**Fix:**

1. Ensure `/functions/.env` has `EMAIL_DEV_MODE=true`
2. Redeploy functions: `firebase deploy --only functions`
3. Check function logs to confirm dev mode active

---

## Success Criteria

- [x] Transactional emails send within 2 seconds of queuing
- [x] Batch emails process at predictable rate (50/minute minimum)
- [x] Rate limiting prevents abuse without blocking legitimate use
- [x] Dev mode logs emails without sending (tested locally)
- [x] Failed emails automatically retry up to 3 times
- [x] Complete audit trail in Firestore for debugging
- [x] Zero emails lost due to API downtime
- [x] Clear documentation for adding new email types

---

## Next Steps (Post-Implementation)

1. **Monitoring Dashboard:** Build admin UI to view pending/failed emails
2. **Email Analytics:** Track open rates via Postmark webhooks
3. **User Preferences:** Allow users to unsubscribe from marketing emails
4. **Template Versioning:** Support A/B testing different email copy
5. **Multi-language Support:** Internationalize templates for non-UK users

---

## Questions or Feedback?

See [EMAIL_INFRASTRUCTURE.md](./EMAIL_INFRASTRUCTURE.md) for original design, or discuss in team chat.
