/**
 * Test data factories for generating valid test objects
 * Use these to create consistent, valid test data across test files
 */

import type {
  User,
  CreateUserData,
  Organization,
  CreateOrganizationData,
  OrganizationMember,
  Brand,
  CreateBrandData,
  Invitation,
  CreateInvitationData,
  OrganizationDeletionRequest,
  CreateDeletionRequestData,
  Scene,
  CreateSceneData,
  ModuleInstance,
  EventLiveState,
} from '../../schemas';
import type { UserId, OrganizationId, BrandId, InvitationId, SceneId, EventId } from '../../types/branded';
import { toBranded } from '../../types/branded';
import { getPermissionsForRole } from '../../permissions';

/**
 * Create a valid User object for testing
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    authProvider: 'google.com',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastLoginAt: new Date('2024-01-15T10:30:00Z'),
    claimsVersion: 0,
    ...overrides,
  };
}

/**
 * Create valid CreateUserData for testing
 */
export function createMockCreateUserData(
  overrides?: Partial<CreateUserData>
): CreateUserData {
  return {
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    authProvider: 'google.com',
    claimsVersion: 0,
    ...overrides,
  };
}

/**
 * Create a valid Organization object for testing
 */
export function createMockOrganization(overrides?: Partial<Organization>): Organization {
  return {
    name: 'Test Organization',
    type: 'individual',
    billingEmail: 'billing@example.com',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    createdBy: 'test-user-123',
    settings: {},
    ...overrides,
  };
}

/**
 * Create valid CreateOrganizationData for testing
 */
export function createMockCreateOrganizationData(
  overrides?: Partial<CreateOrganizationData>
): CreateOrganizationData {
  return {
    name: 'Test Organization',
    type: 'individual',
    billingEmail: 'billing@example.com',
    createdBy: 'test-user-123',
    settings: {},
    ...overrides,
  };
}

/**
 * Create a valid OrganizationMember object for testing
 */
export function createMockOrganizationMember(
  overrides?: Partial<OrganizationMember>
): OrganizationMember {
  const role = overrides?.role ?? 'owner';
  const permissions = overrides?.permissions ?? getPermissionsForRole(role);
  
  return {
    organizationId: 'test-org-123',
    userId: 'test-user-123',
    role,
    permissions,
    brandAccess: [],
    autoGrantNewBrands: false,
    invitedAt: null,
    joinedAt: new Date('2024-01-01T00:00:00Z'),
    invitedBy: null,
    ...overrides,
  };
}

/**
 * Create a valid Brand object for testing
 */
export function createMockBrand(overrides?: Partial<Brand>): Brand {
  return {
    organizationId: 'test-org-123',
    name: 'Test Brand',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true,
    ...overrides,
  };
}

/**
 * Create valid CreateBrandData for testing
 */
export function createMockCreateBrandData(overrides?: Partial<CreateBrandData>): CreateBrandData {
  return {
    organizationId: 'test-org-123',
    name: 'Test Brand',
    ...overrides,
  };
}

/**
 * Create a branded UserId for testing
 */
export function createMockUserId(id = 'test-user-123'): UserId {
  return toBranded<UserId>(id);
}

/**
 * Create a branded OrganizationId for testing
 */
export function createMockOrganizationId(id = 'test-org-123'): OrganizationId {
  return toBranded<OrganizationId>(id);
}

/**
 * Create a branded BrandId for testing
 */
export function createMockBrandId(id = 'test-brand-123'): BrandId {
  return toBranded<BrandId>(id);
}

/**
 * Create a valid Invitation object for testing
 */
export function createMockInvitation(overrides?: Partial<Invitation>): Invitation {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    email: 'invitee@example.com',
    organizationId: 'test-org-123',
    organizationName: 'Test Organization',
    role: 'member',
    brandAccess: [],
    autoGrantNewBrands: false,
    invitedBy: 'test-user-123',
    invitedAt: new Date('2024-01-01T00:00:00Z'),
    status: 'pending',
    token: 'test-token-uuid',
    expiresAt,
    acceptedAt: null,
    metadata: {
      inviterName: 'Test User',
      inviterEmail: 'test@example.com',
    },
    ...overrides,
  };
}

