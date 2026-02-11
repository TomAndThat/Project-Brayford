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
  getOwnerCount,
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

// Event operations
export {
  getEventRef,
  getEvent,
  createEvent,
  updateEvent,
  getBrandEvents,
  getOrganizationEvents,
  getChildEvents,
} from './events';

// QR Code operations
export {
  getQRCodeRef,
  getQRCode,
  getEventQRCodes,
  createQRCode,
  updateQRCode,
  getQRCodeByCode,
} from './qr-codes';

// Audience Session operations
export {
  getAudienceSessionRef,
  getAudienceSession,
  getActiveAudienceSession,
  createAudienceSession,
  updateAudienceSession,
  updateSessionHeartbeat,
  endAudienceSession,
  getEventActiveSessions,
} from './audience-sessions';

// Invitation operations
export {
  getInvitationRef,
  getInvitation,
  getInvitationByToken,
  getPendingInvitationsByEmail,
  getOrganizationInvitations,
  getOrganizationPendingInvitations,
  pendingInvitationExists,
  createInvitation,
  updateInvitation,
  acceptInvitation,
  declineInvitation,
  resendInvitation,
  cancelInvitation,
} from './invitations';
