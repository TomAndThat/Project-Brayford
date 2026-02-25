"use client";

import type { ColorPickerTarget } from "@/hooks/use-color-picker";
import ColorPickerField from "@/components/brands/ColorPickerField";

export interface InteractiveElementsSectionProps {
  inputBackgroundColor: string;
  onInputBackgroundColorChange: (v: string) => void;
  inputTextColor: string;
  onInputTextColorChange: (v: string) => void;
  buttonBackgroundColor: string;
  onButtonBackgroundColorChange: (v: string) => void;
  buttonTextColor: string;
  onButtonTextColorChange: (v: string) => void;
  onOpenPicker: (target: ColorPickerTarget) => void;
  disabled: boolean;
}

/**
 * 2×2 grid of colour controls for interactive elements
 * (input background, input text, button background, button text).
 */
export default function InteractiveElementsSection({
  inputBackgroundColor,
  onInputBackgroundColorChange,
  inputTextColor,
  onInputTextColorChange,
  buttonBackgroundColor,
  onButtonBackgroundColorChange,
  buttonTextColor,
  onButtonTextColorChange,
  onOpenPicker,
  disabled,
}: InteractiveElementsSectionProps): React.ReactElement {
  return (
    <div className="pt-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        Interactive Elements
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Colours for buttons and text fields shown to the audience
        (e.g.&nbsp;messaging, polls).
      </p>

      <div className="grid grid-cols-2 gap-4">
        <ColorPickerField
          target="inputBackground"
          label="Input Background"
          value={inputBackgroundColor}
          onChange={onInputBackgroundColorChange}
          onOpenPicker={onOpenPicker}
          disabled={disabled}
          size="compact"
        />
        <ColorPickerField
          target="inputText"
          label="Input Text"
          value={inputTextColor}
          onChange={onInputTextColorChange}
          onOpenPicker={onOpenPicker}
          disabled={disabled}
          size="compact"
        />
        <ColorPickerField
          target="buttonBackground"
          label="Button Background"
          value={buttonBackgroundColor}
          onChange={onButtonBackgroundColorChange}
          onOpenPicker={onOpenPicker}
          disabled={disabled}
          size="compact"
        />
        <ColorPickerField
          target="buttonText"
          label="Button Text"
          value={buttonTextColor}
          onChange={onButtonTextColorChange}
          onOpenPicker={onOpenPicker}
          disabled={disabled}
          size="compact"
        />
      </div>
    </div>
  );
}
