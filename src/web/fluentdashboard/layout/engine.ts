/**
 * Pure layout algorithms (no DOM, no library dependencies).
 *
 * - Collision checks, vertical compaction and free-spot search on a column grid.
 * - "Configure once, flow everywhere": the authored 12-column layout is folded
 *   into fewer columns (6 / 2 / any) by clamping widths and flowing items in
 *   their `order` so the logical top-to-bottom sequence is preserved.
 * - Group heights are derived from their content (header + inner rows).
 */
import { byFlowOrder, byReadingOrder, childrenOf, indexNodes, type NodeIndex } from "../core/tree";
import { BASE_COLUMNS, type DashboardNode, GROUP_HEADER_ROWS, GROUP_MIN_BODY_ROWS, isGroup } from "../core/types";

export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResolvedItem extends Rect {
  parentId: string | null;
  kind: DashboardNode["kind"];
  collapsed: boolean;
  hidden: boolean;
}

export interface ResolvedGrid {
  parentId: string | null;
  columns: number;
  rows: number;
  /** True when the grid is rendered with its authored column count (no folding). */
  authored: boolean;
  items: ResolvedItem[];
}

export interface ResolvedLayout {
  columns: number;
  grids: Map<string | null, ResolvedGrid>;
  /** Flat lookup of every resolved item. */
  items: Map<string, ResolvedItem>;
}

export interface ResolveOptions {
  /** Groups rendered collapsed (header only). */
  collapsed?: ReadonlySet<string>;
  /** Render hidden nodes (editing) instead of skipping them (browsing). */
  includeHidden?: boolean;
}

export function collides(a: Omit<Rect, "id">, b: Omit<Rect, "id">): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function collidesAny(rect: Omit<Rect, "id">, placed: readonly Rect[]): boolean {
  for (const other of placed) if (collides(rect, other)) return true;
  return false;
}

export function layoutRows(items: readonly Omit<Rect, "id">[]): number {
  let rows = 0;
  for (const item of items) rows = Math.max(rows, item.y + item.h);
  return rows;
}

/**
 * Gravity compaction: every item moves up as far as possible while keeping its column.
 * Overlapping input is resolved by pushing later items (reading order) down.
 */
export function compactVertical<T extends Rect>(items: readonly T[], columns: number): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const placed: T[] = [];
  for (const item of sorted) {
    const w = Math.min(item.w, columns);
    const x = Math.min(Math.max(0, item.x), columns - w);
    let y = Math.max(0, item.y);
    while (y > 0 && !collidesAny({ x, y: y - 1, w, h: item.h }, placed)) y--;
    while (collidesAny({ x, y, w, h: item.h }, placed)) y++;
    placed.push({ ...item, x, y, w });
  }
  return placed;
}

/** First free position (reading order) for a `w x h` rectangle, starting at row `fromY`. */
export function findFreeSpot(placed: readonly Rect[], w: number, h: number, columns: number, fromY = 0): { x: number; y: number } {
  const width = Math.min(w, columns);
  const limit = Math.max(layoutRows(placed) + 1, fromY);
  for (let y = Math.max(0, fromY); y <= limit; y++) {
    for (let x = 0; x + width <= columns; x++) {
      if (!collidesAny({ x, y, w: width, h }, placed)) return { x, y };
    }
  }
  return { x: 0, y: limit };
}

/**
 * Sequential flow: items keep their relative order; each item is placed at the first
 * free position that is not before the previous item's position (reading order).
 */
export function flowLayout<T extends Rect>(ordered: readonly T[], columns: number): T[] {
  const placed: T[] = [];
  let cursorX = 0;
  let cursorY = 0;
  for (const item of ordered) {
    const w = Math.max(1, Math.min(item.w, columns));
    let y = cursorY;
    let x = cursorX;
    for (;;) {
      if (x + w > columns) {
        x = 0;
        y++;
        continue;
      }
      if (!collidesAny({ x, y, w, h: item.h }, placed)) break;
      x++;
    }
    placed.push({ ...item, x, y, w });
    cursorX = x + w;
    cursorY = y;
  }
  return placed;
}

