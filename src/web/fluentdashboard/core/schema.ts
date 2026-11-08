import { isValidId } from "./ids";
import { BASE_COLUMNS, type DashboardDocument, MAX_DASHBOARDS, MAX_GROUP_DEPTH, MAX_NODES_PER_DASHBOARD, MAX_TILE_ROWS, SCHEMA_VERSION } from "./types";

export const MAX_DOCUMENT_BYTES = 256 * 1024;
export class DocumentValidationError extends Error {}
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
function requireValue(ok: unknown, path: string): asserts ok {
  if (!ok) throw new DocumentValidationError(`Invalid dashboard document: ${path}`);
}
function jsonValue(value: unknown, depth = 0, seen = new Set<object>()): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  seen.add(value);
  const valid = Object.entries(value).every(([key, v]) => !["__proto__", "constructor", "prototype"].includes(key) && jsonValue(v, depth + 1, seen));
  seen.delete(value);
  return valid;
}

/** Strict rejection, never silent repair of saved data. Unknown widget types survive. */
export function validateDocument(value: unknown): asserts value is DashboardDocument {
  requireValue(object(value) && jsonValue(value), "JSON value");
  requireValue(new TextEncoder().encode(JSON.stringify(value)).length <= MAX_DOCUMENT_BYTES, "size limit");
  requireValue(value.schemaVersion === SCHEMA_VERSION, "schemaVersion");
  requireValue(integer(value.revision, 0, Number.MAX_SAFE_INTEGER - 1), "revision");
  requireValue(Array.isArray(value.dashboards) && value.dashboards.length > 0 && value.dashboards.length <= MAX_DASHBOARDS, "dashboards");
  const ids = new Set<string>();
  for (const dashboard of value.dashboards) {
    requireValue(object(dashboard) && isValidId(dashboard.id) && !ids.has(dashboard.id), "dashboard id");
    ids.add(dashboard.id);
    requireValue(typeof dashboard.name === "string" && dashboard.name.trim().length > 0 && dashboard.name.length <= 128, "dashboard name");
    requireValue(Array.isArray(dashboard.nodes) && dashboard.nodes.length <= MAX_NODES_PER_DASHBOARD, "nodes");
    const nodes = new Map<string, Record<string, unknown>>();
    for (const node of dashboard.nodes) {
      requireValue(object(node) && isValidId(node.id) && !nodes.has(node.id), "node id");
      nodes.set(node.id, node);
      requireValue(node.kind === "widget" || node.kind === "group", "node kind");
      requireValue(Object.hasOwn(node, "parentId") && (node.parentId === null || isValidId(node.parentId)), "parentId");
      for (const key of ["hidden", "locked", "collapsed"]) requireValue(node[key] === undefined || typeof node[key] === "boolean", key);
      requireValue(node.title === undefined || (typeof node.title === "string" && node.title.length <= 256), "title");
      const tile = node.tile;
      requireValue(object(tile), "tile");
      requireValue(["small", "medium", "wide", "large", "xlarge", "full", "custom"].includes(String(tile.size)), "tile size");
      requireValue(
        integer(tile.x, 0, BASE_COLUMNS - 1) && integer(tile.y, 0, 10000) && integer(tile.w, 1, BASE_COLUMNS) && integer(tile.h, 1, MAX_TILE_ROWS) && integer(tile.order, 0, 100000),
        "tile coordinates",
      );
      if (node.kind === "widget") {
        requireValue(typeof node.widgetType === "string" && /^[a-zA-Z0-9_.-]{1,128}$/.test(node.widgetType), "widgetType");
        requireValue(integer(node.widgetVersion, 1, 100000) && object(node.config), "widget config/version");
      } else {
        requireValue(typeof node.title === "string", "group title");
        requireValue(node.description === undefined || (typeof node.description === "string" && node.description.length <= 2048), "group description");
      }
    }
    for (const node of nodes.values()) {
      const seen = new Set([node.id]);
      let parentId = node.parentId;
      let depth = node.kind === "group" ? 1 : 0;
      while (parentId !== null) {
        requireValue(typeof parentId === "string" && !seen.has(parentId), "parent cycle");
        seen.add(parentId);
        const parent = nodes.get(parentId);
        requireValue(parent?.kind === "group", "missing/non-group parent");
        requireValue(++depth <= MAX_GROUP_DEPTH, "group depth");
        parentId = parent.parentId;
      }
      const tile = node.tile as Record<string, number>;
      const parent = node.parentId === null ? undefined : nodes.get(String(node.parentId));
      const width = parent ? (parent.tile as Record<string, number>).w : BASE_COLUMNS;
      requireValue(tile.x + tile.w <= width, "parent width");
    }
  }
  requireValue(typeof value.defaultDashboardId === "string" && ids.has(value.defaultDashboardId), "default dashboard");
  requireValue(value.meta === undefined || object(value.meta), "meta");
}

export function cloneDocument(document: DashboardDocument): DashboardDocument {
  return JSON.parse(JSON.stringify(document)) as DashboardDocument;
}

/** Add sequential migrations here when a second schema exists; never downgrade. */
export function migrateDocument(value: unknown): DashboardDocument {
  validateDocument(value);
  return cloneDocument(value);
}

export function createDefaultDocument(): DashboardDocument {
  const types = ["system.info", "system.resources", "network.internet", "network.interfaces", "wireless.radios", "dhcp.leases", "wireless.clients"];
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    defaultDashboardId: "overview",
    meta: { presetVersion: 1 },
    dashboards: [
      {
        id: "overview",
        name: "Overview",
        nodes: types.map((widgetType, i) => ({
          id: widgetType.replaceAll(".", "_"),
          kind: "widget",
          parentId: null,
          widgetType,
          widgetVersion: 1,
          config: {},
          tile: { size: "xlarge", x: (i % 2) * 6, y: Math.floor(i / 2) * 8, w: 6, h: 8, order: i },
        })),
      },
    ],
  };
}
