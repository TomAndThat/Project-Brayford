"use client";

import { useState, useRef, useEffect } from "react";
import { fromBranded, type OrganizationId } from "@brayford/core";

/**
 * Organisation info for the switcher
 * Lightweight shape — avoid requiring full OrganizationDocument
 */
export interface OrgSwitcherItem {
  id: OrganizationId;
  name: string;
  role: string;
}

interface OrgSwitcherProps {
  organizations: OrgSwitcherItem[];
  currentOrgId: OrganizationId;
  onOrgChange: (orgId: OrganizationId) => void;
}

/**
 * Organisation switcher dropdown — allows users with multi-org
 * memberships to switch between organisations.
 *
 * Only renders the dropdown trigger when there are 2+ orgs.
 * Single-org users see just the org name (no switcher UI).
 */
export default function OrgSwitcher({
  organizations,
  currentOrgId,
  onOrgChange,
}: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOrg = organizations.find(
    (o) => fromBranded(o.id) === fromBranded(currentOrgId),
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Single org — no switcher needed
  if (organizations.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors rounded px-1.5 py-0.5 -ml-1.5 hover:bg-gray-100"
        aria-label="Switch organisation"
        data-testid="org-switcher-trigger"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
          />
        </svg>
        <span>
          {organizations.length} organisation
          {organizations.length !== 1 ? "s" : ""}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Your Organisations
            </p>
          </div>
          {organizations.map((org) => {
            const isActive = fromBranded(org.id) === fromBranded(currentOrgId);

            return (
              <button
                key={fromBranded(org.id)}
                onClick={() => {
                  if (!isActive) {
                    onOrgChange(org.id);
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                data-testid={`org-switcher-item-${fromBranded(org.id)}`}
              >
                {/* Org initial badge */}
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{org.name}</div>
                  <div className="text-xs text-gray-400 capitalize">
                    {org.role}
                  </div>
                </div>
                {isActive && (
                  <svg
                    className="w-4 h-4 text-blue-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
