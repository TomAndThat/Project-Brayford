/**
 * Branded type utility for type-safe IDs
 * 
 * This creates nominally-typed strings that TypeScript treats as distinct types,
 * preventing accidental usage of wrong ID types (e.g., passing UserId where EventId is expected).
 * 
 * The __brand property only exists at compile-time for type-checking.
 * At runtime, these are just regular strings.
 * 
 * @example
 * ```ts
 * type UserId = Brand<string, 'UserId'>;
 * type EventId = Brand<string, 'EventId'>;
 * 
 * const userId: UserId = 'abc123' as UserId;
 * const eventId: EventId = 'xyz789' as EventId;
 * 
 * function getEvent(id: EventId) { ... }
 * getEvent(userId); // ❌ TypeScript error: UserId not assignable to EventId
 * getEvent(eventId); // ✅ OK
 * ```
 */
export type Brand<T, TBrand extends string> = T & {
  readonly __brand: TBrand;
};

/**
 * Identity & Access Domain
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Organization Domain
 */
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type OrganizationMemberId = Brand<string, 'OrganizationMemberId'>;
export type BrandId = Brand<string, 'BrandId'>;
export type InvitationId = Brand<string, 'InvitationId'>;

/**
 * Event Management Domain
 */
export type EventId = Brand<string, 'EventId'>;
export type QRCodeId = Brand<string, 'QRCodeId'>;

/**
 * Interaction Domain
 */
export type ModuleId = Brand<string, 'ModuleId'>;
export type InteractionId = Brand<string, 'InteractionId'>;

/**
 * Audience Domain
 */
export type ParticipantId = Brand<string, 'ParticipantId'>;
export type EmailCaptureId = Brand<string, 'EmailCaptureId'>;

/**
 * Billing Domain
 */
export type SubscriptionId = Brand<string, 'SubscriptionId'>;
export type UsageRecordId = Brand<string, 'UsageRecordId'>;
export type InvoiceId = Brand<string, 'InvoiceId'>;

/**
 * Helper to cast a string to a branded type
 * Use this when receiving data from external sources (Firestore, API, etc.)
 * 
 * @example
 * ```ts
 * const rawId = firestore.collection('users').doc().id;
 * const userId = toBranded<UserId>(rawId);
 * ```
 */
export function toBranded<T extends Brand<string, string>>(value: string): T {
  return value as T;
}

/**
 * Helper to extract the raw string from a branded type
 * Use when you need the plain string value (e.g., for Firestore queries)
 * 
 * @example
 * ```ts
 * const userId: UserId = ...;
 * const docRef = firestore.collection('users').doc(fromBranded(userId));
 * ```
 */
export function fromBranded<T extends Brand<string, string>>(value: T): string {
  return value as string;
}
