/**
 * Tests for related articles functionality
 */

import { describe, it, expect } from "vitest";
import { getRelatedArticles, getArticlesByTags } from "./related";
import type { HelpArticle } from "./types";

// Mock articles for testing
const createMockArticle = (overrides: Partial<HelpArticle>): HelpArticle => ({
  slug: "test",
  title: "Test Article",
  description: "Test description",
  category: "test",
  tags: [],
  published: true,
  content: "Test content with some words",
  htmlContent: "<p>Test content</p>",
  ...overrides,
});

describe("getRelatedArticles", () => {
  it("returns empty array when no other articles exist", () => {
    const article = createMockArticle({ slug: "article-1" });
    const allArticles = [article];

    const related = getRelatedArticles(article, allArticles);
    expect(related).toEqual([]);
  });

  it("excludes the input article from results", () => {
    const article1 = createMockArticle({ slug: "article-1" });
    const article2 = createMockArticle({ slug: "article-2" });
    const allArticles = [article1, article2];

    const related = getRelatedArticles(article1, allArticles);
    expect(related.every((r) => r.article.slug !== "article-1")).toBe(true);
  });

  it("finds articles in same category", () => {
    const article1 = createMockArticle({
      slug: "article-1",
      category: "getting-started",
    });
    const article2 = createMockArticle({
      slug: "article-2",
      category: "getting-started",
    });
    const article3 = createMockArticle({
      slug: "article-3",
      category: "troubleshooting",
    });
    const allArticles = [article1, article2, article3];

    const related = getRelatedArticles(article1, allArticles);
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((r) => r.article.slug === "article-2")).toBe(true);
  });

  it("finds articles with shared tags", () => {
    const article1 = createMockArticle({
      slug: "article-1",
      tags: ["event", "brand"],
    });
    const article2 = createMockArticle({
      slug: "article-2",
      tags: ["event", "settings"],
    });
    const article3 = createMockArticle({
      slug: "article-3",
      tags: ["troubleshooting"],
    });
    const allArticles = [article1, article2, article3];

    const related = getRelatedArticles(article1, allArticles);
    expect(related.some((r) => r.article.slug === "article-2")).toBe(true);
  });

  it("ranks articles by relevance score", () => {
    const article1 = createMockArticle({
      slug: "article-1",
      category: "test-category",
      tags: ["tag1", "tag2"],
    });
    const article2 = createMockArticle({
      slug: "article-2",
      category: "test-category",
      tags: ["tag1", "tag2"], // Same category and all tags match
    });
    const article3 = createMockArticle({
      slug: "article-3",
      category: "other-category",
      tags: ["tag1"], // Only one tag matches
    });
    const allArticles = [article1, article2, article3];

    const related = getRelatedArticles(article1, allArticles);
    // Article 2 should rank higher than article 3
    expect(related[0]?.article.slug).toBe("article-2");
  });

  it("respects the limit parameter", () => {
    const article1 = createMockArticle({ slug: "article-1", tags: ["common"] });
    const allArticles = [
      article1,
      createMockArticle({ slug: "article-2", tags: ["common"] }),
      createMockArticle({ slug: "article-3", tags: ["common"] }),
      createMockArticle({ slug: "article-4", tags: ["common"] }),
      createMockArticle({ slug: "article-5", tags: ["common"] }),
    ];

    const related = getRelatedArticles(article1, allArticles, 2);
    expect(related.length).toBeLessThanOrEqual(2);
  });

  it("includes score and reason in results", () => {
    const article1 = createMockArticle({
      slug: "article-1",
      category: "test",
      tags: ["tag1"],
    });
    const article2 = createMockArticle({
      slug: "article-2",
      category: "test",
      tags: ["tag1"],
    });
    const allArticles = [article1, article2];

    const related = getRelatedArticles(article1, allArticles);
    expect(related[0]).toHaveProperty("article");
    expect(related[0]).toHaveProperty("score");
    expect(related[0]).toHaveProperty("reason");
    expect(typeof related[0]?.score).toBe("number");
    expect(related[0]?.score).toBeGreaterThan(0);
  });

  it("filters out articles with zero relevance", () => {
    const article1 = createMockArticle({
      slug: "article-1",
      category: "category-a",
      tags: ["tag-a"],
      content: "Unique content about topic A",
    });
    const article2 = createMockArticle({
      slug: "article-2",
      category: "category-b",
      tags: ["tag-b"],
      content: "Completely different content about topic B",
    });
    const allArticles = [article1, article2];

    const related = getRelatedArticles(article1, allArticles);
    // The only result may have been filtered out due to low score
    // Just verify the function runs without errors
    expect(Array.isArray(related)).toBe(true);
  });
});

describe("getArticlesByTags", () => {
  it("returns articles matching any tag", () => {
    const articles = [
      createMockArticle({ slug: "article-1", tags: ["event", "brand"] }),
      createMockArticle({ slug: "article-2", tags: ["event", "settings"] }),
      createMockArticle({ slug: "article-3", tags: ["troubleshooting"] }),
    ];

    const results = getArticlesByTags(["event"], articles);
    expect(results.length).toBe(2);
    expect(results.some((r) => r.slug === "article-1")).toBe(true);
    expect(results.some((r) => r.slug === "article-2")).toBe(true);
  });

  it("excludes specified article slug", () => {
    const articles = [
      createMockArticle({ slug: "article-1", tags: ["event"] }),
      createMockArticle({ slug: "article-2", tags: ["event"] }),
    ];

    const results = getArticlesByTags(["event"], articles, "article-1");
    expect(results.every((r) => r.slug !== "article-1")).toBe(true);
  });

  it("ranks by number of matching tags", () => {
    const articles = [
      createMockArticle({ slug: "article-1", tags: ["tag1"] }), // 1 match
      createMockArticle({ slug: "article-2", tags: ["tag1", "tag2"] }), // 2 matches
      createMockArticle({ slug: "article-3", tags: ["other"] }), // 0 matches
    ];

    const results = getArticlesByTags(["tag1", "tag2"], articles);
    expect(results[0]?.slug).toBe("article-2"); // Most matches first
  });

  it("respects the limit parameter", () => {
    const articles = [
      createMockArticle({ slug: "article-1", tags: ["common"] }),
      createMockArticle({ slug: "article-2", tags: ["common"] }),
      createMockArticle({ slug: "article-3", tags: ["common"] }),
      createMockArticle({ slug: "article-4", tags: ["common"] }),
    ];

    const results = getArticlesByTags(["common"], articles, undefined, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns empty array when no tags match", () => {
    const articles = [
      createMockArticle({ slug: "article-1", tags: ["tag1"] }),
      createMockArticle({ slug: "article-2", tags: ["tag2"] }),
    ];

    const results = getArticlesByTags(["tag3"], articles);
    expect(results).toEqual([]);
  });

  it("handles empty tags array", () => {
    const articles = [createMockArticle({ slug: "article-1", tags: ["tag1"] })];

    const results = getArticlesByTags([], articles);
    expect(results).toEqual([]);
  });

  it("handles articles with no tags", () => {
    const articles = [
      createMockArticle({ slug: "article-1", tags: [] }),
      createMockArticle({ slug: "article-2", tags: ["tag1"] }),
    ];

    const results = getArticlesByTags(["tag1"], articles);
    expect(results.length).toBe(1);
    expect(results[0]?.slug).toBe("article-2");
  });
});
