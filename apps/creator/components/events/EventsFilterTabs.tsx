"use client";

import type { EventDocument } from "@brayford/core";
import { type EventFilter, isEventGroup } from "@/hooks/use-events-page-data";

interface FilterTab {
  key: EventFilter;
  label: string;
  count: number;
  activeColor: string;
  badgeActiveColor: string;
  testId?: string;
}

interface EventsFilterTabsProps {
  events: EventDocument[];
  filter: EventFilter;
  onFilterChange: (filter: EventFilter) => void;
}

export default function EventsFilterTabs({
  events,
  filter,
  onFilterChange,
}: EventsFilterTabsProps) {
  const tabs: FilterTab[] = [
    {
      key: "active",
      label: "Active",
      count: events.filter((e) => e.isActive).length,
      activeColor: "border-blue-500 text-blue-600",
      badgeActiveColor: "bg-blue-100 text-blue-600",
      testId: "filter-active",
    },
    {
      key: "groups",
      label: "Event Groups",
      count: events.filter((e) => e.isActive && isEventGroup(e)).length,
      activeColor: "border-purple-500 text-purple-600",
      badgeActiveColor: "bg-purple-100 text-purple-600",
    },
    {
      key: "standalone",
      label: "Standalone",
      count: events.filter(
        (e) => e.isActive && e.eventType === "event" && !e.parentEventId,
      ).length,
      activeColor: "border-blue-500 text-blue-600",
      badgeActiveColor: "bg-blue-100 text-blue-600",
    },
    {
      key: "children",
      label: "Child Events",
      count: events.filter(
        (e) => e.isActive && e.eventType === "event" && !!e.parentEventId,
      ).length,
      activeColor: "border-indigo-500 text-indigo-600",
      badgeActiveColor: "bg-indigo-100 text-indigo-600",
    },
    {
      key: "archived",
      label: "Archived",
      count: events.filter((e) => !e.isActive).length,
      activeColor: "border-blue-500 text-blue-600",
      badgeActiveColor: "bg-blue-100 text-blue-600",
      testId: "filter-archived",
    },
    {
      key: "all",
      label: "All",
      count: events.length,
      activeColor: "border-blue-500 text-blue-600",
      badgeActiveColor: "bg-blue-100 text-blue-600",
      testId: "filter-all",
    },
  ];

  return (
    <div className="mb-6">
      <div className="border-b border-gray-200">
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
                    ? tab.activeColor
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {tab.label}
                <span
                  className={`ml-2 ${
                    isActive
                      ? tab.badgeActiveColor
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
    </div>
  );
}
