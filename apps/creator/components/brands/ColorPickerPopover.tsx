"use client";

import { HexColorPicker } from "react-colorful";

export interface ColorPickerPopoverProps {
  /** Human-readable label for the colour being edited. */
  label: string;
  /** Current hex colour value. */
  value: string;
  /** Called when the colour changes. */
  onChange: (value: string) => void;
  /** Called when the popover should close. */
  onClose: () => void;
}

/**
 * Fixed-position colour picker popover with a backdrop.
 *
 * Renders the `react-colorful` HexColorPicker inside a card,
 * plus a backdrop overlay that closes the popover on click.
 */
export default function ColorPickerPopover({
  label,
  value,
  onChange,
  onClose,
}: ColorPickerPopoverProps): React.ReactElement {
  return (
    <>
      {/* Backdrop — closes on click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div className="fixed left-1/4 top-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-2xl p-4 border border-gray-200 max-w-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">{label}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex justify-center mb-3">
          <HexColorPicker
            color={value}
            onChange={onChange}
            style={{ width: "220px", height: "160px" }}
          />
        </div>

        <div className="text-center">
          <p className="text-xs font-medium text-gray-700 mb-1">
            Selected Colour
          </p>
          <p className="text-sm font-mono text-gray-900">{value}</p>
        </div>
      </div>
    </>
  );
}
