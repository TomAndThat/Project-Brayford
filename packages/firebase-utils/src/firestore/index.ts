/**
 * Firestore operations exports
 * Phase 1: User, Organization, Brand
 */

// Converters
export {
  createConverter,
  convertFromFirestore,
  convertToFirestore,
} from './converters';

// User operations
export {
  getUserRef,
  getUser,
  updateUser,
  deleteUser,
  userExists,
  batchGetUsers,
} from './users';

// Organization operations
export {
  getOrganizationRef,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationMemberRef,
  getOrganizationMember,
  inviteUserToOrganization,
  updateOrganizationMember,
  removeOrganizationMember,
  getOrganizationMembers,
  getUserOrganizations,
  getOrganizationMembersWithUsers,
  type OrganizationMemberWithUser,
} from './organizations';

// Brand operations
export {
  getBrandRef,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
  permanentlyDeleteBrand,
  getOrganizationBrands,
  brandExists,
} from './brands';
