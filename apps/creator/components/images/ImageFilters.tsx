"use client";

import type { SortOption } from "@/hooks/use-images-page-data";

interface ImageFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  allTags: string[];
}

export default function ImageFilters({
  searchQuery,
  onSearchChange,
  tagFilter,
  onTagFilterChange,
  sortBy,
  onSortChange,
  allTags,
}: ImageFiltersProps) {
  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Search */}
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        {/* Tag filter */}
        <div>
          <label
            htmlFor="tag-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Filter by Tag
          </label>
          <select
            id="tag-filter"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div>
          <label
            htmlFor="sort-by"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Sort By
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          >
            <option value="date">Date Uploaded</option>
            <option value="name">Name</option>
            <option value="size">File Size</option>
          </select>
        </div>
      </div>
    </div>
  );
}
