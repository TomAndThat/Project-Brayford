/**
 * Tests for help article validation
 */

import { describe, it, expect } from "vitest";
import { validateFrontmatter, ArticleFrontmatterSchema } from "./validation";

describe("validateFrontmatter", () => {
  it("validates correct frontmatter", () => {
    const data = {
      title: "Test Article",
      description: "Test description",
      category: "test-category",
      tags: ["tag1", "tag2"],
      published: true,
    };

    const result = validateFrontmatter(data);
    expect(result).toEqual(data);
  });

  it("applies default values for optional fields", () => {
    const data = {
      title: "Test Article",
      description: "Test description",
      category: "test-category",
    };

    const result = validateFrontmatter(data);
    expect(result).toEqual({
      ...data,
      tags: [],
      published: true,
    });
  });

  it("returns null for missing required fields", () => {
    const data = {
      title: "Test Article",
      // Missing description and category
    };

    const result = validateFrontmatter(data);
    expect(result).toBeNull();
  });

  it("returns null for invalid field types", () => {
    const data = {
      title: "Test Article",
      description: "Test description",
      category: "test-category",
      tags: "not-an-array", // Invalid type
    };

    const result = validateFrontmatter(data);
    expect(result).toBeNull();
  });

  it("returns null for empty title", () => {
    const data = {
      title: "",
      description: "Test description",
      category: "test-category",
    };

    const result = validateFrontmatter(data);
    expect(result).toBeNull();
  });

  it("handles boolean published field", () => {
    const published = {
      title: "Published Article",
      description: "Test",
      category: "test",
      published: true,
    };

    const draft = {
      title: "Draft Article",
      description: "Test",
      category: "test",
      published: false,
    };

    expect(validateFrontmatter(published)?.published).toBe(true);
    expect(validateFrontmatter(draft)?.published).toBe(false);
  });
});

describe("ArticleFrontmatterSchema", () => {
  it("correctly parses valid data", () => {
    const data = {
      title: "Test",
      description: "Description",
      category: "category",
      tags: ["a", "b"],
      published: false,
    };

    const result = ArticleFrontmatterSchema.parse(data);
    expect(result).toEqual(data);
  });

  it("throws error for invalid data", () => {
    const data = {
      title: "Test",
      // Missing required fields
    };

    expect(() => ArticleFrontmatterSchema.parse(data)).toThrow();
  });
});
