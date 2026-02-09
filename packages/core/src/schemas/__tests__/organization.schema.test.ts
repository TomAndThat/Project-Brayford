import { describe, it, expect } from 'vitest';
import {
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
} from '../organization.schema';
import {
  createMockOrganization,
  createMockCreateOrganizationData,
  createMockOrganizationMember,
} from "../../__tests__/helpers/test-factories";
import { ZodError } from 'zod';

describe('OrganizationTypeSchema', () => {
  it('accepts valid organization types', () => {
    expect(OrganizationTypeSchema.parse('individual')).toBe('individual');
    expect(OrganizationTypeSchema.parse('team')).toBe('team');
    expect(OrganizationTypeSchema.parse('enterprise')).toBe('enterprise');
  });

  it('rejects invalid organization types', () => {
    expect(() => OrganizationTypeSchema.parse('startup')).toThrow(ZodError);
    expect(() => OrganizationTypeSchema.parse('business')).toThrow(ZodError);
    expect(() => OrganizationTypeSchema.parse('')).toThrow(ZodError);
  });
});

describe('OrganizationRoleSchema', () => {
  it('accepts valid roles', () => {
    expect(OrganizationRoleSchema.parse('owner')).toBe('owner');
    expect(OrganizationRoleSchema.parse('admin')).toBe('admin');
    expect(OrganizationRoleSchema.parse('member')).toBe('member');
  });

  it('rejects invalid roles', () => {
    expect(() => OrganizationRoleSchema.parse('guest')).toThrow(ZodError);
    expect(() => OrganizationRoleSchema.parse('moderator')).toThrow(ZodError);
    expect(() => OrganizationRoleSchema.parse('')).toThrow(ZodError);
  });
});

describe('OrganizationSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete valid organization', () => {
      const validOrg = createMockOrganization();
      const result = OrganizationSchema.parse(validOrg);
      
      expect(result).toEqual(validOrg);
      expect(result.name).toBe('Test Organization');
    });

    it('accepts all valid organization types', () => {
      const types = ['individual', 'team', 'enterprise'] as const;
      
      types.forEach((type) => {
        const org = createMockOrganization({ type });
        expect(() => OrganizationSchema.parse(org)).not.toThrow();
      });
    });

    it('allows optional settings object', () => {
      const orgWithSettings = createMockOrganization({
        settings: { theme: 'dark', notifications: true },
      });
      const result = OrganizationSchema.parse(orgWithSettings);
      
      expect(result.settings).toEqual({ theme: 'dark', notifications: true });
    });

    it('allows missing settings (undefined)', () => {
      const org = createMockOrganization();
      delete org.settings;
      
      const result = OrganizationSchema.parse(org);
      expect(result.settings).toBeUndefined();
    });
  });

  describe('validation failure cases', () => {
    it('rejects missing required fields', () => {
      const requiredFields = ['name', 'type', 'billingEmail', 'createdAt', 'createdBy'];

      requiredFields.forEach((field) => {
        const org = createMockOrganization();
        delete (org as any)[field];
        
        expect(() => OrganizationSchema.parse(org)).toThrow(ZodError);
      });
    });

    it('rejects empty organization name', () => {
      const org = createMockOrganization({ name: '' });
      expect(() => OrganizationSchema.parse(org)).toThrow(ZodError);
    });

    it('rejects organization name exceeding 100 characters', () => {
      const org = createMockOrganization({ name: 'a'.repeat(101) });
      expect(() => OrganizationSchema.parse(org)).toThrow(ZodError);
    });

    it('rejects invalid billing email', () => {
      const invalidEmails = ['not-an-email', 'missing@domain', '@example.com'];

      invalidEmails.forEach((email) => {
        const org = createMockOrganization({ billingEmail: email });
        expect(() => OrganizationSchema.parse(org)).toThrow(ZodError);
      });
    });

    it('rejects invalid organization type', () => {
      const org = { ...createMockOrganization(), type: 'invalid' };
      expect(() => OrganizationSchema.parse(org)).toThrow(ZodError);
    });
  });
});

describe('CreateOrganizationSchema', () => {
  it('validates organization creation data without createdAt', () => {
    const createData = createMockCreateOrganizationData();
    const result = CreateOrganizationSchema.parse(createData);
    
    expect(result).toEqual(createData);
    expect(result).not.toHaveProperty('createdAt');
  });

  it('omits createdAt if provided', () => {
    const createData = {
      ...createMockCreateOrganizationData(),
      createdAt: new Date(),
    };

    const result = CreateOrganizationSchema.parse(createData);
    expect(result).not.toHaveProperty('createdAt');
  });

  it('requires all other fields', () => {
    expect(() => CreateOrganizationSchema.parse({ name: 'Test Org' })).toThrow(ZodError);
  });
});

