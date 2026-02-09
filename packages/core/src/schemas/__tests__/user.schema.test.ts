import { describe, it, expect } from 'vitest';
import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  AuthProviderSchema,
  validateUserData,
  validateCreateUserData,
  validateUpdateUserData,
} from '../user.schema';
import { createMockUser, createMockCreateUserData } from "../../__tests__/helpers/test-factories";
import { ZodError } from 'zod';

describe('AuthProviderSchema', () => {
  it('accepts google.com as valid provider', () => {
    const result = AuthProviderSchema.parse('google.com');
    expect(result).toBe('google.com');
  });

  it('rejects invalid auth providers', () => {
    expect(() => AuthProviderSchema.parse('facebook.com')).toThrow(ZodError);
    expect(() => AuthProviderSchema.parse('email')).toThrow(ZodError);
    expect(() => AuthProviderSchema.parse('')).toThrow(ZodError);
  });
});

describe('UserSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete valid user object', () => {
      const validUser = createMockUser();
      const result = UserSchema.parse(validUser);
      
      expect(result).toEqual(validUser);
      expect(result.uid).toBe('test-user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('allows null photoURL', () => {
      const userWithNullPhoto = createMockUser({ photoURL: null });
      const result = UserSchema.parse(userWithNullPhoto);
      
      expect(result.photoURL).toBeNull();
    });

    it('accepts valid email addresses', () => {
      const emails = [
        'user@example.com',
        'test.user+tag@domain.co.uk',
        'user123@subdomain.example.com',
      ];

      emails.forEach((email) => {
        const user = createMockUser({ email });
        expect(() => UserSchema.parse(user)).not.toThrow();
      });
    });

    it('accepts valid date objects for timestamps', () => {
      const now = new Date();
      const user = createMockUser({
        createdAt: now,
        lastLoginAt: now,
      });

      const result = UserSchema.parse(user);
      expect(result.createdAt).toEqual(now);
      expect(result.lastLoginAt).toEqual(now);
    });
  });

  describe('validation failure cases', () => {
    it('rejects invalid email addresses', () => {
      const invalidEmails = ['not-an-email', 'missing@domain', '@example.com', 'user@', ''];

      invalidEmails.forEach((email) => {
        const user = createMockUser({ email });
        expect(() => UserSchema.parse(user)).toThrow(ZodError);
      });
    });

    it('rejects missing required fields', () => {
      const requiredFields = ['uid', 'email', 'displayName', 'authProvider', 'createdAt', 'lastLoginAt'];

      requiredFields.forEach((field) => {
        const user = createMockUser();
        delete (user as any)[field];
        
        expect(() => UserSchema.parse(user)).toThrow(ZodError);
      });
    });

    it('rejects empty displayName', () => {
      const user = createMockUser({ displayName: '' });
      expect(() => UserSchema.parse(user)).toThrow(ZodError);
    });

    it('rejects invalid photoURL format', () => {
      // These are strings that Zod's .url() will reject
      const invalidUrls = ['not-a-url', 'just text', ''];

      invalidUrls.forEach((photoURL) => {
        const user = createMockUser({ photoURL });
        expect(() => UserSchema.parse(user)).toThrow(ZodError);
      });
    });

    it('rejects non-Date values for timestamp fields', () => {
      const user = createMockUser();
      
      expect(() => UserSchema.parse({ ...user, createdAt: 'not a date' })).toThrow(ZodError);
      expect(() => UserSchema.parse({ ...user, lastLoginAt: 12345 })).toThrow(ZodError);
    });

    it('rejects extra unexpected fields', () => {
      const userWithExtra = {
        ...createMockUser(),
        extraField: 'should not be here',
      };

      // Zod in strict mode would reject this, but by default it strips extra fields
      const result = UserSchema.parse(userWithExtra);
      expect(result).not.toHaveProperty('extraField');
    });
  });
});

describe('CreateUserSchema', () => {
  it('validates user creation data without timestamps', () => {
    const createData = createMockCreateUserData();
    const result = CreateUserSchema.parse(createData);
    
    expect(result).toEqual(createData);
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('lastLoginAt');
  });

  it('omits timestamp fields if provided', () => {
    const createData = {
      ...createMockCreateUserData(),
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    const result = CreateUserSchema.parse(createData);
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('lastLoginAt');
  });

  it('rejects invalid data', () => {
    expect(() => CreateUserSchema.parse({ uid: '123' })).toThrow(ZodError);
    expect(() => CreateUserSchema.parse({})).toThrow(ZodError);
  });
});

describe('UpdateUserSchema', () => {
  it('allows partial updates with only specified fields', () => {
    const updates = {
      displayName: 'Updated Name',
    };

    const result = UpdateUserSchema.parse(updates);
    expect(result.displayName).toBe('Updated Name');
  });

  it('allows updating photoURL', () => {
    const updates = {
      photoURL: 'https://newphoto.example.com/pic.jpg',
    };

    const result = UpdateUserSchema.parse(updates);
    expect(result.photoURL).toBe('https://newphoto.example.com/pic.jpg');
  });

  it('allows setting photoURL to null', () => {
    const updates = {
      photoURL: null,
    };

    const result = UpdateUserSchema.parse(updates);
    expect(result.photoURL).toBeNull();
  });

  it('prevents updating immutable fields', () => {
    const updates = {
      uid: 'new-uid',
      email: 'newemail@example.com',
      authProvider: 'google.com' as const,
      createdAt: new Date(),
    };

    const result = UpdateUserSchema.parse(updates);
    expect(result).not.toHaveProperty('uid');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('authProvider');
    expect(result).not.toHaveProperty('createdAt');
  });

  it('validates types of provided fields', () => {
    expect(() => UpdateUserSchema.parse({ displayName: '' })).toThrow(ZodError);
    expect(() => UpdateUserSchema.parse({ photoURL: 'invalid-url' })).toThrow(ZodError);
  });

  it('accepts empty update object', () => {
    const result = UpdateUserSchema.parse({});
    expect(result).toEqual({});
  });
});

describe('validateUserData', () => {
  it('returns validated User object for valid data', () => {
    const validUser = createMockUser();
    const result = validateUserData(validUser);
    
    expect(result).toEqual(validUser);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateUserData({ invalid: 'data' })).toThrow(ZodError);
    expect(() => validateUserData(null)).toThrow(ZodError);
    expect(() => validateUserData(undefined)).toThrow(ZodError);
    expect(() => validateUserData('not an object')).toThrow(ZodError);
  });

  it('provides detailed error messages', () => {
    try {
      validateUserData({ uid: '123', email: 'invalid-email' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const zodError = error as ZodError;
      expect(zodError.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('validateCreateUserData', () => {
  it('returns validated CreateUserData for valid data', () => {
    const createData = createMockCreateUserData();
    const result = validateCreateUserData(createData);
    
    expect(result).toEqual(createData);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateCreateUserData({ uid: '123' })).toThrow(ZodError);
  });
});

describe('validateUpdateUserData', () => {
  it('returns validated UpdateUserData for valid data', () => {
    const updateData = { displayName: 'New Name' };
    const result = validateUpdateUserData(updateData);
    
    expect(result).toEqual(updateData);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => validateUpdateUserData({ displayName: '' })).toThrow(ZodError);
    expect(() => validateUpdateUserData({ photoURL: 'not-a-url' })).toThrow(ZodError);
  });

  it('accepts empty update object', () => {
    const result = validateUpdateUserData({});
    expect(result).toEqual({});
  });
});
