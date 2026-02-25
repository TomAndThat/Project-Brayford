"use client";

import type { ColorPickerTarget } from "@/hooks/use-color-picker";

export interface ColorPickerFieldProps {
  /** Which colour target this field controls. */
  target: ColorPickerTarget;
  /** Human-readable label shown above the swatch. */
  label: string;
  /** Optional helper text below the label. */
  helperText?: string;
  /** Current hex colour value (e.g. "#0A0A0A"). */
  value: string;
  /** Update the hex colour value. */
  onChange: (value: string) => void;
  /** Open the colour picker popover for this target. */
  onOpenPicker: (target: ColorPickerTarget) => void;
  /** Whether interactions are disabled. */
  disabled?: boolean;
  /** Visual size — "default" shows a larger swatch with label;
   *  "compact" shows a small swatch for grid layouts. */
  size?: "default" | "compact";
  /** Hex input placeholder. */
  placeholder?: string;
}

/**
 * Reusable colour field: a clickable swatch preview + hex input.
 *
 * Used for background, text, header-background, and interactive-element
 * colours on the brand settings page. Replaces the ~40-line pattern that
 * was previously duplicated 7 times.
 */
export default function ColorPickerField({
  target,
  label,
  helperText,
  value,
  onChange,
  onOpenPicker,
  disabled = false,
  size = "default",
  placeholder = "#000000",
}: ColorPickerFieldProps): React.ReactElement {
  if (size === "compact") {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPicker(target)}
            className="flex-shrink-0 w-7 h-7 rounded border-2 border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            style={{ backgroundColor: value }}
            disabled={disabled}
            title="Click to open colour picker"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              onChange(v);
            }}
            className="block w-full border-gray-300 rounded text-xs px-2 py-1.5 font-mono"
            maxLength={7}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {helperText && (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
          <p className="text-xs text-gray-500 mb-3">{helperText}</p>
        </>
      )}

      <div className="flex gap-3 items-start">
        {/* Clickable swatch */}
        <button
          type="button"
          onClick={() => onOpenPicker(target)}
          className="flex-shrink-0 w-16 h-16 rounded-md border-2 border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group relative"
          style={{ backgroundColor: value }}
          disabled={disabled}
          title="Click to open colour picker"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </div>
        </button>

        {/* Hex input */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hex Colour Code
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                onChange(v.toUpperCase());
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim().toUpperCase();
              if (!v.match(/^#[0-9A-Fa-f]{6}$/)) {
                // Revert — keep current value (no-op, React state unchanged)
                onChange(value);
              }
            }}
            maxLength={7}
            placeholder={placeholder}
            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 uppercase"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