describe('UpdateOrganizationSchema', () => {
  it('allows partial updates', () => {
    const updates = {
      name: 'Updated Organization Name',
    };

    const result = UpdateOrganizationSchema.parse(updates);
    expect(result.name).toBe('Updated Organization Name');
  });

  it('allows updating type', () => {
    const updates = { type: 'enterprise' as const };
    const result = UpdateOrganizationSchema.parse(updates);
    
    expect(result.type).toBe('enterprise');
  });

  it('allows updating settings', () => {
    const updates = {
      settings: { feature: 'enabled' },
    };

    const result = UpdateOrganizationSchema.parse(updates);
    expect(result.settings).toEqual({ feature: 'enabled' });
  });

  it('prevents updating immutable fields', () => {
    const updates = {
      createdAt: new Date(),
      createdBy: 'different-user-id',
    };

    const result = UpdateOrganizationSchema.parse(updates);
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('createdBy');
  });

  it('validates types of provided fields', () => {
    expect(() => UpdateOrganizationSchema.parse({ name: '' })).toThrow(ZodError);
    expect(() => UpdateOrganizationSchema.parse({ billingEmail: 'invalid' })).toThrow(ZodError);
  });

  it('accepts empty update object', () => {
    const result = UpdateOrganizationSchema.parse({});
    expect(result).toEqual({});
  });
});

describe('OrganizationMemberSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete valid organization member', () => {
      const member = createMockOrganizationMember();
      const result = OrganizationMemberSchema.parse(member);
      
      expect(result).toEqual(member);
    });

    it('accepts null invitedAt and invitedBy for self-created org', () => {
      const member = createMockOrganizationMember({
        invitedAt: null,
        invitedBy: null,
      });

      const result = OrganizationMemberSchema.parse(member);
      expect(result.invitedAt).toBeNull();
      expect(result.invitedBy).toBeNull();
    });

    it('accepts valid invitedAt and invitedBy for invited member', () => {
      const member = createMockOrganizationMember({
        invitedAt: new Date('2024-01-01'),
        invitedBy: 'inviter-user-123',
        role: 'member',
      });

      const result = OrganizationMemberSchema.parse(member);
      expect(result.invitedAt).toBeInstanceOf(Date);
      expect(result.invitedBy).toBe('inviter-user-123');
    });

    it('accepts empty brandAccess array', () => {
      const member = createMockOrganizationMember({ brandAccess: [] });
      const result = OrganizationMemberSchema.parse(member);
      
      expect(result.brandAccess).toEqual([]);
    });

    it('accepts brandAccess with brand IDs', () => {
      const member = createMockOrganizationMember({
        brandAccess: ['brand-1', 'brand-2', 'brand-3'],
      });

      const result = OrganizationMemberSchema.parse(member);
      expect(result.brandAccess).toEqual(['brand-1', 'brand-2', 'brand-3']);
    });

    it('accepts all valid roles', () => {
      const roles = ['owner', 'admin', 'member'] as const;
      
      roles.forEach((role) => {
        const member = createMockOrganizationMember({ role });
        expect(() => OrganizationMemberSchema.parse(member)).not.toThrow();
      });
    });
  });

  describe('validation failure cases', () => {
    it('rejects missing required fields', () => {
      const requiredFields = ['organizationId', 'userId', 'role', 'brandAccess', 'joinedAt'];

      requiredFields.forEach((field) => {
        const member = createMockOrganizationMember();
        delete (member as any)[field];
        
        expect(() => OrganizationMemberSchema.parse(member)).toThrow(ZodError);
      });
    });

    it('rejects invalid role', () => {
      const member = { ...createMockOrganizationMember(), role: 'invalid' };
      expect(() => OrganizationMemberSchema.parse(member)).toThrow(ZodError);
    });

    it('rejects non-array brandAccess', () => {
      const member = { ...createMockOrganizationMember(), brandAccess: 'not-an-array' };
      expect(() => OrganizationMemberSchema.parse(member)).toThrow(ZodError);
    });
  });
});

describe('CreateOrganizationMemberSelfSchema', () => {
  it('validates self-created member with owner role', () => {
    const memberData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'owner' as const,
      brandAccess: [],
    };

    const result = CreateOrganizationMemberSelfSchema.parse(memberData);
    expect(result.role).toBe('owner');
    expect(result).not.toHaveProperty('invitedAt');
    expect(result).not.toHaveProperty('invitedBy');
    expect(result).not.toHaveProperty('joinedAt');
  });

  it('requires owner role', () => {
    const memberData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'admin' as const,
      brandAccess: [],
    };

    expect(() => CreateOrganizationMemberSelfSchema.parse(memberData)).toThrow(ZodError);
  });

  it('omits timestamp and invitation fields if provided', () => {
    const memberData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'owner' as const,
      brandAccess: [],
      invitedAt: new Date(),
      invitedBy: 'someone',
      joinedAt: new Date(),
    };

    const result = CreateOrganizationMemberSelfSchema.parse(memberData);
    expect(result).not.toHaveProperty('invitedAt');
    expect(result).not.toHaveProperty('invitedBy');
    expect(result).not.toHaveProperty('joinedAt');
  });
});

