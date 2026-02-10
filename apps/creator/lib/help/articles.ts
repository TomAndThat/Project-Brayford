/**
 * Help article file system operations
 *
 * SERVER-ONLY: Uses Node.js fs module. Do not import in Client Components.
 *
 * This module handles reading, parsing, and validating markdown help articles
 * from the file system. All operations include error handling and validation.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import { validateFrontmatter } from "./validation";
import type { HelpArticle } from "./types";

const md = new MarkdownIt({
  html: false, // Disable HTML for security
  linkify: true, // Auto-convert URLs to links
  typographer: true, // Smart quotes and other typography
});

/**
 * Get absolute path to help articles directory
 */
function getArticlesDirectory(): string {
  return path.join(process.cwd(), "content", "help-articles");
}

/**
 * Recursively find all markdown files in a directory
 * @param dir - Directory to search
 * @returns Array of absolute file paths
 */
function getAllArticleFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    if (!fs.existsSync(dir)) {
      console.warn(`Help articles directory not found: ${dir}`);
      return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...getAllArticleFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Generate URL-safe slug from file path
 * Examples:
 *   getting-started/index.md -> getting-started
 *   getting-started/creating-events.md -> getting-started-creating-events
 *   troubleshooting/audience-access.md -> troubleshooting-audience-access
 */
function generateSlug(filePath: string): string {
  const articlesDir = getArticlesDirectory();
  const relative = path.relative(articlesDir, filePath);
  const withoutExtension = relative.replace(/\.md$/, "");
  const parts = withoutExtension.split(path.sep);

  // If file is index.md, use parent directory name only
  if (parts[parts.length - 1] === "index") {
    return parts.slice(0, -1).join("-");
  }

  return parts.join("-");
}

/**
 * Parse a single markdown file into a HelpArticle
 * @param filePath - Absolute path to markdown file
 * @returns Parsed article or null if parsing fails
 */
function parseArticleFile(filePath: string): HelpArticle | null {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    // Validate frontmatter
    const validatedData = validateFrontmatter(data);
    if (!validatedData) {
      console.error(`Invalid frontmatter in ${filePath}`);
      return null;
    }

    const slug = generateSlug(filePath);
    const htmlContent = md.render(content);

    return {
      slug,
      title: validatedData.title,
      description: validatedData.description,
      category: validatedData.category,
      tags: validatedData.tags,
      published: validatedData.published,
      content,
      htmlContent,
    };
  } catch (error) {
    console.error(`Error parsing article ${filePath}:`, error);
    return null;
  }
}

/**
 * Get all published help articles
 * @param onlyPublished - If true, exclude drafts (default: true)
 * @returns Array of parsed articles, sorted alphabetically by title
 */
export function getAllArticles(onlyPublished: boolean = true): HelpArticle[] {
  const articlesDir = getArticlesDirectory();
  const files = getAllArticleFiles(articlesDir);

  const articles = files
    .map(parseArticleFile)
    .filter((article): article is HelpArticle => article !== null)
    .filter((article) => !onlyPublished || article.published)
    .sort((a, b) => a.title.localeCompare(b.title));

  return articles;
}

/**
 * Get a single article by slug
 * @param slug - URL slug of the article
 * @returns Article if found, null otherwise
 */
export function getArticleBySlug(slug: string): HelpArticle | null {
  const articles = getAllArticles(false); // Include drafts for preview
  return articles.find((article) => article.slug === slug) || null;
}

/**
 * Get all articles in a specific category
 * @param category - Category slug
 * @returns Articles in the category, sorted by title
 */
export function getArticlesByCategory(category: string): HelpArticle[] {
  const articles = getAllArticles();
  return articles.filter((article) => article.category === category);
}

/**
 * Get unique list of all categories
 * @returns Sorted array of category slugs
 */
export function getCategories(): string[] {
  const articles = getAllArticles();
  const categories = Array.from(new Set(articles.map((a) => a.category)));
  return categories.sort();
}

/**
 * Get human-readable title for a category slug
 * Examples: "getting-started" -> "Getting Started"
 */
export function getCategoryTitle(categorySlug: string): string {
  return categorySlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
