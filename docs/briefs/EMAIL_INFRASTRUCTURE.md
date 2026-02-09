# Email Infrastructure - Technical Brief

**Package:** `@brayford/email-utils`  
**Created:** 9 February 2026  
**Status:** Planning → Implementation → Testing → Complete

---

## Purpose

Create a general-purpose email-sending utility package that provides a foundation for all transactional and bulk email operations across Project Brayford. This package abstracts Postmark integration, provides rate limiting, supports development workflows, and prepares for future internationalisation.

---

## Scope

### Phase 1: MVP (This Implementation)

**Included:**

- ✅ Core email sending via Postmark API
- ✅ Postmark template alias support (templates managed in Postmark dashboard)
- ✅ TypeScript types and Zod schemas for email payloads
- ✅ Development mode (console logging instead of sending)
- ✅ Basic rate limiting for transactional emails (per-user/org throttling)
- ✅ i18n-ready architecture (UK English only for MVP)
- ✅ Comprehensive unit tests with mocked Postmark client
- ✅ Integration with project's existing branded types pattern

**Deferred to Phase 2:**

- ⏳ Cloud Tasks/Pub/Sub integration for bulk email queuing
- ⏳ Firestore-based distributed rate limiting (multi-instance resilience)
- ⏳ Email delivery tracking and webhooks
- ⏳ Email template versioning and A/B testing
- ⏳ Retry logic with exponential backoff
- ⏳ Multiple language support (translations)
- ⏳ Email analytics (open rates, click tracking)

---

## Architecture

### Package Structure

```
packages/email-utils/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                 # Main exports
│   ├── client.ts                # Postmark client wrapper
│   ├── types.ts                 # TypeScript types & branded IDs
│   ├── schemas.ts               # Zod validation schemas
│   ├── rate-limiter.ts          # Rate limiting primitives
│   ├── templates/
│   │   ├── index.ts             # Template type definitions
│   │   └── registry.ts          # Template configuration registry
│   ├── utils/
│   │   ├── dev-mode.ts          # Development console logger
│   │   └── validation.ts        # Email validation helpers
│   └── __tests__/
│       ├── client.test.ts
│       ├── rate-limiter.test.ts
│       └── helpers/
│           └── mock-postmark.ts # Postmark client mock
└── .env.example
```

---

## API Design

### Core Email Sending

```typescript
import { sendEmail, EmailType } from "@brayford/email-utils";

// Send a transactional email
await sendEmail({
  type: "invitation",
  to: "user@example.com",
  templateAlias: "organization-invitation",
  templateData: {
    organizationName: "Acme Corp",
    inviterName: "Sarah Smith",
    inviteLink: "https://brayford.app/join/abc123",
  },
  metadata: {
    organizationId: "org-123",
    invitedBy: "user-456",
  },
});
```

### Email Types & Rate Limiting

```typescript
// Email type definitions with rate limit configs
export type EmailType =
  | "invitation" // 10/min per org
  | "password-reset" // 5/min per user
  | "verification" // 5/min per user
  | "event-reminder" // Bulk - queued
  | "weekly-digest" // Bulk - queued
  | "marketing" // Bulk - queued
  | "billing-invoice"; // Immediate

// Rate limit configuration per email type
const EMAIL_RATE_LIMITS: Record<EmailType, RateLimitConfig> = {
  invitation: { maxPerMinute: 10, scope: "organization" },
  "password-reset": { maxPerMinute: 5, scope: "user" },
  // ... etc
};
```

### Rate Limiting API

```typescript
import { withRateLimit } from "@brayford/email-utils";

// Automatic rate limiting based on email type
await withRateLimit(
  async () =>
    sendEmail({
      /* ... */
    }),
  {
    type: "invitation",
    scopeId: "org-123", // organization ID
  },
);
```

### Development Mode

```typescript
// In .env
EMAIL_DEV_MODE = true; // Logs to console instead of sending
EMAIL_DEV_MODE = false; // Actually sends emails

// Behaviour in dev mode:
// - Respects rate limits (validates logic)
// - Logs formatted email details to console
// - Returns mock success responses
// - No actual API calls to Postmark
```

---

## Rate Limiting Strategy

