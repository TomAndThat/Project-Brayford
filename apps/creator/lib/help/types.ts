/**
 * Type definitions for the help system
 */

/**
 * Parsed help article with validated frontmatter and rendered HTML
 */
export interface HelpArticle {
  /** URL-safe slug derived from file path */
  slug: string;
  /** Article title from frontmatter */
  title: string;
  /** Brief description for search results and previews */
  description: string;
  /** Category for grouping articles */
  category: string;
  /** Tags for filtering and related articles */
  tags: string[];
  /** Whether article is published (false = draft) */
  published: boolean;
  /** Raw markdown content */
  content: string;
  /** Rendered HTML content */
  htmlContent: string;
}

/**
 * Validated frontmatter schema
 */
export interface ArticleFrontmatter {
  title: string;
  description: string;
  category: string;
  tags: string[];
  published: boolean;
}

/**
 * Search index entry (lightweight for client bundle)
 */
export interface SearchIndexEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  /** Excerpt of content for search matching */
  excerpt: string;
}

/**
 * Related article with relevance score
 */
export interface RelatedArticle {
  article: HelpArticle;
  score: number;
  reason: "same-category" | "shared-tags" | "content-similarity";
}
