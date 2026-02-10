import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getArticleBySlug,
  getAllArticles,
  getRelatedArticles,
  getCategoryTitle,
} from "@/lib/help";

interface HelpArticlePageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Generate static paths for all published articles at build time
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const articles = getAllArticles(true);
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: HelpArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  return {
    title: `${article.title} | Help & Support`,
    description: article.description,
  };
}

/**
 * Help article detail page
 * Server Component - renders static HTML at build time
 */
export default async function HelpArticlePage({
  params,
}: HelpArticlePageProps): Promise<JSX.Element> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const allArticles = getAllArticles();
  const relatedArticles = getRelatedArticles(article, allArticles, 3);
  const categoryTitle = getCategoryTitle(article.category);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm">
            <Link
              href="/help"
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              Help
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">{article.title}</span>
          </nav>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-4">
            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
              {categoryTitle}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {article.title}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{article.description}</p>
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
        </header>

        {/* Rendered Markdown Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
          />
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <aside className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Related Articles
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedArticles.map(({ article: related }) => (
                <Link
                  key={related.slug}
                  href={`/help/${related.slug}`}
                  className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {related.description}
                  </p>
                </Link>
              ))}
            </div>
          </aside>
        )}

        {/* Back to Help Link */}
        <nav className="mt-12">
          <Link
            href="/help"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Help
          </Link>
        </nav>
      </article>
    </div>
  );
}
