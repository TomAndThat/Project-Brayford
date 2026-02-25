"use client";

import { useState, useCallback, useMemo } from "react";

/**
 * Identifier for every colour that can be edited via the colour picker.
 */
export type ColorPickerTarget =
  | "background"
  | "text"
  | "headerBackground"
  | "inputBackground"
  | "inputText"
  | "buttonBackground"
  | "buttonText";

/** Human-readable labels for each colour target (UK English). */
const LABELS: Record<ColorPickerTarget, string> = {
  background: "Background Colour",
  text: "Text Colour",
  headerBackground: "Header Background Colour",
  inputBackground: "Input Background Colour",
  inputText: "Input Text Colour",
  buttonBackground: "Button Background Colour",
  buttonText: "Button Text Colour",
};

export interface ColorEntry {
  value: string;
  setValue: (v: string) => void;
}

export interface UseColorPickerReturn {
  /** Which colour picker is currently open, or `null` if none. */
  activeTarget: ColorPickerTarget | null;
  /** Open the popover for a specific colour target. */
  open: (target: ColorPickerTarget) => void;
  /** Close the popover. */
  close: () => void;
  /** Get the human-readable label for a colour target. */
  label: (target: ColorPickerTarget) => string;
  /**
   * Convenience: returns the current value and setter for the active target,
   * or `null` if nothing is active.
   */
  active: { value: string; onChange: (v: string) => void; label: string } | null;
}

/**
 * Manages which colour-picker popover is open and maps each target id
 * to the correct state getter/setter. This eliminates the deeply nested
 * ternary chains that previously lived in the page component.
 *
 * @param colors – a record mapping each `ColorPickerTarget` to its
 *   `{ value, setValue }` pair (sourced from the styling form hook).
 */
export function useColorPicker(
  colors: Record<ColorPickerTarget, ColorEntry>,
): UseColorPickerReturn {
  const [activeTarget, setActiveTarget] = useState<ColorPickerTarget | null>(
    null,
  );

  const open = useCallback((target: ColorPickerTarget) => {
    setActiveTarget(target);
  }, []);

  const close = useCallback(() => {
    setActiveTarget(null);
  }, []);

  const labelFn = useCallback((target: ColorPickerTarget) => LABELS[target], []);

  const active = useMemo(() => {
    if (!activeTarget) return null;
    const entry = colors[activeTarget];
    return {
      value: entry.value,
      onChange: entry.setValue,
      label: LABELS[activeTarget],
    };
  }, [activeTarget, colors]);

  return { activeTarget, open, close, label: labelFn, active };
}
