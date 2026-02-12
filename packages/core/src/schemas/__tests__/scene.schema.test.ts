/**
 * Scene Schema Tests
 * Interaction Domain
 */

import { describe, it, expect } from 'vitest';
import {
  SceneSchema,
  CreateSceneSchema,
  UpdateSceneSchema,
  ModuleInstanceSchema,
  validateSceneData,
  validateCreateSceneData,
  validateUpdateSceneData,
} from '../scene.schema';
import {
  createMockScene,
  createMockCreateSceneData,
  createMockModuleInstance,
} from '../../__tests__/helpers/test-factories';
import { MAX_MODULES_PER_SCENE } from '../../constants/scene';
import { ZodError } from 'zod';

describe('ModuleInstanceSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete valid module instance', () => {
      const module = createMockModuleInstance();
      const result = ModuleInstanceSchema.parse(module);

      expect(result).toEqual(module);
      expect(result.moduleType).toBe('welcome');
      expect(result.order).toBe(0);
    });

    it('validates all module types', () => {
      const types = ['welcome', 'qna', 'poll', 'countdown', 'sponsor'] as const;
      
      types.forEach((type) => {
        const module = createMockModuleInstance({ moduleType: type });
        const result = ModuleInstanceSchema.parse(module);
        expect(result.moduleType).toBe(type);
      });
    });

    it('accepts any config shape', () => {
      const module = createMockModuleInstance({
        config: { question: 'Test?', options: ['A', 'B'], nested: { deep: true } },
      });
      const result = ModuleInstanceSchema.parse(module);
      expect(result.config).toEqual(module.config);
    });

    it('accepts empty config', () => {
      const module = createMockModuleInstance({ config: {} });
      const result = ModuleInstanceSchema.parse(module);
      expect(result.config).toEqual({});
    });
  });

  describe('validation failure cases', () => {
    it('rejects empty module ID', () => {
      const module = createMockModuleInstance({ id: '' });
      expect(() => ModuleInstanceSchema.parse(module)).toThrow(ZodError);
    });

    it('rejects invalid module type', () => {
      const module = { ...createMockModuleInstance(), moduleType: 'invalid-type' };
      expect(() => ModuleInstanceSchema.parse(module)).toThrow(ZodError);
    });

    it('rejects negative order', () => {
      const module = createMockModuleInstance({ order: -1 });
      expect(() => ModuleInstanceSchema.parse(module)).toThrow(ZodError);
    });

    it('rejects float order values', () => {
      const module = createMockModuleInstance({ order: 1.5 });
      expect(() => ModuleInstanceSchema.parse(module)).toThrow(ZodError);
    });

    it('rejects missing required fields', () => {
      const requiredFields = ['id', 'moduleType', 'order', 'config'];

      requiredFields.forEach((field) => {
        const module = createMockModuleInstance();
        delete (module as any)[field];
        expect(() => ModuleInstanceSchema.parse(module)).toThrow(ZodError);
      });
    });
  });
});

