/**
 * Declarative dashboard document model.
 *
 * The document is the single source of truth for the workbench: the layout
 * engine renders it, the editor mutates it through commands, and persistence
 * stores it. It must never contain DOM nodes, library objects or live samples.
 */

/** Current persisted schema version. Bump together with a migration step. */
export const SCHEMA_VERSION = 1;

/** Every layout is authored once on this base grid and folded for narrower screens. */
export const BASE_COLUMNS = 12;

/** Maximum nesting depth of groups (a group inside a group = depth 2). */
export const MAX_GROUP_DEPTH = 2;

/** Hard upper bound of nodes per dashboard (protects low-end routers and the UCI store). */
export const MAX_NODES_PER_DASHBOARD = 120;

/** Upper bound of dashboards per document. */
export const MAX_DASHBOARDS = 16;

/** Maximum row span of a single tile. */
export const MAX_TILE_ROWS = 48;

/** Rows occupied by a group header. */
export const GROUP_HEADER_ROWS = 1;

/** Minimum inner rows reserved for an (empty) expanded group so items can be dropped into it. */
export const GROUP_MIN_BODY_ROWS = 2;

/**
 * Normalized tile sizes ("Windows tiles"). One tile unit is 1 column x 2 rows.
 * `custom` marks a tile resized freely by the user.
 */
export type TileSize = "small" | "medium" | "wide" | "large" | "xlarge" | "full" | "custom";

export interface Tile {
  size: TileSize;
  /** Column on the 12-column base grid (relative to the parent group's inner grid for children). */
  x: number;
  /** Row (relative to the parent's inner grid for children). */
  y: number;
  /** Width in columns. */
  w: number;
  /** Height in rows. */
  h: number;
  /** Flow order used when the layout is folded to fewer columns (6 / 2). */
  order: number;
}

interface NodeBase {
  id: string;
  /** Parent group id or `null` for root nodes. */
  parentId: string | null;
  tile: Tile;
  /** Optional user title override. */
  title?: string;
  /** Hidden nodes keep their configuration but are not rendered while browsing. */
  hidden?: boolean;
  /** Locked nodes cannot be moved, resized or removed until unlocked. */
  locked?: boolean;
}

export type WidgetConfig = Record<string, unknown>;

export interface WidgetNode extends NodeBase {
  kind: "widget";
  widgetType: string;
  widgetVersion: number;
  config: WidgetConfig;
}

export interface GroupNode extends NodeBase {
  kind: "group";
  title: string;
  description?: string;
  /** Default collapse state (browsing can toggle temporarily without persisting). */
  collapsed?: boolean;
}

export type DashboardNode = WidgetNode | GroupNode;

export interface Dashboard {
  id: string;
  name: string;
  nodes: DashboardNode[];
}

export interface DocumentMeta {
  /** Version of the built-in preset this document was derived from (informational only). */
  presetVersion?: number;
  /** ISO timestamp of the last publish (set by the client before saving). */
  updatedAt?: string;
}

export interface DashboardDocument {
  schemaVersion: number;
  /** Server-side revision this document corresponds to (0 = never saved). */
  revision: number;
  defaultDashboardId: string;
  dashboards: Dashboard[];
  meta?: DocumentMeta;
}

/** Position update emitted by a layout adapter or produced by layout helpers. */
export interface NodePlacement {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function isGroup(node: DashboardNode | undefined | null): node is GroupNode {
  return node?.kind === "group";
}

export function isWidget(node: DashboardNode | undefined | null): node is WidgetNode {
  return node?.kind === "widget";
}
