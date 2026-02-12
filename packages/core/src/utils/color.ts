/**
 * Color utility functions for brand styling
 * Handles brightness calculation, contrast validation, and color conversions
 */

/**
 * Convert hex color to RGB values
 * @param hex - Hex color string (e.g., "#0A0A0A")
 * @returns Object with r, g, b values (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  };
}

/**
 * Calculate relative luminance of a color (per WCAG 2.0)
 * @param rgb - RGB values
 * @returns Relative luminance (0-1)
 */
export function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors (per WCAG 2.0)
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(color1));
  const lum2 = getRelativeLuminance(hexToRgb(color2));
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG AA standard (4.5:1 for normal text)
 * @param backgroundColor - Background hex color
 * @param textColor - Text hex color (default: white)
 * @returns True if contrast is sufficient
 */
export function meetsContrastStandard(
  backgroundColor: string,
  textColor: string = '#FFFFFF'
): boolean {
  return getContrastRatio(backgroundColor, textColor) >= 4.5;
}

/**
 * Calculate perceived brightness of a color (0-255)
 * Uses HSP Color Model for better perception accuracy
 * @param hex - Hex color string
 * @returns Brightness value (0-255)
 */
export function getPerceivedBrightness(hex: string): number {
  const rgb = hexToRgb(hex);
  // HSP Color Model formula: sqrt(0.299*R^2 + 0.587*G^2 + 0.114*B^2)
  return Math.sqrt(
    0.299 * Math.pow(rgb.r, 2) +
    0.587 * Math.pow(rgb.g, 2) +
    0.114 * Math.pow(rgb.b, 2)
  );
}

/**
 * Check if color is too bright for theatre/auditorium use
 * Threshold: brightness > 100 (roughly 40% brightness) triggers warning
 * @param hex - Hex color string
 * @returns True if color is above brightness threshold
 */
export function isToobrightForTheatre(hex: string): boolean {
  return getPerceivedBrightness(hex) > 100;
}

/**
 * Get recommended adjustments for a color
 * @param backgroundColor - Background hex color
 * @returns Object with warnings and recommendations
 */
export interface ColorValidation {
  isValid: boolean;
  warnings: string[];
  contrast: {
    ratio: number;
    meetsStandard: boolean;
  };
  brightness: {
    value: number;
    toobrightForTheatre: boolean;
  };
}

export function validateBackgroundColor(
  backgroundColor: string,
  textColor: string = '#FFFFFF'
): ColorValidation {
  const warnings: string[] = [];
  const contrastRatio = getContrastRatio(backgroundColor, textColor);
  const meetsStandard = contrastRatio >= 4.5;
  const brightness = getPerceivedBrightness(backgroundColor);
  const tooBright = isToobrightForTheatre(backgroundColor);

  if (!meetsStandard) {
    warnings.push(
      `Low contrast (${contrastRatio.toFixed(2)}:1). White text may be hard to read. WCAG AA requires 4.5:1.`
    );
  }

  if (tooBright) {
    warnings.push(
      'This colour is quite bright. For theatre/auditorium use, consider a darker colour to minimise light pollution.'
    );
  }

  return {
    isValid: meetsStandard,
    warnings,
    contrast: {
      ratio: contrastRatio,
      meetsStandard,
    },
    brightness: {
      value: brightness,
      toobrightForTheatre: tooBright,
    },
  };
}

/**
 * Default background color for audience app (dark, theatre-friendly)
 */
export const DEFAULT_AUDIENCE_BACKGROUND = '#0A0A0A';
