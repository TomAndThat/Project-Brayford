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