### Phase 1: Simple In-Memory Rate Limiter

**For transactional emails only** (invitations, password resets, verification):

- In-memory sliding window counter per scope (org/user)
- Works well for single-instance Firebase Functions (cold start = reset counter)
- Prevents basic abuse without complex infrastructure
- Configurable limits per email type

**Implementation:**

```typescript
interface RateLimitConfig {
  maxPerMinute: number;
  scope: "user" | "organization" | "global";
}

class RateLimiter {
  private counters: Map<string, { count: number; resetAt: Date }>;

  async checkLimit(
    type: EmailType,
    scopeId: string,
  ): Promise<{ allowed: boolean; retryAfter?: number }>;
}
```

### Phase 2: Distributed Rate Limiting (Deferred)

**For production scale and bulk emails:**

- Firestore document per scope tracking request counts
- Cloud Tasks for bulk email queuing with configurable delays
- Distributed locks for concurrent function instances
- Exponential backoff for Postmark API errors

**Hook for future implementation:**

```typescript
// API designed to support future queuing
interface SendEmailOptions {
  type: EmailType;
  to: string;
  // ... other fields

  // Future: add queue options
  queueOptions?: {
    delay?: number; // Delay in ms before sending
    scheduledAt?: Date; // Send at specific time
    priority?: "high" | "normal" | "low";
  };
}
```

---

## Branded Types

Following project conventions from `@brayford/core`:

```typescript
export type EmailId = string & { readonly __brand: "EmailId" };

export interface EmailMetadata {
  emailId: EmailId;
  sentAt: Date;
  type: EmailType;
  recipientEmail: string;
  templateAlias: string;
  organizationId?: OrganizationId;
  userId?: UserId;
  eventId?: EventId;
}
```

---

## Zod Schemas

All inputs validated with Zod:

```typescript
export const SendEmailSchema = z.object({
  type: z.enum(["invitation", "password-reset" /* ... */]),
  to: z.string().email(),
  templateAlias: z.string().min(1),
  templateData: z.record(z.unknown()), // Template-specific data
  from: z
    .object({
      email: z.string().email().optional(),
      name: z.string().optional(),
    })
    .optional(),
  replyTo: z.string().email().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;
```

---

## Template Management

### Postmark Dashboard Templates

Templates are created and managed in Postmark dashboard with **template aliases**:

```
organization-invitation     → Invitation to join organization
password-reset             → Password reset link
email-verification         → Email verification link
event-reminder             → Reminder before live event
weekly-digest              → Weekly creator summary
billing-invoice            → Payment receipt
```

### Template Registry (Type Safety)

```typescript
// src/templates/registry.ts
export interface TemplateDefinition {
  alias: string;
  displayName: string;
  description: string;
  requiredData: string[]; // Required template variables
  locale: "en-GB"; // Prepare for future locales
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  "organization-invitation": {
    alias: "organization-invitation",
    displayName: "Organisation Invitation",
    description: "Invite user to join organisation",
    requiredData: ["organizationName", "inviterName", "inviteLink"],
    locale: "en-GB",
  },
  // ... more templates
};

// Type-safe template validation
export function validateTemplateData(
  alias: string,
  data: Record<string, unknown>,
): void {
  const template = TEMPLATES[alias];
  if (!template) throw new Error(`Unknown template: ${alias}`);

  const missing = template.requiredData.filter((key) => !(key in data));
  if (missing.length > 0) {
    throw new Error(`Missing template data: ${missing.join(", ")}`);
  }
}
```

---

## i18n Preparation

Architecture supports future multi-language:

```typescript
interface SendEmailOptions {
  // ...
  locale?: string; // e.g., 'en-GB', 'en-US', 'fr-FR'
}

// Template aliases with locale suffix (future)
// 'invitation-en-GB'
// 'invitation-fr-FR'

// For now: all templates use en-GB (UK English)
const DEFAULT_LOCALE = "en-GB";
```

When multi-language is needed:

1. Create Postmark templates for each locale
2. Add locale parameter to `sendEmail()`
3. Template registry maps locale → template alias
4. No code changes to core sending logic

---

## Testing Strategy

### Unit Tests (Mocked Postmark)