/** Width of a tile when folded into `columns` columns. */
export function foldWidth(w: number, columns: number): number {
  return Math.max(1, Math.min(w, columns));
}

/** Supported column ladder (12 desktop, 6 tablet, 2 phone). */
export const COLUMN_STEPS = [12, 6, 2] as const;

interface ResolveContext {
  index: NodeIndex;
  options: ResolveOptions;
  grids: Map<string | null, ResolvedGrid>;
  items: Map<string, ResolvedItem>;
}

function resolveGrid(ctx: ResolveContext, parentId: string | null, columns: number, authoredColumns: number): ResolvedGrid {
  const authored = columns >= authoredColumns;
  const children = childrenOf(ctx.index, parentId).filter((node) => ctx.options.includeHidden || !node.hidden);
  const sized: ResolvedItem[] = children.map((node) => {
    const w = foldWidth(node.tile.w, columns);
    let h = node.tile.h;
    const collapsed = isGroup(node) && (ctx.options.collapsed?.has(node.id) ?? false);
    if (isGroup(node)) {
      if (collapsed) {
        h = GROUP_HEADER_ROWS;
        // Still resolve the hidden body so the layout map is complete when expanded later.
        resolveGrid(ctx, node.id, w, node.tile.w);
      } else {
        const inner = resolveGrid(ctx, node.id, w, node.tile.w);
        h = GROUP_HEADER_ROWS + Math.max(inner.rows, GROUP_MIN_BODY_ROWS);
      }
    }
    return { id: node.id, parentId, kind: node.kind, x: node.tile.x, y: node.tile.y, w, h, collapsed, hidden: node.hidden === true };
  });

  let placed: ResolvedItem[];
  if (authored) {
    // The authored coordinates are the saved source of truth. Responsive reflow
    // must not compact the desktop grid or a later edit would jump on screen.
    placed = sized;
  } else {
    const order = new Map(children.map((node) => [node.id, node]));
    const ordered = [...sized].sort((a, b) => byFlowOrder(order.get(a.id) as DashboardNode, order.get(b.id) as DashboardNode));
    placed = flowLayout(ordered, columns);
  }

  const grid: ResolvedGrid = { parentId, columns, rows: layoutRows(placed), authored, items: placed };
  ctx.grids.set(parentId, grid);
  for (const item of placed) ctx.items.set(item.id, item);
  return grid;
}

/**
 * Resolves the concrete positions of all nodes for a given root column count.
 * At 12 columns the authored layout is kept (compacted), narrower grids flow by `order`.
 */
export function resolveLayout(nodes: readonly DashboardNode[], columns: number, options: ResolveOptions = {}): ResolvedLayout {
  const ctx: ResolveContext = { index: indexNodes(nodes), options, grids: new Map(), items: new Map() };
  resolveGrid(ctx, null, Math.max(1, columns), BASE_COLUMNS);
  return { columns, grids: ctx.grids, items: ctx.items };
}

/**
 * Derived group height on the authored grid: header + rows used by the children
 * (at least GROUP_MIN_BODY_ROWS so empty groups remain a usable drop target).
 * Returns a map of group id -> height for every group whose stored height differs.
 */
export function deriveGroupHeights(nodes: readonly DashboardNode[]): Map<string, number> {
  const layout = resolveLayout(nodes, BASE_COLUMNS, { includeHidden: true });
  const changes = new Map<string, number>();
  for (const node of nodes) {
    if (!isGroup(node)) continue;
    const resolved = layout.items.get(node.id);
    if (resolved && resolved.h !== node.tile.h) changes.set(node.id, resolved.h);
  }
  return changes;
}

/** Recomputes flow order of the children of a parent from their reading order. */
export function readingOrderRanks(nodes: readonly DashboardNode[], parentId: string | null): Map<string, number> {
  const index = indexNodes(nodes);
  const ranks = new Map<string, number>();
  [...childrenOf(index, parentId)].sort(byReadingOrder).forEach((node, rank) => {
    ranks.set(node.id, rank);
  });
  return ranks;
}
