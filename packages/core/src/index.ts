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
  type InvitationId,
  type EventId,
  type QRCodeId,
  type SceneId,
  type ModuleInstanceId,
  type ModuleId,
  type InteractionId,
  type MessageId,
  type MessageColumnId,
  type ParticipantId,
  type EmailCaptureId,
  type SubscriptionId,
  type UsageRecordId,
  type InvoiceId,
  type ImageId,
  type EmailQueueId,
} from './types/branded';

// Module types (Interaction Domain)
export {
  MODULE_TYPES,
  type ModuleType,
  type ModuleConfig,
  type TextModuleConfig,
  type ImageModuleConfig,
  type MessagingModuleConfig,
} from './types/module';

// Billing types
export type {
  BillingTier,
  BillingTierInfo,
  BillingMethod,
  DomainVerificationStatus,
} from './types/billing';

// Re-export all schemas
export * from './schemas/index';

// Re-export permission system
export * from './permissions/index';

// Re-export auth utilities
export * from './auth/super-admin';

// Re-export utilities
export * from './utils/index';

// Re-export constants
export * from './constants/index';