```typescript
// __tests__/client.test.ts
import { sendEmail } from "../client";
import { mockPostmarkClient } from "./helpers/mock-postmark";

describe("sendEmail", () => {
  beforeEach(() => {
    mockPostmarkClient.reset();
  });

  it("sends email with template data", async () => {
    await sendEmail({
      type: "invitation",
      to: "user@example.com",
      templateAlias: "organization-invitation",
      templateData: {
        /* ... */
      },
    });

    expect(mockPostmarkClient.sendEmailWithTemplate).toHaveBeenCalledWith({
      TemplateAlias: "organization-invitation",
      To: "user@example.com",
      // ...
    });
  });

  it("validates required template data", async () => {
    await expect(
      sendEmail({
        type: "invitation",
        to: "user@example.com",
        templateAlias: "organization-invitation",
        templateData: {}, // Missing required fields
      }),
    ).rejects.toThrow("Missing template data");
  });
});
```

### Dev Mode Testing (Manual)

```bash
EMAIL_DEV_MODE=true pnpm dev

# Console output:
# ┌─────────────────────────────────────────┐
# │ 📧 EMAIL (DEV MODE - NOT SENT)          │
# ├─────────────────────────────────────────┤
# │ Type: invitation                        │
# │ To: user@example.com                    │
# │ Template: organization-invitation       │
# │ Data: { organizationName: 'Acme Corp' } │
# └─────────────────────────────────────────┘
```

### Integration Tests (Postmark Sandbox)

```typescript
// __tests__/integration/postmark.integration.test.ts
// Only runs when POSTMARK_API_KEY is set

describe("Postmark Integration", () => {
  it("sends real email to sandbox", async () => {
    const result = await sendEmail({
      type: "invitation",
      to: "sandbox@postmarkapp.com", // Postmark test address
      templateAlias: "organization-invitation",
      templateData: {
        /* ... */
      },
    });

    expect(result.messageId).toBeDefined();
  });
});
```

### Rate Limiter Tests

```typescript
// __tests__/rate-limiter.test.ts
describe("RateLimiter", () => {
  it("blocks requests exceeding limit", async () => {
    const limiter = new RateLimiter();

    // Send 10 invitations (limit)
    for (let i = 0; i < 10; i++) {
      const result = await limiter.checkLimit("invitation", "org-123");
      expect(result.allowed).toBe(true);
    }

    // 11th should be blocked
    const blocked = await limiter.checkLimit("invitation", "org-123");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets counter after time window", async () => {
    // Test sliding window behaviour
  });
});
```

---

## Environment Variables

### Required Variables

```bash
# .env.example
# Postmark API Configuration
POSTMARK_API_KEY=your-postmark-server-token-here
POSTMARK_FROM_EMAIL=noreply@brayford.app
POSTMARK_FROM_NAME=Brayford Platform

# Development Mode
EMAIL_DEV_MODE=true  # Set to 'false' in production

# Optional: Override default rate limits
EMAIL_RATE_LIMIT_INVITATION=10      # per minute per org
EMAIL_RATE_LIMIT_PASSWORD_RESET=5   # per minute per user
```

### Environment-Specific Config

```typescript
export const emailConfig = {
  postmark: {
    apiKey: process.env.POSTMARK_API_KEY!,
    fromEmail: process.env.POSTMARK_FROM_EMAIL || "noreply@brayford.app",
    fromName: process.env.POSTMARK_FROM_NAME || "Brayford Platform",
  },
  devMode: process.env.EMAIL_DEV_MODE === "true",
  rateLimits: {
    invitation: parseInt(process.env.EMAIL_RATE_LIMIT_INVITATION || "10"),
    "password-reset": parseInt(
      process.env.EMAIL_RATE_LIMIT_PASSWORD_RESET || "5",
    ),
  },
};

// Validation on startup
if (!emailConfig.postmark.apiKey && !emailConfig.devMode) {
  throw new Error("POSTMARK_API_KEY is required when EMAIL_DEV_MODE=false");
}
```

---

## Integration Points

### Use in Firebase Functions

