import { collides } from "../layout/engine";
import { cloneDocument, validateDocument } from "./schema";
import { detectTileSize } from "./tiles";
import { ancestorsOf, descendantsOf, indexNodes } from "./tree";
import type { Dashboard, DashboardDocument, DashboardNode, GroupNode, NodePlacement, WidgetConfig } from "./types";

export interface Command {
  readonly label: string;
  execute(document: DashboardDocument): DashboardDocument;
  undo(): DashboardDocument;
}
export class EditCommand implements Command {
  private before?: DashboardDocument;
  constructor(
    public readonly label: string,
    private readonly edit: (document: DashboardDocument) => void,
  ) {}
  execute(document: DashboardDocument): DashboardDocument {
    const next = cloneDocument(document);
    this.edit(next);
    validateDocument(next);
    this.before = cloneDocument(document);
    return next;
  }
  undo(): DashboardDocument {
    if (!this.before) throw new Error("Command has not executed");
    return cloneDocument(this.before);
  }
}
function dashboard(doc: DashboardDocument, id: string): Dashboard {
  const result = doc.dashboards.find((d) => d.id === id);
  if (!result) throw new Error("Dashboard not found");
  return result;
}
function nodeIn(d: Dashboard, id: string, allowLocked = false): DashboardNode {
  const node = d.nodes.find((n) => n.id === id);
  if (!node) throw new Error("Node not found");
  if (!allowLocked && (node.locked || ancestorsOf(indexNodes(d.nodes), id).some((n) => n.locked))) throw new Error("Node is locked");
  return node;
}
/** Push collisions down, retaining locked positions; the whole result is one transaction. */
function settle(d: Dashboard, preferred: ReadonlySet<string>): void {
  // Settle from deepest grid upwards so moving a child grows its enclosing
  // group before the parent grid resolves collisions.
  const tree = indexNodes(d.nodes);
  const parents = [...new Set(d.nodes.map((n) => n.parentId))].sort((a, b) => (b === null ? 0 : ancestorsOf(tree, b).length + 1) - (a === null ? 0 : ancestorsOf(tree, a).length + 1));
  for (const parent of parents) {
    const siblings = d.nodes.filter((n) => n.parentId === parent);
    const placed = siblings.filter((n) => n.locked || ancestorsOf(tree, n.id).some((ancestor) => ancestor.locked));
    for (let i = 0; i < placed.length; i++) for (let j = 0; j < i; j++) if (collides(placed[i].tile, placed[j].tile)) throw new Error("Locked tiles overlap");
    const moving = siblings.filter((n) => !placed.includes(n)).sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)) || a.tile.y - b.tile.y || a.tile.x - b.tile.x);
    for (const n of moving) {
      while (placed.some((p) => collides(p.tile, n.tile))) {
        if (n.tile.y >= 10000) throw new Error("Dashboard layout exceeds the row limit");
        n.tile.y++;
      }
      placed.push(n);
    }
    // Explicit mobile ordering is independent of desktop x/y and survives a
    // drag; only reorder commands change order.
    if (parent !== null) {
      const group = tree.byId.get(parent);
      if (group?.kind === "group") group.tile.h = Math.max(3, ...siblings.map((n) => n.tile.y + n.tile.h + 1));
    }
  }
}
export class MoveNodeCommand extends EditCommand {
  constructor(dashboardId: string, placements: NodePlacement[]) {
    super("Move tiles", (doc) => {
      const d = dashboard(doc, dashboardId);
      for (const p of placements) {
        const n = nodeIn(d, p.id);
        n.parentId = p.parentId;
        n.tile = { ...n.tile, x: p.x, y: p.y, w: p.w, h: p.h, size: detectTileSize(p.w, p.h) };
      }
      // Validate parent graph before any recursive layout work.
      validateDocument(doc);
      settle(d, new Set(placements.map((p) => p.id)));
    });
  }
}
export class ResizeNodeCommand extends EditCommand {
  constructor(dashboardId: string, id: string, w: number, h: number) {
    super("Resize tile", (doc) => {
      const d = dashboard(doc, dashboardId),
        n = nodeIn(d, id);
      n.tile = { ...n.tile, w, h, size: detectTileSize(w, h) };
      settle(d, new Set([id]));
    });
  }
}
export class AddNodeCommand extends EditCommand {
  constructor(dashboardId: string, node: DashboardNode) {
    super("Add tile", (doc) => {
      const d = dashboard(doc, dashboardId);
      d.nodes.push(JSON.parse(JSON.stringify(node)));
      settle(d, new Set());
    });
  }
}
export class RemoveNodeCommand extends EditCommand {
  constructor(dashboardId: string, id: string) {
    super("Remove tile and contents", (doc) => {
      const d = dashboard(doc, dashboardId);
      nodeIn(d, id);
      const removed = new Set([id, ...descendantsOf(indexNodes(d.nodes), id).map((n) => n.id)]);
      for (const nodeId of removed) nodeIn(d, nodeId);
      d.nodes = d.nodes.filter((n) => !removed.has(n.id));
    });
  }
}
export class UpdateConfigCommand extends EditCommand {
  constructor(dashboardId: string, id: string, config: WidgetConfig, title?: string) {
    super("Configure widget", (doc) => {
      const n = nodeIn(dashboard(doc, dashboardId), id);
      if (n.kind !== "widget") throw new Error("Not a widget");
      n.config = JSON.parse(JSON.stringify(config));
      if (title !== undefined) n.title = title;
    });
  }
}
export class CreateGroupCommand extends AddNodeCommand {
  constructor(dashboardId: string, group: GroupNode) {
    super(dashboardId, group);
  }
}
export class DissolveGroupCommand extends EditCommand {
  constructor(dashboardId: string, id: string) {
    super("Dissolve group", (doc) => {
      const d = dashboard(doc, dashboardId),
        group = nodeIn(d, id);
      if (group.kind !== "group") throw new Error("Not a group");
      const children = d.nodes.filter((n) => n.parentId === id);
      const target = group.parentId === null ? 12 : nodeIn(d, group.parentId, true).tile.w;
      if (children.some((child) => child.tile.w > target)) throw new Error("A child tile is wider than the destination group");
      for (const child of children) {
        nodeIn(d, child.id);
        child.parentId = group.parentId;
        const parent = group.parentId === null ? undefined : nodeIn(d, group.parentId, true);
        child.tile.x = Math.max(0, Math.min(child.tile.x + group.tile.x, (parent?.tile.w ?? 12) - child.tile.w));
        child.tile.y += group.tile.y;
      }
      d.nodes = d.nodes.filter((n) => n.id !== id);
      settle(d, new Set());
    });
  }
}
export class ToggleLockCommand extends EditCommand {
  constructor(dashboardId: string, id: string) {
    super("Toggle lock", (doc) => {
      const n = nodeIn(dashboard(doc, dashboardId), id, true);
      n.locked = !n.locked;
    });
  }
}
export class ToggleHideCommand extends EditCommand {
  constructor(dashboardId: string, id: string) {
    super("Toggle visibility", (doc) => {
      const n = nodeIn(dashboard(doc, dashboardId), id);
      n.hidden = !n.hidden;
    });
  }
}
export class ToggleCollapseCommand extends EditCommand {
  constructor(dashboardId: string, id: string) {
    super("Toggle collapse", (doc) => {
      const n = nodeIn(dashboard(doc, dashboardId), id);
      if (n.kind === "group") n.collapsed = !n.collapsed;
    });
  }
}
export class BatchCommand extends EditCommand {
  constructor(commands: Command[], label = "Batch edit") {
    super(label, (doc) => {
      let next = doc;
      for (const command of commands) next = command.execute(next);
      Object.assign(doc, next);
    });
  }
}
