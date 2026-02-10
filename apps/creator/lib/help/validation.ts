/**
 * Zod schemas for help article frontmatter validation
 */

import { z } from "zod";

/**
 * Schema for article frontmatter
 * Ensures all required metadata is present and correctly typed
 */
export const ArticleFrontmatterSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(true),
});

/**
 * Type-safe parser for frontmatter
 * @param data - Raw frontmatter data from gray-matter
 * @returns Validated frontmatter or null if validation fails
 */
export function validateFrontmatter(
  data: unknown
): z.infer<typeof ArticleFrontmatterSchema> | null {
  try {
    return ArticleFrontmatterSchema.parse(data);
  } catch (error) {
    console.error("Frontmatter validation failed:", error);
    return null;
  }
}
