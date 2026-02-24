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
  BrandStylingSchema,
  HeaderTypeSchema,
  CreateBrandSchema,
  UpdateBrandSchema,
  validateBrandData,
  validateCreateBrandData,
  validateUpdateBrandData,
  type Brand,
  type BrandDocument,
  type BrandStyling,
  type HeaderType,
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

// Audience Session Schema (Audience Domain)
export {
  AudienceSessionSchema,
  CreateAudienceSessionSchema,
  UpdateAudienceSessionSchema,
  validateAudienceSessionData,
  validateCreateAudienceSessionData,
  validateUpdateAudienceSessionData,
  type AudienceSession,
  type AudienceSessionDocument,
  type CreateAudienceSessionData,
  type UpdateAudienceSessionData,
} from './audience-session.schema';

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

// Scene Schema (Interaction Domain)
export {
  ModuleTypeSchema,
  ModuleInstanceSchema,
  SceneSchema,
  CreateSceneSchema,
  UpdateSceneSchema,
  validateSceneData,
  validateCreateSceneData,
  validateUpdateSceneData,
  type ModuleInstance,
  type Scene,
  type SceneDocument,
  type CreateSceneData,
  type UpdateSceneData,
} from './scene.schema';

// Event Live State Schema (Interaction Domain)
export {
  EventLiveStateSchema,
  UpdateEventLiveStateSchema,
  validateEventLiveStateData,
  validateUpdateEventLiveStateData,
  type EventLiveState,
  type EventLiveStateDocument,
  type UpdateEventLiveStateData,
} from './event-live-state.schema';

// Message Schema (Interaction Domain)
export {
  MessageSchema,
  CreateMessageSchema,
  UpdateMessageSchema,
  validateMessageData,
  validateCreateMessageData,
  validateUpdateMessageData,
  type Message,
  type MessageDocument,
  type CreateMessageData,
  type UpdateMessageData,
} from './message.schema';

// Message Column Schema (Interaction Domain)
export {
  MessageColumnSchema,
  ColumnMessageEntrySchema,
  CreateMessageColumnSchema,
  UpdateMessageColumnSchema,
  validateMessageColumnData,
  validateCreateMessageColumnData,
  validateUpdateMessageColumnData,
  validateColumnMessageEntryData,
  type MessageColumn,
  type MessageColumnDocument,
  type ColumnMessageEntry,
  type CreateMessageColumnData,
  type UpdateMessageColumnData,
} from './message-column.schema';

// Image Schema (Asset Management Domain)
export {
  ImageSchema,
  ImageDimensionsSchema,
  ImageUsedBySchema,
  ImageUploadStatusSchema,
  ImageVariantsSchema,
  CreateImageSchema,
  UpdateImageMetadataSchema,
  validateImageData,
  validateCreateImageData,
  validateUpdateImageMetadataData,
  deduplicateImageName,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_TAGS_PER_IMAGE,
  MAX_TAG_LENGTH,
  type Image,
  type ImageDocument,
  type ImageDimensions,
  type ImageUsedBy,
  type ImageUploadStatus,
  type ImageVariants,
  type AcceptedImageType,
  type CreateImageData,
  type UpdateImageMetadataData,
} from './image.schema';
