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
