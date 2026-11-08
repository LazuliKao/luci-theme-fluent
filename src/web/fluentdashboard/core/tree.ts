import { BASE_COLUMNS, type Dashboard, type DashboardNode, type GroupNode, isGroup } from "./types";

/** Index of a dashboard's node list for fast tree queries. */
export interface NodeIndex {
  byId: Map<string, DashboardNode>;
  children: Map<string | null, DashboardNode[]>;
}

export function indexNodes(nodes: readonly DashboardNode[]): NodeIndex {
  const byId = new Map<string, DashboardNode>();
  const children = new Map<string | null, DashboardNode[]>();
  for (const node of nodes) byId.set(node.id, node);
  for (const node of nodes) {
    const parentId = node.parentId !== null && byId.has(node.parentId) ? node.parentId : null;
    const list = children.get(parentId);
    if (list) list.push(node);
    else children.set(parentId, [node]);
  }
  return { byId, children };
}

export function childrenOf(index: NodeIndex, parentId: string | null): DashboardNode[] {
  return index.children.get(parentId) ?? [];
}

/** Returns ancestors from the direct parent up to the root. Stops on cycles. */
export function ancestorsOf(index: NodeIndex, id: string): GroupNode[] {
  const result: GroupNode[] = [];
  const seen = new Set<string>([id]);
  let current = index.byId.get(id);
  while (current?.parentId) {
    if (seen.has(current.parentId)) break;
    seen.add(current.parentId);
    const parent = index.byId.get(current.parentId);
    if (!isGroup(parent)) break;
    result.push(parent);
    current = parent;
  }
  return result;
}

/** All descendants (depth-first, excluding the node itself). */
export function descendantsOf(index: NodeIndex, id: string): DashboardNode[] {
  const result: DashboardNode[] = [];
  const stack = [...childrenOf(index, id)];
  const seen = new Set<string>([id]);
  while (stack.length) {
    const node = stack.pop() as DashboardNode;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node);
    stack.push(...childrenOf(index, node.id));
  }
  return result;
}

/** Depth of a node: root nodes have depth 0, children of a root group depth 1, ... */
export function depthOf(index: NodeIndex, id: string): number {
  return ancestorsOf(index, id).length;
}

/** Height of the group subtree measured in group levels (a group without sub-groups = 1). */
export function groupLevels(index: NodeIndex, id: string, seen = new Set<string>()): number {
  if (seen.has(id)) throw new Error("Cyclic group hierarchy");
  const node = index.byId.get(id);
  if (!isGroup(node)) return 0;
  seen.add(id);
  let max = 0;
  for (const child of childrenOf(index, id)) max = Math.max(max, groupLevels(index, child.id, seen));
  seen.delete(id);
  return 1 + max;
}

/** True when `candidateAncestorId` is `id` itself or one of its ancestors. */
export function isSelfOrAncestor(index: NodeIndex, candidateAncestorId: string, id: string): boolean {
  if (candidateAncestorId === id) return true;
  return ancestorsOf(index, id).some((group) => group.id === candidateAncestorId);
}

/** Number of columns available inside a parent (root = base grid). */
export function innerColumns(index: NodeIndex, parentId: string | null): number {
  if (parentId === null) return BASE_COLUMNS;
  const parent = index.byId.get(parentId);
  return parent ? parent.tile.w : BASE_COLUMNS;
}

export function findDashboard<T extends { id: string }>(dashboards: readonly T[], id: string): T | undefined {
  return dashboards.find((dashboard) => dashboard.id === id);
}

/** Sorts nodes in reading order (y, then x). */
export function byReadingOrder(a: DashboardNode, b: DashboardNode): number {
  return a.tile.y - b.tile.y || a.tile.x - b.tile.x || a.id.localeCompare(b.id);
}

/** Sorts nodes by flow order, falling back to reading order. */
export function byFlowOrder(a: DashboardNode, b: DashboardNode): number {
  return a.tile.order - b.tile.order || byReadingOrder(a, b);
}

export function dashboardNodeCount(dashboard: Dashboard): number {
  return dashboard.nodes.length;
}
