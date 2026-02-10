/**
 * Search functionality for help articles
 *
 * Implements TF-IDF (Term Frequency-Inverse Document Frequency) for relevance ranking
 * Provides both server-side search and client-side search index generation
 */

import type { HelpArticle, SearchIndexEntry } from "./types";

/**
 * Tokenize text into searchable terms
 * - Converts to lowercase
 * - Removes punctuation
 * - Splits on whitespace
 * - Filters out common stop words
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "will",
    "with",
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // Remove punctuation except hyphens
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Calculate term frequency for a document
 */
function calculateTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = tokens.length;

  tokens.forEach((token) => {
    tf.set(token, (tf.get(token) || 0) + 1);
  });

  // Normalize by document length
  tf.forEach((count, term) => {
    tf.set(term, count / totalTerms);
  });

  return tf;
}

/**
 * Calculate inverse document frequency across all articles
 */
function calculateIDF(articles: HelpArticle[]): Map<string, number> {
  const documentCount = articles.length;
  const termDocumentCount = new Map<string, number>();

  // Count how many documents contain each term
  articles.forEach((article) => {
    const searchText = `${article.title} ${article.description} ${article.content}`;
    const tokens = tokenize(searchText);
    const uniqueTokens = new Set(tokens);

    uniqueTokens.forEach((token) => {
      termDocumentCount.set(token, (termDocumentCount.get(token) || 0) + 1);
    });
  });

  // Calculate IDF for each term
  const idf = new Map<string, number>();
  termDocumentCount.forEach((count, term) => {
    idf.set(term, Math.log(documentCount / count));
  });

  return idf;
}

/**
 * Search articles using TF-IDF relevance scoring
 * @param query - Search query string
 * @param articles - Array of articles to search
 * @returns Sorted array of articles by relevance
 */
export function searchArticles(
  query: string,
  articles: HelpArticle[]
): HelpArticle[] {
  if (!query.trim() || articles.length === 0) {
    return [];
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return [];
  }

  const idf = calculateIDF(articles);

  const scores = articles.map((article) => {
    const searchText = `${article.title} ${article.description} ${article.content}`;
    const tokens = tokenize(searchText);
    const tf = calculateTermFrequency(tokens);

    let score = 0;

    // Calculate TF-IDF score for query terms
    queryTokens.forEach((queryToken) => {
      const tfValue = tf.get(queryToken) || 0;
      const idfValue = idf.get(queryToken) || 0;
      score += tfValue * idfValue;
    });

    // Boost exact title matches
    if (article.title.toLowerCase().includes(query.toLowerCase())) {
      score += 10; // Strong boost for title matches
    }

    // Boost tag matches (exact or partial)
    article.tags.forEach((tag) => {
      const tagLower = tag.toLowerCase();
      queryTokens.forEach((queryToken) => {
        if (tagLower === queryToken) {
          score += 5; // Strong boost for exact tag match
        } else if (tagLower.includes(queryToken) || queryToken.includes(tagLower)) {
          score += 2; // Moderate boost for partial tag match
        }
      });
    });

    return { article, score };
  });

  return scores
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.article);
}

/**
 * Generate search index for client-side search
 * Creates lightweight entries with excerpts for faster client bundles
 */
export function buildSearchIndex(articles: HelpArticle[]): SearchIndexEntry[] {
  return articles.map((article) => ({
    slug: article.slug,
    title: article.title,
    description: article.description,
    category: article.category,
    tags: article.tags,
    // First 200 chars of content for search
    excerpt: article.content.slice(0, 200).replace(/\n/g, " "),
  }));
}

/**
 * Client-side search against pre-built index
 * Simpler algorithm for client performance
 */
export function searchIndex(
  query: string,
  index: SearchIndexEntry[]
): SearchIndexEntry[] {
  if (!query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const queryTokens = tokenize(query);

  const scores = index.map((entry) => {
    let score = 0;

    // Title match (highest weight)
    if (entry.title.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Description match
    if (entry.description.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // Tag match
    entry.tags.forEach((tag) => {
      if (tag.toLowerCase().includes(queryLower)) {
        score += 3;
      }
    });

    // Token matches in excerpt
    const entryTokens = tokenize(
      `${entry.title} ${entry.description} ${entry.excerpt}`
    );
    queryTokens.forEach((queryToken) => {
      if (entryTokens.includes(queryToken)) {
        score += 1;
      }
    });

    return { entry, score };
  });

  return scores
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);
}
