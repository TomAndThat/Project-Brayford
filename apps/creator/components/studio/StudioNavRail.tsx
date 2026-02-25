"use client";

import { useRouter } from "next/navigation";
import type { EventStatus } from "@brayford/core";

export type StudioView =
  | "event-control"
  | "scenes"
  | "messages"
  | "polls"
  | "settings"
  | "sandbox-join";

interface StudioNavRailProps {
  currentView: StudioView;
  onViewChange: (view: StudioView) => void;
  eventStatus: EventStatus;
  /** When true, shows the sandbox join link nav item */
  isSandbox?: boolean;
}

interface NavItem {
  id: StudioView;
  icon: JSX.Element;
  label: string;
}

export default function StudioNavRail({
  currentView,
  onViewChange,
  eventStatus,
  isSandbox = false,
}: StudioNavRailProps) {
  const router = useRouter();

  const statusPipConfig: Record<
    EventStatus,
    { color: string; pulse: boolean; title: string }
  > = {
    draft: { color: "bg-gray-400", pulse: false, title: "Draft" },
    active: { color: "bg-green-500", pulse: false, title: "Ready" },
    live: { color: "bg-red-500", pulse: true, title: "Live" },
    ended: { color: "bg-gray-500", pulse: false, title: "Ended" },
  };

  const pip = statusPipConfig[eventStatus];

  const navItems: NavItem[] = [
    {
      id: "event-control",
      label: "Control",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01"
          />
        </svg>
      ),
    },
    {
      id: "scenes",
      label: "Scenes",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
      ),
    },
    {
      id: "messages",
      label: "Messages",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
    },
    {
      id: "polls",
      label: "Polls",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  // Conditionally append the sandbox join nav item for sandbox events
  const allNavItems: NavItem[] = isSandbox
    ? [
        ...navItems,
        {
          id: "sandbox-join" as StudioView,
          label: "Join Link",
          icon: (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0zm-6 0a.5.5 0 11-1 0 .5.5 0 011 0zm-6 0a.5.5 0 11-1 0 .5.5 0 011 0z"
              />
            </svg>
          ),
        },
      ]
    : navItems;

  return (
    <div className="w-20 bg-gray-950 border-r border-gray-800 flex flex-col items-center py-6 gap-2">
      {/* Dashboard */}
      <button
        onClick={() => router.push("/dashboard")}
        className="w-14 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors text-gray-400 hover:text-white hover:bg-gray-800"
        title="Dashboard"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        <span className="text-xs font-medium">Dashboard</span>
      </button>

      {/* Separator */}
      <div className="w-12 h-px bg-gray-800 my-2" />

      {/* View Navigation */}
      {allNavItems.map((item) => {
        const isActive = currentView === item.id;
        const showPip = item.id === "event-control";
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`
              relative w-14 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors
              ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }
            `}
            title={showPip ? `${item.label} — ${pip.title}` : item.label}
          >
            {showPip && (
              <span
                className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-gray-950 ${pip.color} ${pip.pulse ? "animate-pulse" : ""}`}
              />
            )}
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
