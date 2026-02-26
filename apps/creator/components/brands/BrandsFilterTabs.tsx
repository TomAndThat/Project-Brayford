"use client";

import type { BrandDocument } from "@brayford/core";
import type { BrandFilter } from "@/hooks/use-brands-page-data";

interface BrandsFilterTabsProps {
  brands: BrandDocument[];
  filter: BrandFilter;
  onFilterChange: (filter: BrandFilter) => void;
}

export default function BrandsFilterTabs({
  brands,
  filter,
  onFilterChange,
}: BrandsFilterTabsProps) {
  const tabs: {
    key: BrandFilter;
    label: string;
    count: number;
    testId: string;
  }[] = [
    {
      key: "active",
      label: "Active",
      count: brands.filter((b) => b.isActive).length,
      testId: "filter-active",
    },
    {
      key: "archived",
      label: "Archived",
      count: brands.filter((b) => !b.isActive).length,
      testId: "filter-archived",
    },
    {
      key: "all",
      label: "All",
      count: brands.length,
      testId: "filter-all",
    },
  ];

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              data-testid={tab.testId}
              className={`${
                isActive
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.label}
              <span
                className={`ml-2 ${
                  isActive
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-900"
                } py-0.5 px-2.5 rounded-full text-xs font-medium`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
