"use client";

import {
  fromBranded,
  type BrandDocument,
  type EventDocument,
} from "@brayford/core";
import type { ScopeFilter } from "@/hooks/use-scenes-page-data";

interface SceneFiltersProps {
  scopeFilter: ScopeFilter;
  onScopeChange: (scope: ScopeFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  brands: BrandDocument[];
  events: EventDocument[];
}

export default function SceneFilters({
  scopeFilter,
  onScopeChange,
  searchQuery,
  onSearchChange,
  brands,
  events,
}: SceneFiltersProps) {
  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scope filter */}
        <div>
          <label
            htmlFor="scope-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Scope
          </label>
          <select
            id="scope-filter"
            value={scopeFilter}
            onChange={(e) => onScopeChange(e.target.value)}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">All Scenes</option>
            <option value="org">Organisation-wide</option>
            <optgroup label="Brands">
              {brands.map((brand) => (
                <option
                  key={fromBranded(brand.id)}
                  value={`brand:${fromBranded(brand.id)}`}
                >
                  {brand.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Events">
              {events.map((event) => (
                <option
                  key={fromBranded(event.id)}
                  value={`event:${fromBranded(event.id)}`}
                >
                  {event.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

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
            placeholder="Search scenes, brands, or events..."
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
  );
}
