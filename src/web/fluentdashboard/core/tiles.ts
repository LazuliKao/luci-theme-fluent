import { BASE_COLUMNS, MAX_TILE_ROWS, type Tile, type TileSize } from "./types";

export interface TileDimensions {
  w: number;
  h: number;
}

export interface TileConstraints {
  min: TileDimensions;
  max: TileDimensions;
}

/**
 * Standard tile presets on the 12-column base grid. One tile unit = 1 column x 2 rows.
 * `full` spans every column of whatever grid it is rendered in.
 */
export const TILE_PRESETS: Record<Exclude<TileSize, "custom">, TileDimensions> = {
  small: { w: 1, h: 2 },
  medium: { w: 2, h: 4 },
  wide: { w: 4, h: 4 },
  large: { w: 4, h: 8 },
  xlarge: { w: 6, h: 8 },
  full: { w: BASE_COLUMNS, h: 8 },
};

export const TILE_SIZE_ORDER: Array<Exclude<TileSize, "custom">> = ["small", "medium", "wide", "large", "xlarge", "full"];

export const DEFAULT_CONSTRAINTS: TileConstraints = {
  min: { w: 1, h: 2 },
  max: { w: BASE_COLUMNS, h: MAX_TILE_ROWS },
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

/** Detects the preset that matches the given dimensions or `custom`. */
export function detectTileSize(w: number, h: number, columns = BASE_COLUMNS): TileSize {
  for (const size of TILE_SIZE_ORDER) {
    const preset = TILE_PRESETS[size];
    if (size === "full" ? w === columns && h === preset.h : preset.w === w && preset.h === h) return size;
  }
  return "custom";
}

/** Clamps dimensions into constraints and the available column count. */
export function clampDimensions(dimensions: TileDimensions, constraints: TileConstraints = DEFAULT_CONSTRAINTS, columns = BASE_COLUMNS): TileDimensions {
  const maxW = Math.max(1, Math.min(columns, constraints.max.w));
  const minW = Math.min(maxW, Math.max(1, constraints.min.w));
  const maxH = Math.max(1, Math.min(MAX_TILE_ROWS, constraints.max.h));
  const minH = Math.min(maxH, Math.max(1, constraints.min.h));
  return {
    w: clampInt(dimensions.w, minW, maxW, minW),
    h: clampInt(dimensions.h, minH, maxH, minH),
  };
}

/** Resolves a preset into concrete dimensions respecting constraints and the parent width. */
export function presetDimensions(size: Exclude<TileSize, "custom">, constraints: TileConstraints = DEFAULT_CONSTRAINTS, columns = BASE_COLUMNS): TileDimensions {
  const preset = TILE_PRESETS[size];
  return clampDimensions({ w: size === "full" ? columns : preset.w, h: preset.h }, constraints, columns);
}

/** Returns presets that are usable with the given constraints (after clamping they keep their identity). */
export function allowedPresets(constraints: TileConstraints = DEFAULT_CONSTRAINTS, columns = BASE_COLUMNS): Array<Exclude<TileSize, "custom">> {
  return TILE_SIZE_ORDER.filter((size) => {
    const preset = TILE_PRESETS[size];
    const w = size === "full" ? columns : preset.w;
    return w >= constraints.min.w && w <= Math.min(columns, constraints.max.w) && preset.h >= constraints.min.h && preset.h <= constraints.max.h;
  });
}

/** Sanitizes an untrusted tile (used by schema validation). */
export function sanitizeTile(value: unknown, columns = BASE_COLUMNS): Tile {
  const raw = value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const { w, h } = clampDimensions({ w: raw.w as number, h: raw.h as number }, DEFAULT_CONSTRAINTS, columns);
  const x = clampInt(raw.x, 0, Math.max(0, columns - w), 0);
  const y = clampInt(raw.y, 0, 10_000, 0);
  const order = clampInt(raw.order, 0, 100_000, 0);
  // The size label is derived from the dimensions so it can never disagree with them.
  return { size: detectTileSize(w, h, columns), x, y, w, h, order };
}

/** Returns a copy of the tile with new dimensions and a re-derived size label. */
export function withDimensions(tile: Tile, w: number, h: number, columns = BASE_COLUMNS): Tile {
  return { ...tile, w, h, size: detectTileSize(w, h, columns) };
}
