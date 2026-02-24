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
  useEventAudienceSessions,
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

// Scene operations (Interaction Domain)
export {
  getSceneRef,
  getScene,
  createScene,
  updateScene,
  deleteScene,
  getEventScenes,
  getBrandScenes,
  getOrganizationScenes,
  duplicateScene,
} from './scenes';

// Event Live State operations (Interaction Domain)
export {
  getEventLiveState,
  initializeEventLiveState,
  switchScene,
  markSceneContentUpdated,
  useEventLiveState,
} from './event-live-state';

// Image operations (Asset Management Domain)
export {
  getImageRef,
  getImage,
  createImage,
  updateImageMetadata,
  confirmImageUpload,
  deleteImage,
  getOrganizationImages,
  getOrganizationImageNames,
  imageExists,
} from './images';

// Message operations (Interaction Domain)
export {
  getMessageRef,
  getMessage,
  getEventMessages,
  softDeleteMessage,
  restoreMessage,
  editMessage,
  clearMessageEdit,
  useMessages,
} from './messages';

// Message Column operations (Interaction Domain)
export {
  getMessageColumnRef,
  getMessageColumn,
  getEventMessageColumns,
  createMessageColumn,
  updateMessageColumn,
  deleteMessageColumn,
  addMessageToColumn,
  removeMessageFromColumn,
  moveMessage,
  reorderMessage,
  useMessageColumns,
  useColumnMessageEntries,
  type ColumnMessageEntryDocument,
} from './message-columns';
