# @brayford/email-utils

General-purpose email sending utility for Project Brayford. Provides Postmark integration, rate limiting, development mode, and i18n-ready architecture.

## Installation

This package is part of the Project Brayford monorepo:

```bash
pnpm add @brayford/email-utils --workspace
```

## Quick Start

```typescript
import { sendEmail } from "@brayford/email-utils";

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

## Environment Variables

Required environment variables:

```bash
# Postmark API Configuration
POSTMARK_API_KEY=your-postmark-server-token
POSTMARK_FROM_EMAIL=noreply@brayford.app
POSTMARK_FROM_NAME=Brayford Platform

# Development Mode (logs to console instead of sending)
EMAIL_DEV_MODE=true  # Set to 'false' in production
```

## Email Types

The package supports different email types with built-in rate limiting:

- `invitation` - Organisation member invitations (10/min per org)
- `password-reset` - Password reset requests (5/min per user)
- `verification` - Email verification (5/min per user)
- `event-reminder` - Event reminders (bulk, queued)
- `weekly-digest` - Weekly summaries (bulk, queued)
- `marketing` - Marketing campaigns (bulk, queued)
- `billing-invoice` - Payment receipts (immediate)

## Development Mode

When `EMAIL_DEV_MODE=true`, emails are logged to the console instead of being sent:

```
┌─────────────────────────────────────────┐
│ 📧 EMAIL (DEV MODE - NOT SENT)          │
├─────────────────────────────────────────┤
│ Type: invitation                        │
│ To: user@example.com                    │
│ Template: organization-invitation       │
│ Data: { organizationName: 'Acme Corp' } │
└─────────────────────────────────────────┘
```

## Rate Limiting

Transactional emails have automatic rate limiting to prevent abuse:

```typescript
import { withRateLimit } from "@brayford/email-utils";

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

## Template Management

Email templates are managed in the Postmark dashboard. The template registry provides type-safe validation:

```typescript
import {
  TEMPLATES,
  validateTemplateData,
} from "@brayford/email-utils/templates";

// Validates that all required template variables are present
validateTemplateData("organization-invitation", {
  organizationName: "Acme Corp",
  inviterName: "Sarah",
  inviteLink: "https://...",
});
```

## API Reference

### `sendEmail(options: SendEmailOptions): Promise<EmailResult>`

Send an email using a Postmark template.

**Parameters:**

- `type` - Email type (affects rate limiting)
- `to` - Recipient email address
- `templateAlias` - Postmark template alias
- `templateData` - Template variables (validated against registry)
- `from` (optional) - Override default sender
- `replyTo` (optional) - Reply-to address
- `metadata` (optional) - Additional tracking data

**Returns:** Promise resolving to email result with message ID.

### `withRateLimit(fn: () => Promise<T>, options: RateLimitOptions): Promise<T>`

Execute a function with rate limiting.

**Parameters:**

- `fn` - Async function to execute
- `options.type` - Email type (determines limit)
- `options.scopeId` - Scope identifier (user/org ID)

**Returns:** Promise resolving to function result or throwing if rate limit exceeded.

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Future Enhancements

See [docs/briefs/EMAIL_INFRASTRUCTURE.md](../../docs/briefs/EMAIL_INFRASTRUCTURE.md) for planned Phase 2 features:

- Cloud Tasks integration for bulk email queuing
- Distributed rate limiting with Firestore
- Email delivery tracking and webhooks
- Template versioning and A/B testing
- Multi-language support

## License

Private - Project Brayford
