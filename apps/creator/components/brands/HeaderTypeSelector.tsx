"use client";

import type { HeaderType } from "@brayford/core";

export interface HeaderTypeSelectorProps {
  /** Currently selected header type */
  value: HeaderType;
  /** Called when user selects a different type */
  onChange: (type: HeaderType) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

interface HeaderOption {
  type: HeaderType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const HEADER_OPTIONS: HeaderOption[] = [
  {
    type: "none",
    title: "No Header",
    description: "Jump straight into content with no header image.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
    ),
  },
  {
    type: "profile",
    title: "Profile Image",
    description:
      "Square profile picture with border, centred against a background.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    type: "logo",
    title: "Logo",
    description:
      "Any-shape logo centred against a background. No border or rounding.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    type: "banner",
    title: "Full-Width Banner",
    description: "Edge-to-edge banner image spanning the full width.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 13a1 1 0 011-1h14a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
        />
      </svg>
    ),
  },
];

/**
 * Visual selector for choosing a brand header type.
 * Shows four cards: None, Profile, Logo, Banner.
 */
export default function HeaderTypeSelector({
  value,
  onChange,
  disabled = false,
}: HeaderTypeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Header Style
      </label>
      <p className="text-xs text-gray-500 mb-4">
        Choose how your brand header appears at the top of the audience view.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {HEADER_OPTIONS.map((option) => {
          const isSelected = value === option.type;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => !disabled && onChange(option.type)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center text-center p-4 rounded-lg border-2 transition-all
                ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }
              `}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              <div
                className={`mb-2 ${isSelected ? "text-blue-600" : "text-gray-400"}`}
              >
                {option.icon}
              </div>
              <span
                className={`text-sm font-medium ${isSelected ? "text-blue-900" : "text-gray-900"}`}
              >
                {option.title}
              </span>
              <span className="text-xs text-gray-500 mt-1 leading-tight">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
