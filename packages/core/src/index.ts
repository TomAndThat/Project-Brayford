/**
 * @brayford/core
 * 
 * Shared types, schemas, and constants for Project Brayford
 * Single source of truth for domain models across all apps
 */

// Branded types for type-safe IDs
export {
  toBranded,
  fromBranded,
  type Brand,
  type UserId,
  type OrganizationId,
  type OrganizationMemberId,
  type BrandId,
  type EventId,
  type ModuleId,
  type InteractionId,
  type ParticipantId,
  type EmailCaptureId,
  type SubscriptionId,
  type UsageRecordId,
  type InvoiceId,
} from './types/branded';

// Re-export all schemas
export * from './schemas/index';

// Re-export permission system
export * from './permissions/index';
