# Domain Model & Schema Design

**Project Brayford** | Live Event Engagement Platform  
_Last Updated: February 2026_

---

## Table of Contents

1. [Domain Architecture](#domain-architecture)
2. [Core Domains](#core-domains)
3. [Domain Relationships](#domain-relationships)

---

## Domain Architecture

### What is a Domain?

A **domain** (or bounded context) represents a distinct area of business logic with its own:

- Data models (collections/schemas)
- Business rules
- Terminology
- Responsibilities

Each domain should be as independent as possible to enable parallel development and clearer reasoning.

---

## Core Domains

Our application features seven core domains:

### 1. **Identity & Access Domain**

**Responsibility:** User registration, authentication, profile management

**Key Concepts:**

- Users (individuals who log in—e.g., Sarah, Jimmy Donaldson)
- Roles & permissions (owner, admin, member)
- Granular capability-based permissions system (see [PERMISSIONS.md](./PERMISSIONS.md))
- Authentication sessions
- User profiles

**Why separate?** Authentication is foundational—it touches everything but should remain isolated for security.

---

### 2. **Organization Domain**

**Responsibility:** Top-level account management, multi-brand hierarchies, team management

**Key Concepts:**

- Organizations (the paying customer—e.g., "BBC", "MrBeast LLC")
- Organization membership (connecting users to organizations with roles)
- Brands (public-facing brands—e.g., "Goal Hanger", "MrBeast Gaming")
- Team permissions & brand-level access (26 granular permissions across 5 domains)
- Organization settings

**Why separate?** Organizations are the actual customers. Some will have one user and one brand (solo podcaster), others will have multiple team members managing multiple brands (BBC). This domain handles all that complexity.

---

### 3. **Event Management Domain**

**Responsibility:** Creating and configuring live events

**Key Concepts:**

- Events (the actual live show/recording)
- Event templates (reusable configs)
- QR codes for audience entry
- Event lifecycle (draft → live → archived)
- Scheduling & timezones

**Why separate?** Events are the core product—but they're complex enough to deserve their own domain.

---

### 4. **Interaction Domain**

**Responsibility:** Real-time audience engagement modules

**Key Concepts:**

- Modules (Q&A, polling, reactions, voting)
- Module instances (a specific poll within a specific event)
- Module state (active, paused, closed)
- Interaction data structure (questions, votes, reactions)

**Why separate?** This is where the platform's uniqueness lives. Modules need to be plugin-like and extensible.

---

### 5. **Audience Domain**

**Responsibility:** Attendee sessions, profiles, participation tracking

**Key Concepts:**

- Participants (attendees at events—anonymous or identified)
- Session tracking (who's currently "in the room")
- Participation history (interactions per person)
- Email capture & consent

**Why separate?** Audience data has different privacy/compliance needs than creator data.

---

### 6. **Billing & Subscriptions Domain**

**Responsibility:** Payments, plans, invoicing, usage tracking

**Key Concepts:**

- Subscriptions (belong to Organizations, not individual Users)
- Subscription plans (tiers: Free, Pro, Enterprise)
- Payment methods (card vs. invoice)
- Usage metering (events per month, participants per event)
- Invoices & payment history
- Credits/overage handling

**Why separate?** Revenue is critical but shouldn't pollute event logic. Organizations pay, not individual users. This domain can evolve independently (e.g., adding new billing providers).

---

### 7. **Analytics & Reporting Domain**

**Responsibility:** Aggregating data for insights and exports

**Key Concepts:**

- Event statistics (attendance, engagement rates)
- Lead generation reports (email captures, conversion funnels)
- Interaction analytics (most popular questions, poll results)
- Organization-level analytics (across all brands and events)
- Export formats (CSV, PDF reports)

**Why separate?** Analytics often require data transformations and aggregations that shouldn't slow down real-time operations.

---

## Domain Relationships

> **Note:** For detailed Firestore schemas, field types, and validation rules, see the TypeScript schema definitions in `packages/core/src/schemas/`. The schemas are the single source of truth for data structure.

### Hierarchy Flow

```
Organization (the paying customer: BBC, MrBeast LLC, Jane Smith Productions)
  ├── Users (team members: Sarah, Jimmy, Jane)
  │    └── Roles (owner, admin, member)
  ├── Subscription (how they pay)
  │    └── Usage Records (what they consume)
  └── Brands (public brands: Goal Hanger, MrBeast Gaming)
       └── Events (live shows)
            ├── Modules (Q&A, polls, etc.)
            │    └── Interactions (questions, votes)
            └── Participants (audience members)
                 └── Email Captures (leads)
```

### Real-World Examples

**Solo Creator (Jane Smith):**

- Organization: "Jane Smith Productions"
- Users: Jane (owner)
- Brands: "The Jane Show"
- Jane logs in, manages her one brand, creates events

**Content Brand (MrBeast):**

- Organization: "MrBeast LLC"
- Users: Jimmy Donaldson (owner), + 5 team members (admin/member)
- Brands: "MrBeast", "MrBeast Gaming", "Beast Philanthropy"
- Any team member can create events for brands they have access to

**Media Company (BBC):**

- Organization: "BBC"
- Users: 20+ employees (1 owner, 5 admins, 14 members)
- Brands: "Goal Hanger", "The Rest is Politics", etc.
- Different team members have access to different brands

### Cross-Domain Dependencies

| Domain           | Depends On       | Why                                                          |
| ---------------- | ---------------- | ------------------------------------------------------------ |
| Organization     | Identity         | Users must exist before they can create/join organizations   |
| Event Management | Organization     | Events belong to brands, which belong to organizations       |
| Interaction      | Event Management | Modules live within events                                   |
| Audience         | Event Management | Participants join events                                     |
| Billing          | Organization     | Subscriptions belong to organizations (not individual users) |
| Analytics        | All domains      | Aggregates data from everywhere                              |

---

## Design Principles

### 1. Denormalization Strategy

**Where to duplicate data:**

- Store `organizationId` on events (even though we have `brandId`) for fast "show me all events in my org" queries
- Cache participant counts on event documents to avoid aggregation queries

**Trade-off:** Slightly more complex writes, vastly faster reads (critical for real-time)

### 2. Security Rules Alignment

Each domain maps to a Firestore security rule block:

```javascript
// Example
match /events/{eventId} {
  allow read: if userBelongsToEventOrganization();
  allow create: if isAuthenticated() && userHasAccessToBrand();
  allow update: if userBelongsToEventOrganization() && hasPermission('admin');
}
```

### 3. API Organization

Consider structuring your API routes to mirror domains:

```
/api/organizations/*
/api/events/*
/api/interactions/*
/api/billing/*
```

---

---

## Terminology Clarification

- **User** = Individual person who logs in (Sarah, Jimmy, Jane)
- **Organization** = The paying customer / account (BBC, MrBeast LLC, Jane Smith Productions)
- **Brand** = Public-facing content brand (Goal Hanger, MrBeast Gaming)
- **Participant** = Audience member at an event

---

## Next Steps

- See [ROADMAP.md](./ROADMAP.md) for implementation phases and priorities
- See [PERMISSIONS.md](./PERMISSIONS.md) for detailed permission system and role definitions
- See `packages/core/src/schemas/` for detailed data schemas (single source of truth)
- See [DEVELOPER_STANDARDS.md](./DEVELOPER_STANDARDS.md) for coding patterns and conventions
