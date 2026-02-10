"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { searchIndex } from "@/lib/help/search";
import type { SearchIndexEntry } from "@/lib/help/types";

interface HelpSearchProps {
  searchIndex: SearchIndexEntry[];
}

/**
 * Client-side search component with dropdown results
 * Uses pre-built search index for fast client-side filtering
 */
export default function HelpSearch({
  searchIndex: index,
}: HelpSearchProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter results based on query
  const results = query.trim().length > 0 ? searchIndex(query, index) : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showResults]);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setShowResults(false);
      }
    }

    if (showResults) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showResults]);

  return (
    <div className="relative max-w-2xl" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          placeholder="Search articles..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
          aria-label="Search help articles"
        />
        <svg
          className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Search Results Dropdown */}
      {showResults && query.trim().length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto"
          role="listbox"
        >
          {results.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {results.map((entry) => (
                <li key={entry.slug} role="option">
                  <Link
                    href={`/help/${entry.slug}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      setQuery("");
                      setShowResults(false);
                    }}
                  >
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {entry.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {entry.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <p className="mb-1">
                No articles found matching &quot;{query}&quot;
              </p>
              <p className="text-sm">Try different keywords</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
