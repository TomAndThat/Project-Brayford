import Link from "next/link";
import type { Metadata } from "next";
import {
  getAllArticles,
  getCategories,
  getCategoryTitle,
  buildSearchIndex,
} from "@/lib/help";
import HelpSearch from "./search-client";

export const metadata: Metadata = {
  title: "Help & Support | Project Brayford",
  description:
    "Find answers to common questions and learn how to get the most out of Project Brayford",
};

/**
 * Help hub page - main entry point for help documentation
 * Server Component - generates static HTML at build time
 */
export default function HelpPage(): JSX.Element {
  const articles = getAllArticles();
  const categories = getCategories();
  const searchIndex = buildSearchIndex(articles);

  // Group articles by category
  const articlesByCategory: Record<string, typeof articles> = {};
  categories.forEach((category) => {
    articlesByCategory[category] = articles.filter(
      (a) => a.category === category,
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Help & Support
          </h1>
          <p className="text-lg text-gray-600">
            Find answers to common questions and get started with Project
            Brayford
          </p>
        </div>
      </header>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HelpSearch searchIndex={searchIndex} />
      </div>

      {/* Categories Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Browse by Topic
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const categoryArticles = articlesByCategory[category] || [];
            const categoryTitle = getCategoryTitle(category);

            return (
              <article
                key={category}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {categoryTitle}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {categoryArticles.length} article
                  {categoryArticles.length !== 1 ? "s" : ""}
                </p>
                <ul className="space-y-2 mb-4">
                  {categoryArticles.slice(0, 4).map((article) => (
                    <li key={article.slug}>
                      <Link
                        href={`/help/${article.slug}`}
                        className="text-blue-600 hover:text-blue-700 hover:underline text-sm transition-colors"
                      >
                        {article.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                {categoryArticles.length > 4 && (
                  <p className="text-sm text-gray-500">
                    + {categoryArticles.length - 4} more
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* All Articles List */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">All Articles</h2>
        <div className="space-y-3">
          {articles.map((article) => (
            <article
              key={article.slug}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <Link href={`/help/${article.slug}`} className="block">
                <h3 className="text-lg font-semibold text-blue-600 hover:text-blue-700 mb-1 transition-colors">
                  {article.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  {article.description}
                </p>
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
