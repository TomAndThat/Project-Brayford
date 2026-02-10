/**
 * Related articles recommendation system
 *
 * Uses multiple signals to find relevant related articles:
 * - Shared tags (content similarity)
 * - Same category (topical relevance)
 * - Content similarity (basic text analysis)
 */

import type { HelpArticle, RelatedArticle } from "./types";

/**
 * Calculate Jaccard similarity between two sets
 * Returns a value between 0 (no overlap) and 1 (identical)
 */
function jaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Extract significant words from content for similarity comparison
 */
function extractSignificantWords(content: string): Set<string> {
  const stopWords = new Set([
    "the",
    "be",
    "to",
    "of",
    "and",
    "a",
    "in",
    "that",
    "have",
    "i",
    "it",
    "for",
    "not",
    "on",
    "with",
    "he",
    "as",
    "you",
    "do",
    "at",
    "this",
    "but",
    "his",
    "by",
    "from",
  ]);

  return new Set(
    content
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 100) // Limit to first 100 significant words for performance
  );
}

/**
 * Score how related two articles are
 * Returns a score between 0 (unrelated) and 1 (highly related)
 */
function calculateRelatednessScore(
  articleA: HelpArticle,
  articleB: HelpArticle
): {
  score: number;
  reason: "same-category" | "shared-tags" | "content-similarity";
} {
  let score = 0;
  let primaryReason: "same-category" | "shared-tags" | "content-similarity" =
    "content-similarity";

  // Same category (moderate relevance)
  if (articleA.category === articleB.category) {
    score += 0.3;
    primaryReason = "same-category";
  }

  // Shared tags (strong relevance signal)
  const tagsA = new Set(articleA.tags);
  const tagsB = new Set(articleB.tags);
  const tagSimilarity = jaccardSimilarity(tagsA, tagsB);
  if (tagSimilarity > 0) {
    score += tagSimilarity * 0.5;
    primaryReason = "shared-tags";
  }

  // Content similarity (weak but useful signal)
  const wordsA = extractSignificantWords(articleA.content);
  const wordsB = extractSignificantWords(articleB.content);
  const contentSimilarity = jaccardSimilarity(wordsA, wordsB);
  score += contentSimilarity * 0.2;

  return { score, reason: primaryReason };
}

/**
 * Get related articles for a given article
 * @param article - The article to find related content for
 * @param allArticles - Pool of all available articles
 * @param limit - Maximum number of related articles to return
 * @returns Sorted array of related articles with scores and reasons
 */
export function getRelatedArticles(
  article: HelpArticle,
  allArticles: HelpArticle[],
  limit: number = 3
): RelatedArticle[] {
  const otherArticles = allArticles.filter((a) => a.slug !== article.slug);

  const scored: RelatedArticle[] = otherArticles
    .map((other) => {
      const { score, reason } = calculateRelatednessScore(article, other);
      return {
        article: other,
        score,
        reason,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * Get articles sharing specific tags
 * @param tags - Array of tags to match
 * @param allArticles - Pool of all available articles
 * @param excludeSlug - Optional slug to exclude (e.g., current article)
 * @param limit - Maximum results
 */
export function getArticlesByTags(
  tags: string[],
  allArticles: HelpArticle[],
  excludeSlug?: string,
  limit: number = 10
): HelpArticle[] {
  const tagSet = new Set(tags);

  return allArticles
    .filter((article) => article.slug !== excludeSlug)
    .map((article) => {
      const matchingTags = article.tags.filter((tag) => tagSet.has(tag));
      return {
        article,
        matches: matchingTags.length,
      };
    })
    .filter((item) => item.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, limit)
    .map((item) => item.article);
}
