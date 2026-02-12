/**
 * Brand Schema - Organization Domain
 * 
 * Brands represent public-facing content brands that belong to organizations.
 * Examples: "Goal Hanger", "MrBeast Gaming", "The Jane Show"
 * 
 * Organizations can have multiple brands, and events belong to brands.
 * 
 * Firestore Collection: /brands/{brandId}
 */

import { z } from 'zod';
import type { BrandId, OrganizationId } from '../types/branded';

/**
 * Brand styling configuration
 * 
 * @property backgroundColor - Background color as hex code (e.g., #0A0A0A)
 * @property textColor - Text color as hex code (e.g., #FFFFFF)
 */
export const BrandStylingSchema = z.object({
  backgroundColor: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color (e.g., #0A0A0A)')
    .describe('Background color as hex code')
    .optional(),
  textColor: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color (e.g., #FFFFFF)')
    .describe('Text color as hex code')
    .optional(),
}).optional();

export type BrandStyling = z.infer<typeof BrandStylingSchema>;

/**
 * Brand document schema
 * 
 * @property organizationId - Reference to owning organization
 * @property name - Public-facing brand name
 * @property styling - Optional styling configuration (colors, fonts, etc.)
 * @property createdAt - When the brand was created
 * @property isActive - Whether brand is active (false = archived, hidden from UI)
 */
export const BrandSchema = z.object({
  organizationId: z.string().describe('Reference to owning organization'),
  name: z.string().min(1).max(100).describe('Brand name'),
  styling: BrandStylingSchema.describe('Brand styling configuration'),
  createdAt: z.date().describe('Brand creation timestamp'),
  isActive: z.boolean().default(true).describe('Whether brand is active'),
});

export type Brand = z.infer<typeof BrandSchema>;

/**
 * Brand document with typed ID
 */
export interface BrandDocument extends Brand {
  id: BrandId;
  organizationId: OrganizationId;
}

/**
 * Data required to create a new brand
 */
export const CreateBrandSchema = BrandSchema.omit({
  createdAt: true,
  isActive: true,
  styling: true,
});
export type CreateBrandData = z.infer<typeof CreateBrandSchema>;

/**
 * Data for updating a brand
 */
export const UpdateBrandSchema = BrandSchema.partial().omit({
  organizationId: true, // Cannot change ownership
  createdAt: true,
});
export type UpdateBrandData = z.infer<typeof UpdateBrandSchema>;

// ===== Validation Helpers =====

export function validateBrandData(data: unknown): Brand {
  return BrandSchema.parse(data);
}

export function validateCreateBrandData(data: unknown): CreateBrandData {
  return CreateBrandSchema.parse(data);
}

export function validateUpdateBrandData(data: unknown): UpdateBrandData {
  return UpdateBrandSchema.parse(data);
}
