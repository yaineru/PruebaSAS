/**
 * Single source of truth for report template colors. Used by the template
 * builder/list UI (name + swatch) and by the PDF generators (resolveColorScheme
 * in lib/reports/generators.ts) so both always agree on what a given
 * color_scheme value looks like. color_scheme itself is a free-form string
 * column (see reportTemplateSchema in lib/reports/report-schema.ts), so a
 * value that isn't in this list is treated as a custom hex color.
 */
export type TemplateColor = {
  value: string;
  label: string;
  hex: string;
};

export const TEMPLATE_COLOR_PALETTE: TemplateColor[] = [
  { value: "blue", label: "Azul corporativo", hex: "#1D4ED8" },
  { value: "green", label: "Verde", hex: "#16A34A" },
  { value: "orange", label: "Naranja", hex: "#EA580C" },
  { value: "red", label: "Rojo", hex: "#DC2626" },
  { value: "purple", label: "Morado", hex: "#7C3AED" },
  { value: "gray", label: "Gris", hex: "#475569" },
  { value: "black", label: "Negro", hex: "#111827" },
  { value: "sky", label: "Celeste", hex: "#0EA5E9" },
  { value: "teal", label: "Turquesa", hex: "#0D9488" },
  { value: "navy", label: "Azul oscuro", hex: "#1E3A8A" },
  { value: "gold", label: "Dorado", hex: "#B45309" },
];

const PALETTE_BY_VALUE: Record<string, TemplateColor> = Object.fromEntries(
  TEMPLATE_COLOR_PALETTE.map((color) => [color.value, color])
);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Resolves a color_scheme value (named palette entry or raw hex) to a hex string. */
export function resolveTemplateColorHex(colorScheme: string | null | undefined): string {
  if (!colorScheme) return TEMPLATE_COLOR_PALETTE[0].hex;
  const named = PALETTE_BY_VALUE[colorScheme];
  if (named) return named.hex;
  if (HEX_RE.test(colorScheme)) return colorScheme;
  return TEMPLATE_COLOR_PALETTE[0].hex;
}

/** Returns a display label for a color_scheme value (named or custom hex). */
export function getTemplateColorLabel(colorScheme: string | null | undefined): string {
  if (!colorScheme) return TEMPLATE_COLOR_PALETTE[0].label;
  const named = PALETTE_BY_VALUE[colorScheme];
  if (named) return named.label;
  if (HEX_RE.test(colorScheme)) return colorScheme.toUpperCase();
  return colorScheme;
}

export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex);
  if (!match) return [15, 118, 110];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

/** Darkens a hex color by a 0-1 factor, for header/accent contrast pairs. */
export function darkenHex(hex: string, factor: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return [clamp(r * (1 - factor)), clamp(g * (1 - factor)), clamp(b * (1 - factor))];
}