describe('InviteOrganizationMemberSchema', () => {
  it('validates invitation data', () => {
    const inviteData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'member' as const,
      brandAccess: ['brand-1'],
      invitedBy: 'inviter-123',
    };

    const result = InviteOrganizationMemberSchema.parse(inviteData);
    expect(result.role).toBe('member');
    expect(result.invitedBy).toBe('inviter-123');
    expect(result).not.toHaveProperty('invitedAt');
    expect(result).not.toHaveProperty('joinedAt');
  });

  it('accepts admin role for invitations', () => {
    const inviteData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'admin' as const,
      brandAccess: [],
      invitedBy: 'inviter-123',
    };

    expect(() => InviteOrganizationMemberSchema.parse(inviteData)).not.toThrow();
  });

  it('requires invitedBy field', () => {
    const inviteData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'member' as const,
      brandAccess: [],
    };

    expect(() => InviteOrganizationMemberSchema.parse(inviteData)).toThrow(ZodError);
  });
});

describe('UpdateOrganizationMemberSchema', () => {
  it('allows updating role', () => {
    const updates = { role: 'admin' as const };
    const result = UpdateOrganizationMemberSchema.parse(updates);
    
    expect(result.role).toBe('admin');
  });

  it('allows updating brandAccess', () => {
    const updates = { brandAccess: ['brand-1', 'brand-2'] };
    const result = UpdateOrganizationMemberSchema.parse(updates);
    
    expect(result.brandAccess).toEqual(['brand-1', 'brand-2']);
  });

  it('allows updating both fields', () => {
    const updates = {
      role: 'member' as const,
      brandAccess: ['brand-1'],
    };

    const result = UpdateOrganizationMemberSchema.parse(updates);
    expect(result.role).toBe('member');
    expect(result.brandAccess).toEqual(['brand-1']);
  });

  it('accepts empty update object', () => {
    const result = UpdateOrganizationMemberSchema.parse({});
    expect(result).toEqual({});
  });

  it('validates role if provided', () => {
    expect(() => UpdateOrganizationMemberSchema.parse({ role: 'invalid' })).toThrow(ZodError);
  });

  it('validates brandAccess type if provided', () => {
    expect(() => UpdateOrganizationMemberSchema.parse({ brandAccess: 'not-array' })).toThrow(
      ZodError
    );
  });
});

// Validation helper function tests
describe('validateOrganizationData', () => {
  it('returns validated Organization for valid data', () => {
    const validOrg = createMockOrganization();
    const result = validateOrganizationData(validOrg);
    
    expect(result).toEqual(validOrg);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateOrganizationData({})).toThrow(ZodError);
    expect(() => validateOrganizationData(null)).toThrow(ZodError);
  });
});

describe('validateCreateOrganizationData', () => {
  it('returns validated CreateOrganizationData for valid data', () => {
    const createData = createMockCreateOrganizationData();
    const result = validateCreateOrganizationData(createData);
    
    expect(result).toEqual(createData);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateCreateOrganizationData({ name: 'Org' })).toThrow(ZodError);
  });
});

describe('validateUpdateOrganizationData', () => {
  it('returns validated UpdateOrganizationData for valid data', () => {
    const updateData = { name: 'New Name' };
    const result = validateUpdateOrganizationData(updateData);
    
    expect(result).toEqual(updateData);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateUpdateOrganizationData({ name: '' })).toThrow(ZodError);
  });
});

describe('validateOrganizationMemberData', () => {
  it('returns validated OrganizationMember for valid data', () => {
    const member = createMockOrganizationMember();
    const result = validateOrganizationMemberData(member);
    
    expect(result).toEqual(member);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateOrganizationMemberData({})).toThrow(ZodError);
  });
});

describe('validateCreateOrganizationMemberSelfData', () => {
  it('returns validated data for self-created member', () => {
    const memberData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'owner' as const,
      brandAccess: [],
      autoGrantNewBrands: false,
    };

    const result = validateCreateOrganizationMemberSelfData(memberData);
    expect(result).toEqual(memberData);
  });

  it('throws ZodError for non-owner role', () => {
    const memberData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'admin' as const,
      brandAccess: [],
    };

    expect(() => validateCreateOrganizationMemberSelfData(memberData)).toThrow(ZodError);
  });
});

describe('validateInviteOrganizationMemberData', () => {
  it('returns validated invitation data', () => {
    const inviteData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'member' as const,
      brandAccess: [],
      autoGrantNewBrands: false,
      invitedBy: 'inviter-123',
    };

    const result = validateInviteOrganizationMemberData(inviteData);
    expect(result).toEqual(inviteData);
  });

  it('throws ZodError for missing invitedBy', () => {
    const inviteData = {
      organizationId: 'org-123',
      userId: 'user-123',
      role: 'member' as const,
      brandAccess: [],
    };

    expect(() => validateInviteOrganizationMemberData(inviteData)).toThrow(ZodError);
  });
});

describe('validateUpdateOrganizationMemberData', () => {
  it('returns validated update data', () => {
    const updateData = { role: 'admin' as const };
    const result = validateUpdateOrganizationMemberData(updateData);
    
    expect(result).toEqual(updateData);
  });

  it('accepts empty object', () => {
    const result = validateUpdateOrganizationMemberData({});
    expect(result).toEqual({});
  });

  it('throws ZodError for invalid role', () => {
    expect(() => validateUpdateOrganizationMemberData({ role: 'invalid' })).toThrow(ZodError);
  });
});
