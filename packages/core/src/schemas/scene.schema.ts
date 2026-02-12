/**
 * Scene Schema - Interaction Domain
 * 
 * Scenes define what content appears on audience devices and in what order.
 * Each scene contains an ordered array of module instances.
 * Event organisers switch between scenes to control the audience experience.
 * 
 * Scenes follow a three-tier hierarchy:
 * - Organisation-wide: brandId = null, eventId = null (available to all events)
 * - Brand-specific: brandId set, eventId = null (available to all events under that brand)
 * - Event-specific: brandId set, eventId set (only for one event)
 * 
 * Users can duplicate scenes across scopes rather than using templates.
 * 
 * Firestore Collection: /scenes/{sceneId}
 * 
 * @see docs/briefs/SCENE_SYSTEM.md for full architecture
 */

import { z } from 'zod';
import type { SceneId, ModuleInstanceId, EventId, BrandId, OrganizationId, UserId } from '../types/branded';
import { MODULE_TYPES } from '../types/module';
import { MAX_MODULES_PER_SCENE } from '../constants/scene';

/**
 * Module type Zod schema
 * Validates against the canonical list of module types
 */
export const ModuleTypeSchema = z.enum(
  MODULE_TYPES as [string, ...string[]]
);

/**
 * Module instance schema - embedded within scenes
 * 
 * Each module instance represents a positioned content block within a scene.
 * The `config` field contains module-specific settings validated at the
 * application layer (runtime type checks when rendering).
 * 
 * @property id - Unique identifier within the scene (UUID)
 * @property moduleType - Which module to render
 * @property order - Stack position (custom spacing, e.g., 0, 10, 20 for easy insertion)
 * @property config - Module-specific configuration (validated per module type)
 */
export const ModuleInstanceSchema = z.object({
  id: z.string().min(1).describe('Unique identifier within the scene'),
  moduleType: ModuleTypeSchema.describe('Which module type to render'),
  order: z.number().int().min(0).describe('Stack order (higher = further down)'),
  config: z.record(z.unknown()).describe('Module-specific configuration'),
});

export type ModuleInstance = z.infer<typeof ModuleInstanceSchema>;

/**
 * Scene document schema
 * 
 * Three-tier hierarchy:
 * - Org-wide: brandId = null, eventId = null
 * - Brand-specific: brandId set, eventId = null
 * - Event-specific: brandId set, eventId set
 * 
 * @property organizationId - Owning organization
 * @property brandId - Parent brand (null for org-wide scenes)
 * @property eventId - Parent event (null for brand-wide or org-wide scenes)
 * @property name - Display name for the scene
 * @property description - Optional notes for the creator
 * @property modules - Ordered array of module instances
 * @property createdAt - When the scene was created
 * @property updatedAt - When the scene was last modified
 * @property createdBy - User who created this scene
 */
export const SceneSchema = z.object({
  organizationId: z.string().describe('Owning organization'),
  brandId: z.string().nullable().describe('Parent brand (null for org-wide scenes)'),
  eventId: z.string().nullable().describe('Parent event (null for brand-wide or org-wide scenes)'),
  name: z.string().min(1).max(100).describe('Scene display name'),
  description: z.string().max(500).optional().describe('Optional notes for the creator'),
  modules: z.array(ModuleInstanceSchema)
    .max(MAX_MODULES_PER_SCENE, `A scene can contain a maximum of ${MAX_MODULES_PER_SCENE} modules`)
    .describe('Ordered array of module instances'),
  createdAt: z.date().describe('Scene creation timestamp'),
  updatedAt: z.date().describe('Last modification timestamp'),
  createdBy: z.string().describe('User who created this scene'),
}).refine(
  (data) => {
    // If eventId is set, brandId must also be set (events belong to brands)
    if (data.eventId !== null && data.brandId === null) {
      return false;
    }
    return true;
  },
  {
    message: 'Event-specific scenes must have a brandId set (events belong to brands)',
    path: ['brandId'],
  }
).refine(
  (data) => {
    // Module IDs must be unique within the scene
    const ids = data.modules.map((m) => m.id);
    return new Set(ids).size === ids.length;
  },
  {
    message: 'Module instance IDs must be unique within a scene',
    path: ['modules'],
  }
).refine(
  (data) => {
    // Module order values must be unique within the scene
    const orders = data.modules.map((m) => m.order);
    return new Set(orders).size === orders.length;
  },
  {
    message: 'Module order values must be unique within a scene',
    path: ['modules'],
  }
);