```typescript
// functions/src/organization/onMemberInvited.ts
import { sendEmail } from "@brayford/email-utils";
import { db } from "firebase-admin/firestore";

export const onOrganizationMemberInvited = onDocumentCreated(
  "organizationMembers/{memberId}",
  async (event) => {
    const member = event.data?.data();
    if (!member?.invitedAt) return; // Not an invite

    const org = await db
      .collection("organizations")
      .doc(member.organizationId)
      .get();
    const inviter = await db.collection("users").doc(member.invitedBy).get();

    await sendEmail({
      type: "invitation",
      to: member.email,
      templateAlias: "organization-invitation",
      templateData: {
        organizationName: org.data()?.name,
        inviterName: inviter.data()?.displayName,
        inviteLink: `https://brayford.app/join/${member.inviteToken}`,
      },
      metadata: {
        organizationId: member.organizationId,
        invitedBy: member.invitedBy,
      },
    });
  },
);
```

### Use in Next.js API Routes (Future)

```typescript
// apps/creator/app/api/auth/reset-password/route.ts
import { sendEmail } from "@brayford/email-utils";

export async function POST(req: Request) {
  const { email } = await req.json();

  // Generate reset token...

  await sendEmail({
    type: "password-reset",
    to: email,
    templateAlias: "password-reset",
    templateData: {
      resetLink: `https://brayford.app/reset/${token}`,
      expiresIn: "1 hour",
    },
  });

  return Response.json({ success: true });
}
```

---

## Dependencies

```json
{
  "dependencies": {
    "@brayford/core": "workspace:*",
    "postmark": "^4.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

---

## Success Criteria

- [ ] Package published to workspace and importable by all apps
- [ ] Can send emails via Postmark with template aliases
- [ ] Dev mode logs emails to console (no actual sends)
- [ ] Rate limiting prevents abuse (10 invites/min per org)
- [ ] 70%+ test coverage with mocked Postmark client
- [ ] TypeScript strict mode passes with no errors
- [ ] Documentation in package README for developers
- [ ] Environment variables documented in `.env.example`
- [ ] Template registry provides type-safe validation
- [ ] Graceful error handling for Postmark API failures

---

## Future Enhancements (Phase 2)

### Bulk Email Queuing

```typescript
// Use Cloud Tasks for queued delivery
await sendEmail({
  type: "event-reminder",
  to: attendees, // Array of 5000 emails
  queueOptions: {
    batchSize: 100, // Send 100 at a time
    delayBetweenBatches: 60000, // 1 minute between batches
  },
});
```

### Email Delivery Tracking

```typescript
interface EmailStatus {
  delivered: boolean;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  bounceReason?: string;
}

// Query delivery status
const status = await getEmailStatus(emailId);
```

### Template Versioning

```typescript
// A/B test different email templates
await sendEmail({
  templateAlias: "invitation",
  templateVersion: "v2", // Use version 2 of template
});
```

### Distributed Rate Limiting

```typescript
// Firestore-based rate limiting for multi-instance functions
await withDistributedRateLimit(
  async () =>
    sendEmail({
      /* ... */
    }),
  {
    type: "invitation",
    scopeId: "org-123",
    strategy: "firestore", // Instead of in-memory
  },
);
```

---

## Timeline Estimate

- **Package scaffolding**: 2 hours
- **Core Postmark integration**: 4 hours
- **Rate limiting implementation**: 3 hours
- **Dev mode + logging**: 2 hours
- **Template registry + validation**: 2 hours
- **Unit tests**: 4 hours
- **Integration tests**: 2 hours
- **Documentation**: 2 hours

**Total:** ~21 hours (3 days)

---

## Related Documentation

- [Domain Model](./DOMAIN_MODEL.md) - See Identity & Access Domain for user/email concepts
- [Developer Standards](./DEVELOPER_STANDARDS.md) - TypeScript patterns, testing requirements
- [Roadmap](./ROADMAP.md) - Email infrastructure in Phase 1, bulk sending in Phase 5

---

## Notes

- UK English only for MVP (all templates use en-GB)
- Postmark templates managed in Postmark dashboard, not in code
- Rate limiting is per-type, not global (invitations have different limits than password resets)
- Dev mode is critical for fast iteration without spamming test inboxes
- Design intentionally supports future Cloud Tasks integration without breaking changes