describe('SceneSchema', () => {
  describe('validation success cases', () => {
    it('validates a complete valid scene', () => {
      const scene = createMockScene();
      const result = SceneSchema.parse(scene);

      expect(result.name).toBe('Welcome Screen');
      expect(result.modules).toHaveLength(1);
      expect(result.isTemplate).toBe(false);
    });

    it('validates a scene with no modules', () => {
      const scene = createMockScene({ modules: [] });
      const result = SceneSchema.parse(scene);
      expect(result.modules).toHaveLength(0);
    });

    it('validates a template scene with null eventId', () => {
      const scene = createMockScene({
        eventId: null,
        isTemplate: true,
      });
      const result = SceneSchema.parse(scene);
      expect(result.isTemplate).toBe(true);
      expect(result.eventId).toBeNull();
    });

    it('validates a scene with multiple modules', () => {
      const scene = createMockScene({
        modules: [
          createMockModuleInstance({ id: 'mod-1', order: 0 }),
          createMockModuleInstance({ id: 'mod-2', moduleType: 'qna', order: 10 }),
          createMockModuleInstance({ id: 'mod-3', moduleType: 'poll', order: 20 }),
        ],
      });
      const result = SceneSchema.parse(scene);
      expect(result.modules).toHaveLength(3);
    });

    it('defaults isTemplate to false', () => {
      const scene = createMockScene();
      delete (scene as any).isTemplate;
      const result = SceneSchema.parse(scene);
      expect(result.isTemplate).toBe(false);
    });

    it('accepts optional description', () => {
      const scene = createMockScene({ description: undefined });
      const result = SceneSchema.parse(scene);
      expect(result.description).toBeUndefined();
    });

    it('accepts description up to 500 characters', () => {
      const scene = createMockScene({ description: 'a'.repeat(500) });
      const result = SceneSchema.parse(scene);
      expect(result.description).toHaveLength(500);
    });
  });

  describe('validation failure cases', () => {
    it('rejects missing required fields', () => {
      const requiredFields = ['organizationId', 'name', 'modules', 'createdAt', 'updatedAt', 'createdBy'];

      requiredFields.forEach((field) => {
        const scene = createMockScene();
        delete (scene as any)[field];
        expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
      });
    });

    it('rejects empty scene name', () => {
      const scene = createMockScene({ name: '' });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('rejects scene name exceeding 100 characters', () => {
      const scene = createMockScene({ name: 'a'.repeat(101) });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('rejects description exceeding 500 characters', () => {
      const scene = createMockScene({ description: 'a'.repeat(501) });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('rejects template scenes with a non-null eventId', () => {
      const scene = createMockScene({
        eventId: 'event-123',
        isTemplate: true,
      });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('rejects duplicate module IDs', () => {
      const scene = createMockScene({
        modules: [
          createMockModuleInstance({ id: 'dup-id', order: 0 }),
          createMockModuleInstance({ id: 'dup-id', order: 10 }),
        ],
      });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('rejects duplicate module order values', () => {
      const scene = createMockScene({
        modules: [
          createMockModuleInstance({ id: 'mod-1', order: 0 }),
          createMockModuleInstance({ id: 'mod-2', order: 0 }),
        ],
      });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('rejects more modules than MAX_MODULES_PER_SCENE', () => {
      const tooManyModules = Array.from({ length: MAX_MODULES_PER_SCENE + 1 }, (_, i) =>
        createMockModuleInstance({ id: `mod-${i}`, order: i * 10 })
      );
      const scene = createMockScene({ modules: tooManyModules });
      expect(() => SceneSchema.parse(scene)).toThrow(ZodError);
    });

    it('allows exactly MAX_MODULES_PER_SCENE modules', () => {
      const maxModules = Array.from({ length: MAX_MODULES_PER_SCENE }, (_, i) =>
        createMockModuleInstance({ id: `mod-${i}`, order: i * 10 })
      );
      const scene = createMockScene({ modules: maxModules });
      const result = SceneSchema.parse(scene);
      expect(result.modules).toHaveLength(MAX_MODULES_PER_SCENE);
    });
  });
});

describe('CreateSceneSchema', () => {
  it('validates valid creation data', () => {
    const createData = createMockCreateSceneData();
    const result = CreateSceneSchema.parse(createData);

    expect(result.name).toBe('Welcome Screen');
    expect(result.modules).toHaveLength(0);
  });

  it('defaults modules to empty array if not provided', () => {
    const createData = createMockCreateSceneData();
    delete (createData as any).modules;
    const result = CreateSceneSchema.parse(createData);
    expect(result.modules).toEqual([]);
  });

  it('defaults isTemplate to false if not provided', () => {
    const createData = createMockCreateSceneData();
    delete (createData as any).isTemplate;
    const result = CreateSceneSchema.parse(createData);
    expect(result.isTemplate).toBe(false);
  });

  it('does not require createdAt or updatedAt', () => {
    const createData = createMockCreateSceneData();
    // Should not have timestamp fields
    expect(createData).not.toHaveProperty('createdAt');
    expect(createData).not.toHaveProperty('updatedAt');
    const result = CreateSceneSchema.parse(createData);
    expect(result).toBeDefined();
  });

  it('accepts creation data with modules', () => {
    const createData = createMockCreateSceneData({
      modules: [
        createMockModuleInstance({ id: 'new-mod-1', order: 0 }),
        createMockModuleInstance({ id: 'new-mod-2', moduleType: 'poll', order: 10 }),
      ],
    });
    const result = CreateSceneSchema.parse(createData);
    expect(result.modules).toHaveLength(2);
  });

  it('rejects template creation with eventId', () => {
    const createData = createMockCreateSceneData({
      eventId: 'event-123',
      isTemplate: true,
    });
    expect(() => CreateSceneSchema.parse(createData)).toThrow(ZodError);
  });

  it('rejects duplicate module IDs in creation data', () => {
    const createData = createMockCreateSceneData({
      modules: [
        createMockModuleInstance({ id: 'same', order: 0 }),
        createMockModuleInstance({ id: 'same', order: 10 }),
      ],
    });
    expect(() => CreateSceneSchema.parse(createData)).toThrow(ZodError);
  });
});

describe('UpdateSceneSchema', () => {
  it('validates partial update data', () => {
    const result = UpdateSceneSchema.parse({ name: 'New Name' });
    expect(result.name).toBe('New Name');
  });

  it('validates empty update (no fields)', () => {
    const result = UpdateSceneSchema.parse({});
    expect(result).toBeDefined();
  });

  it('validates module array update', () => {
    const modules = [
      createMockModuleInstance({ id: 'updated-1', order: 0 }),
    ];
    const result = UpdateSceneSchema.parse({ modules });
    expect(result.modules).toHaveLength(1);
  });

  it('rejects duplicate module IDs in update', () => {
    expect(() =>
      UpdateSceneSchema.parse({
        modules: [
          createMockModuleInstance({ id: 'dup', order: 0 }),
          createMockModuleInstance({ id: 'dup', order: 10 }),
        ],
      })
    ).toThrow(ZodError);
  });

  it('rejects duplicate module orders in update', () => {
    expect(() =>
      UpdateSceneSchema.parse({
        modules: [
          createMockModuleInstance({ id: 'a', order: 5 }),
          createMockModuleInstance({ id: 'b', order: 5 }),
        ],
      })
    ).toThrow(ZodError);
  });

  it('does not allow changing organizationId', () => {
    const result = UpdateSceneSchema.parse({ name: 'Test' });
    expect(result).not.toHaveProperty('organizationId');
  });

  it('does not allow changing createdBy', () => {
    const result = UpdateSceneSchema.parse({ name: 'Test' });
    expect(result).not.toHaveProperty('createdBy');
  });
});

describe('Validation helpers', () => {
  it('validateSceneData parses valid scene', () => {
    const scene = createMockScene();
    const result = validateSceneData(scene);
    expect(result.name).toBe('Welcome Screen');
  });

  it('validateSceneData throws on invalid data', () => {
    expect(() => validateSceneData({})).toThrow(ZodError);
  });

  it('validateCreateSceneData parses valid create data', () => {
    const data = createMockCreateSceneData();
    const result = validateCreateSceneData(data);
    expect(result.name).toBe('Welcome Screen');
  });

  it('validateCreateSceneData throws on invalid data', () => {
    expect(() => validateCreateSceneData({})).toThrow(ZodError);
  });

  it('validateUpdateSceneData parses valid update data', () => {
    const result = validateUpdateSceneData({ name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('validateUpdateSceneData throws on invalid data', () => {
    expect(() => validateUpdateSceneData({ name: '' })).toThrow(ZodError);
  });
});