export type Scene = z.infer<typeof SceneSchema>;

/**
 * Scene document with typed ID
 */
export interface SceneDocument extends Omit<Scene, 'eventId' | 'brandId' | 'organizationId' | 'createdBy'> {
  id: SceneId;
  organizationId: OrganizationId;
  brandId: BrandId | null;
  eventId: EventId | null;
  createdBy: UserId;
}

/**
 * Data required to create a new scene
 * 
 * Omits auto-generated fields (createdAt, updatedAt).
 * Modules array can be empty for a blank scene.
 */
export const CreateSceneSchema = z.object({
  organizationId: z.string().describe('Owning organization'),
  brandId: z.string().nullable().default(null).describe('Parent brand (null for org-wide)'),
  eventId: z.string().nullable().default(null).describe('Parent event (null for brand-wide or org-wide)'),
  name: z.string().min(1).max(100).describe('Scene display name'),
  description: z.string().max(500).optional().describe('Optional notes'),
  modules: z.array(ModuleInstanceSchema)
    .max(MAX_MODULES_PER_SCENE, `A scene can contain a maximum of ${MAX_MODULES_PER_SCENE} modules`)
    .default([])
    .describe('Ordered array of module instances'),
  createdBy: z.string().describe('User creating the scene'),
}).refine(
  (data) => {
    if (data.eventId !== null && data.brandId === null) {
      return false;
    }
    return true;
  },
  {
    message: 'Event-specific scenes must have a brandId set (events belong to brands)',
    path: ['brandId'],
  }
).refine(
  (data) => {
    const ids = data.modules.map((m) => m.id);
    return new Set(ids).size === ids.length;
  },
  {
    message: 'Module instance IDs must be unique within a scene',
    path: ['modules'],
  }
).refine(
  (data) => {
    const orders = data.modules.map((m) => m.order);
    return new Set(orders).size === orders.length;
  },
  {
    message: 'Module order values must be unique within a scene',
    path: ['modules'],
  }
);

export type CreateSceneData = z.infer<typeof CreateSceneSchema>;

/**
 * Data for updating a scene
 * 
 * Cannot change ownership (organizationId) or creator after creation.
 * Can update scope (brandId, eventId), name, description, and modules.
 */
export const UpdateSceneSchema = z.object({
  brandId: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  modules: z.array(ModuleInstanceSchema)
    .max(MAX_MODULES_PER_SCENE, `A scene can contain a maximum of ${MAX_MODULES_PER_SCENE} modules`)
    .optional(),
}).refine(
  (data) => {
    if (!data.modules) return true;
    const ids = data.modules.map((m) => m.id);
    return new Set(ids).size === ids.length;
  },
  {
    message: 'Module instance IDs must be unique within a scene',
    path: ['modules'],
  }
).refine(
  (data) => {
    if (!data.modules) return true;
    const orders = data.modules.map((m) => m.order);
    return new Set(orders).size === orders.length;
  },
  {
    message: 'Module order values must be unique within a scene',
    path: ['modules'],
  }
);

export type UpdateSceneData = z.infer<typeof UpdateSceneSchema>;

// ===== Validation Helpers =====

export function validateSceneData(data: unknown): Scene {
  return SceneSchema.parse(data);
}

export function validateCreateSceneData(data: unknown): CreateSceneData {
  return CreateSceneSchema.parse(data);
}

export function validateUpdateSceneData(data: unknown): UpdateSceneData {
  return UpdateSceneSchema.parse(data);
}
