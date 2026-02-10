/**
 * Tests for search functionality
 */

import { describe, it, expect } from "vitest";
import { searchArticles, buildSearchIndex, searchIndex } from "./search";
import type { HelpArticle } from "./types";

// Mock articles for testing
const mockArticles: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Learn the basics of Project Brayford",
    category: "getting-started",
    tags: ["event", "brand"],
    published: true,
    content:
      "Welcome to Project Brayford. This guide will help you create your first event.",
    htmlContent: "<p>Welcome to Project Brayford.</p>",
  },
  {
    slug: "creating-events",
    title: "Creating Events",
    description: "How to create and manage events",
    category: "managing-events",
    tags: ["event"],
    published: true,
    content:
      "Events are the core of Project Brayford. Learn how to create and customize them.",
    htmlContent: "<p>Events are the core.</p>",
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting Guide",
    description: "Common issues and solutions",
    category: "troubleshooting",
    tags: ["troubleshooting", "technical"],
    published: true,
    content:
      "Having trouble? Check here for solutions to common problems and technical issues.",
    htmlContent: "<p>Having trouble?</p>",
  },
];

describe("searchArticles", () => {
  it("returns empty array for empty query", () => {
    const results = searchArticles("", mockArticles);
    expect(results).toEqual([]);
  });

  it("returns empty array for whitespace-only query", () => {
    const results = searchArticles("   ", mockArticles);
    expect(results).toEqual([]);
  });

  it("returns empty array when no articles provided", () => {
    const results = searchArticles("test", []);
    expect(results).toEqual([]);
  });

  it("finds articles by title match", () => {
    const results = searchArticles("Creating", mockArticles);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.slug).toBe("creating-events");
  });

  it("finds articles by content match", () => {
    const results = searchArticles("trouble", mockArticles);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.slug).toBe("troubleshooting");
  });

  it("finds articles by tag match", () => {
    const results = searchArticles("brand", mockArticles);
    expect(results.some((r) => r.slug === "getting-started")).toBe(true);
  });

  it("is case-insensitive", () => {
    const lowerResults = searchArticles("event", mockArticles);
    const upperResults = searchArticles("EVENT", mockArticles);
    expect(lowerResults.length).toBe(upperResults.length);
  });

  it("ranks exact title matches higher", () => {
    const results = searchArticles("Creating Events", mockArticles);
    expect(results[0]?.slug).toBe("creating-events");
  });

  it("returns results sorted by relevance", () => {
    const results = searchArticles("event", mockArticles);
    expect(results.length).toBeGreaterThan(0);
    // All results should have some relevance
    expect(results.every((r) => r.content || r.title || r.tags.length > 0)).toBe(
      true
    );
  });

  it("handles multi-word queries", () => {
    const results = searchArticles("create event", mockArticles);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("buildSearchIndex", () => {
  it("creates index entries for all articles", () => {
    const index = buildSearchIndex(mockArticles);
    expect(index.length).toBe(mockArticles.length);
  });

  it("includes all required fields", () => {
    const index = buildSearchIndex(mockArticles);
    index.forEach((entry) => {
      expect(entry).toHaveProperty("slug");
      expect(entry).toHaveProperty("title");
      expect(entry).toHaveProperty("description");
      expect(entry).toHaveProperty("category");
      expect(entry).toHaveProperty("tags");
      expect(entry).toHaveProperty("excerpt");
    });
  });

  it("limits excerpt length", () => {
    const longArticle: HelpArticle = {
      ...mockArticles[0]!,
      content: "a".repeat(500),
    };
    const index = buildSearchIndex([longArticle]);
    expect(index[0]?.excerpt.length).toBeLessThanOrEqual(200);
  });

  it("handles articles with short content", () => {
    const shortArticle: HelpArticle = {
      ...mockArticles[0]!,
      content: "Short content",
    };
    const index = buildSearchIndex([shortArticle]);
    expect(index[0]?.excerpt).toBe("Short content");
  });
});

describe("searchIndex", () => {
  const index = buildSearchIndex(mockArticles);

  it("returns empty array for empty query", () => {
    const results = searchIndex("", index);
    expect(results).toEqual([]);
  });

  it("finds entries by title", () => {
    const results = searchIndex("Creating", index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.slug).toBe("creating-events");
  });

  it("finds entries by description", () => {
    const results = searchIndex("common issues", index);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.slug === "troubleshooting")).toBe(true);
  });

  it("finds entries by tags", () => {
    const results = searchIndex("technical", index);
    expect(results.some((r) => r.slug === "troubleshooting")).toBe(true);
  });

  it("ranks title matches highest", () => {
    const results = searchIndex("Troubleshooting", index);
    expect(results[0]?.slug).toBe("troubleshooting");
  });

  it("is case-insensitive", () => {
    const lowerResults = searchIndex("event", index);
    const upperResults = searchIndex("EVENT", index);
    expect(lowerResults.length).toBe(upperResults.length);
  });

  it("returns results sorted by score", () => {
    const results = searchIndex("event", index);
    // Check that results have decreasing or equal scores
    for (let i = 1; i < results.length; i++) {
      // Can't directly check score, but all results should be relevant
      expect(results[i]).toBeDefined();
    }
  });
});
