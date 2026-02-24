# Billing & Subscriptions

**Project Brayford** | Billing Architecture & Commercial Model  
_Last Updated: 24 February 2026_

---

## Overview

Billing in Project Brayford operates at the **Organisation** level — organisations are the paying customer, not individual users. All billing concepts are stored directly on the `Organization` Firestore document.

There are currently three independent billing-related fields on an Organisation, each representing a different dimension of the commercial relationship:

| Field           | Values                                 | Describes                               |
| --------------- | -------------------------------------- | --------------------------------------- |
| `billingMethod` | `enterprise` \| `self_serve`           | **How the org pays** (invoice vs. card) |
| `billingTier`   | `per_brand` \| `flat_rate`             | **What they pay for** (pricing model)   |
| `type`          | `individual` \| `team` \| `enterprise` | **Size/structure** of the organisation  |

These fields are intentionally separate — an enterprise-billed organisation could be any size, and pricing tier is auto-assigned at signup regardless of billing method.

---

## Billing Method

The `billingMethod` field determines how an organisation is charged and what onboarding route they came through.

### `enterprise`

- **Onboarding:** Sales-assisted. Organisation is provisioned by a Project Brayford superAdmin.
- **Payment:** Invoiced periodically (monthly or otherwise agreed). No card details required.
- **Target:** Broadcasters, media companies, agencies — customers where a procurement process or formal contract is involved.
- **Advantages for us:** No payment infrastructure needed to get started. We can onboard paying customers immediately and invoice them manually until automated billing is built out.

### `self_serve`

- **Onboarding:** Self-signup via the public website.
- **Payment:** Card on file, charged automatically.
- **Target:** Independent creators, podcasters, small production companies.
- **Advantages for us:** Lower friction, scalable without sales involvement.

### Setting the billing method

`billingMethod` is set at organisation creation time and should only be changeable by a superAdmin — it is not a user-configurable field.

- Organisations created via the **Admin app** by a superAdmin default to `enterprise`.
- Organisations created via the **self-signup flow** (not yet built) default to `self_serve`.

---

## Billing Tier

The `billingTier` field determines the pricing _model_ and is auto-assigned at org creation based on the founder's email domain. See [PERMISSIONS.md](./PERMISSIONS.md) for the full detail on how this works, including domain enforcement rules.

| Tier        | Domain Type                       | Pricing                               | Domain Enforcement     |
| ----------- | --------------------------------- | ------------------------------------- | ---------------------- |
| `per_brand` | Free email (Gmail, Hotmail, etc.) | Pay per brand created                 | None                   |
| `flat_rate` | Corporate/work domain             | Monthly flat fee, ~10 brands included | Optionally enforceable |

`billingTier` is immutable after org creation and cannot be changed by users or admins.

---

## Organisation Type

The `type` field (`individual | team | enterprise`) describes the _structure_ of the organisation (headcount, typical brand count) rather than anything billing-specific. It may be used in future to gate certain features but is not currently enforced.

---

## Organisation Schema (billing-relevant fields)

```typescript
{
  billingMethod: 'enterprise' | 'self_serve',  // How the org pays
  billingTier: 'per_brand' | 'flat_rate',       // Pricing model (auto-assigned, immutable)
  billingEmail: string,                          // Where invoices are sent
  type: 'individual' | 'team' | 'enterprise',   // Org size/structure
}
```

> The authoritative schema definition lives in `packages/core/src/schemas/organization.schema.ts`.

---

## Future Considerations

The following are anticipated but not yet designed or built:

- **Subscription plans** — named tiers (e.g. Starter, Pro, Enterprise) with usage limits per plan
- **Usage metering** — tracking events per month, peak concurrent audience, etc.
- **Payment provider integration** — Stripe is the likely candidate for self-serve billing
- **Invoice management** — generating and storing PDF invoices for enterprise accounts
- **Trial periods** — time-limited access before conversion
- **Upgrade/downgrade flows** — moving between billing methods or tiers
- **Usage overage handling** — credits, caps, or automated tier upgrades

---

## Outstanding Questions

- Should `billingMethod` eventually replace or fully absorb the `type` field, given there is overlap in the `enterprise` value? Or should they remain separate concerns?
- What usage limits (if any) apply per `billingMethod`? For example, do self-serve orgs have a participant cap that enterprise orgs do not?
