/**
 * Schema exports for Project Brayford
 * Single source of truth for all domain schemas
 */

// User Schema (Identity & Access Domain)
export {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  AuthProviderSchema,
  validateUserData,
  validateCreateUserData,
  validateUpdateUserData,
  type User,
  type UserDocument,
  type CreateUserData,
  type UpdateUserData,
  type AuthProvider,
} from './user.schema';

// Organization Schema (Organization Domain)
export {
  OrganizationSchema,
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  OrganizationTypeSchema,
  OrganizationMemberSchema,
  CreateOrganizationMemberSelfSchema,
  InviteOrganizationMemberSchema,
  UpdateOrganizationMemberSchema,
  OrganizationRoleSchema,
  validateOrganizationData,
  validateCreateOrganizationData,
  validateUpdateOrganizationData,
  validateOrganizationMemberData,
  validateCreateOrganizationMemberSelfData,
  validateInviteOrganizationMemberData,
  validateUpdateOrganizationMemberData,
  type Organization,
  type OrganizationDocument,
  type CreateOrganizationData,
  type UpdateOrganizationData,
  type OrganizationType,
  type OrganizationMember,
  type OrganizationMemberDocument,
  type CreateOrganizationMemberSelfData,
  type InviteOrganizationMemberData,
  type UpdateOrganizationMemberData,
  type OrganizationRole,
} from './organization.schema';

// Brand Schema (Organization Domain)
export {
  BrandSchema,
  CreateBrandSchema,
  UpdateBrandSchema,
  validateBrandData,
  validateCreateBrandData,
  validateUpdateBrandData,
  type Brand,
  type BrandDocument,
  type CreateBrandData,
  type UpdateBrandData,
} from './brand.schema';

// Event Schema (Event Management Domain)
export {
  EventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  EventStatus,
  validateEventData,
  validateCreateEventData,
  validateUpdateEventData,
  type Event,
  type EventDocument,
  type CreateEventData,
  type UpdateEventData,
  type EventStatus as EventStatusType,
} from './event.schema';

// QR Code Schema (Event Management Domain)
export {
  QRCodeSchema,
  CreateQRCodeSchema,
  UpdateQRCodeSchema,
  validateQRCodeData,
  validateCreateQRCodeData,
  validateUpdateQRCodeData,
  generateQRCode,
  buildQRCodeUrl,
  type QRCode,
  type QRCodeDocument,
  type CreateQRCodeData,
  type UpdateQRCodeData,
} from './qr-code.schema';

// Invitation Schema (Organization Domain)
export {
  InvitationSchema,
  CreateInvitationSchema,
  UpdateInvitationSchema,
  InvitationStatusSchema,
  InvitationRoleSchema,
  validateInvitationData,
  validateCreateInvitationData,
  validateUpdateInvitationData,
  generateInvitationToken,
  calculateInvitationExpiry,
  isInvitationExpired,
  isInvitationActionable,
  INVITATION_EXPIRY_DAYS,
  type Invitation,
  type InvitationDocument,
  type CreateInvitationData,
  type UpdateInvitationData,
  type InvitationStatus,
  type InvitationRole,
} from './invitation.schema';

// Organization Deletion Schema (Organization Domain)
export {
  OrganizationDeletionRequestSchema,
  CreateDeletionRequestSchema,
  UpdateDeletionRequestSchema,
  DeletionRequestStatusSchema,
  DeletionActionTypeSchema,
  DeletionAuditEntrySchema,
  DeletedOrganizationAuditSchema,
  validateDeletionRequestData,
  validateCreateDeletionRequestData,
  validateUpdateDeletionRequestData,
  validateDeletedOrganizationAuditData,
  generateDeletionToken,
  isConfirmationTokenExpired,
  isUndoExpired,
  isScheduledForDeletion,
  calculateTokenExpiry,
  calculateScheduledDeletion,
  addAuditEntry,
  type OrganizationDeletionRequest,
  type OrganizationDeletionRequestDocument,
  type CreateDeletionRequestData,
  type UpdateDeletionRequestData,
  type DeletionRequestStatus,
  type DeletionActionType,
  type DeletionAuditEntry,
  type DeletedOrganizationAudit,
  type DeletedOrganizationAuditDocument,
} from './organization-deletion.schema';

// Email Queue Schema (Email Domain)
export {
  EmailQueueDocumentSchema,
  CreateEmailQueueSchema,
  EmailTypeSchema,
  DeliveryModeSchema,
  EmailQueueStatusSchema,
  EmailSenderSchema,
  EmailMetadataSchema,
  EmailErrorSchema,
  validateEmailQueueDocument,
  validateCreateEmailQueueData,
  safeValidateCreateEmailQueueData,
  getRateLimitScope,
  getDefaultDeliveryMode,
  isTransactionalEmail,
  isBulkEmail,
  createMockEmailQueueDocument,
  EMAIL_RATE_LIMITS,
  type EmailQueueId,
  type EmailQueueDocument,
  type EmailQueueDocumentWithId,
  type CreateEmailQueueData,
  type EmailType,
  type DeliveryMode,
  type EmailQueueStatus,
  type EmailSender,
  type EmailMetadata,
  type EmailError,
  type RateLimitConfig,
} from './email-queue.schema';