/**
 * Create valid CreateInvitationData for testing
 */
export function createMockCreateInvitationData(
  overrides?: Partial<CreateInvitationData>
): CreateInvitationData {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    email: 'invitee@example.com',
    organizationId: 'test-org-123',
    organizationName: 'Test Organization',
    role: 'member',
    brandAccess: [],
    autoGrantNewBrands: false,
    invitedBy: 'test-user-123',
    token: 'test-token-uuid',
    expiresAt,
    metadata: {
      inviterName: 'Test User',
      inviterEmail: 'test@example.com',
    },
    ...overrides,
  };
}

/**
 * Create a branded InvitationId for testing
 */
export function createMockInvitationId(id = 'test-invitation-123'): InvitationId {
  return toBranded<InvitationId>(id);
}

/**
 * Create a valid OrganizationDeletionRequest object for testing
 */
export function createMockDeletionRequest(
  overrides?: Partial<OrganizationDeletionRequest>
): OrganizationDeletionRequest {
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

  return {
    organizationId: 'test-org-123',
    organizationName: 'Test Organization',
    requestedBy: 'test-user-123',
    requestedAt: new Date('2026-02-01T10:00:00Z'),
    confirmationToken: 'test-confirmation-token-uuid',
    tokenExpiresAt,
    confirmationEmailSentAt: new Date('2026-02-01T10:00:01Z'),
    confirmedAt: null,
    confirmedVia: null,
    status: 'pending-email',
    scheduledDeletionAt: null,
    undoToken: null,
    undoExpiresAt: null,
    auditLog: [
      {
        timestamp: new Date('2026-02-01T10:00:00Z'),
        action: 'Deletion requested',
        userId: 'test-user-123',
      },
    ],
    ...overrides,
  };
}

/**
 * Create valid CreateDeletionRequestData for testing
 */
export function createMockCreateDeletionRequestData(
  overrides?: Partial<CreateDeletionRequestData>
): CreateDeletionRequestData {
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

  return {
    organizationId: 'test-org-123',
    organizationName: 'Test Organization',
    requestedBy: 'test-user-123',
    confirmationToken: 'test-confirmation-token-uuid',
    tokenExpiresAt,
    ...overrides,
  };
}

// ===== Scene System Factories =====

/**
 * Create a valid ModuleInstance for testing
 */
export function createMockModuleInstance(
  overrides?: Partial<ModuleInstance>
): ModuleInstance {
  return {
    id: 'module-inst-1',
    moduleType: 'text',
    order: 0,
    config: {
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Sample text content for testing',
              },
            ],
          },
        ],
      },
    },
    ...overrides,
  };
}

/**
 * Create a valid Scene object for testing
 */
export function createMockScene(overrides?: Partial<Scene>): Scene {
  return {
    organizationId: 'test-org-123',
    brandId: 'test-brand-123',
    eventId: 'test-event-123',
    name: 'Welcome Screen',
    description: 'Opening scene for the event',
    modules: [
      createMockModuleInstance(),
    ],
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    createdBy: 'test-user-123',
    ...overrides,
  };
}

/**
 * Create valid CreateSceneData for testing
 */
export function createMockCreateSceneData(
  overrides?: Partial<CreateSceneData>
): CreateSceneData {
  return {
    organizationId: 'test-org-123',
    brandId: 'test-brand-123',
    eventId: 'test-event-123',
    name: 'Welcome Screen',
    modules: [],
    createdBy: 'test-user-123',
    ...overrides,
  };
}

/**
 * Create a branded SceneId for testing
 */
export function createMockSceneId(id = 'test-scene-123'): SceneId {
  return toBranded<SceneId>(id);
}

/**
 * Create a branded EventId for testing
 */
export function createMockEventId(id = 'test-event-123'): EventId {
  return toBranded<EventId>(id);
}

/**
 * Create a valid EventLiveState object for testing
 */
export function createMockEventLiveState(
  overrides?: Partial<EventLiveState>
): EventLiveState {
  return {
    activeSceneId: null,
    sceneUpdatedAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    ...overrides,
  };
}
