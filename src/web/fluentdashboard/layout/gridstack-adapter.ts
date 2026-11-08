import { type GridItemHTMLElement, GridStack } from "gridstack";
import { ancestorsOf, depthOf, groupLevels, indexNodes, isSelfOrAncestor } from "../core/tree";
import type { DashboardNode, NodePlacement } from "../core/types";
import type { AdapterMountOptions, LayoutAdapter } from "./adapter";
import { resolveLayout } from "./engine";

/** GridStack objects and DOM conventions stop at this boundary. */
export class GridstackAdapter implements LayoutAdapter {
  private container?: HTMLElement;
  private options?: AdapterMountOptions;
  private grids = new Map<string | null, GridStack>();
  private elements = new Map<string, GridItemHTMLElement>();
  private nodes: readonly DashboardNode[] = [];
  private columns = 12;
  private editing = false;
  private applying = false;
  private notification?: ReturnType<typeof setTimeout>;
  private listeners = new Set<(placements: NodePlacement[]) => void>();
  mount(container: HTMLElement, options: AdapterMountOptions): void {
    this.container = container;
    this.options = options;
  }
  setEditing(enabled: boolean): void {
    this.editing = enabled;
    for (const grid of this.grids.values()) grid.setStatic(!enabled || this.columns !== 12);
  }
  onChange(listener: (placements: NodePlacement[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  apply(nodes: readonly DashboardNode[], columns: number): void {
    if (!this.container || !this.options) throw new Error("Layout not mounted");
    this.applying = true;
    this.nodes = nodes;
    this.columns = columns;
    const index = indexNodes(nodes);
    const layout = resolveLayout(nodes, columns, { includeHidden: this.editing, collapsed: this.options.collapsed() });
    const collapsed = this.options.collapsed();
    const wanted = new Set([...layout.items.keys()].filter((id) => !ancestorsOf(index, id).some((n) => collapsed.has(n.id))));
    // Tear down nested engines before removing their parent element.
    for (const [id, grid] of [...this.grids].reverse())
      if (id !== null && (!wanted.has(id) || collapsed.has(id))) {
        grid.destroy(false);
        this.grids.delete(id);
      }
    // Remove old items before updating coordinates so removed tiles cannot push survivors.
    for (const [id, el] of [...this.elements].reverse())
      if (!wanted.has(id)) {
        const owner = el.gridstackNode?.grid;
        if (owner?.engine) owner.removeWidget(el, true, false);
        el.remove();
        this.elements.delete(id);
      }
    const visible = new Set<string>();
    const renderGrid = (parentId: string | null, container: HTMLElement) => {
      const resolved = layout.grids.get(parentId);
      if (!resolved) return;
      let grid = this.grids.get(parentId);
      if (!grid) {
        container.classList.add("grid-stack");
        grid = GridStack.init(
          {
            column: resolved.columns,
            cellHeight: 40,
            margin: 6,
            minRow: 2,
            float: true,
            animate: false,
            staticGrid: !this.editing || columns !== 12,
            handle: ".fluent-dashboard__card-header",
            removable: false,
            acceptWidgets: (el) => {
              const id = (el as HTMLElement).dataset.nodeId;
              const tree = indexNodes(this.nodes),
                node = id ? tree.byId.get(id) : undefined;
              if (!node || !this.editing || this.columns !== 12 || node.locked || ancestorsOf(tree, node.id).some((n) => n.locked)) return false;
              if (parentId === null) return true;
              const parent = tree.byId.get(parentId);
              return (
                parent?.kind === "group" &&
                !parent.locked &&
                !ancestorsOf(tree, parentId).some((n) => n.locked) &&
                !isSelfOrAncestor(tree, node.id, parentId) &&
                depthOf(tree, parentId) + 1 + groupLevels(tree, node.id) <= 2 &&
                node.tile.w <= parent.tile.w
              );
            },
          },
          container,
        );
        this.grids.set(parentId, grid);
        grid.on("dragstop resizestop dropped", () => this.scheduleChange());
      }
      grid.batchUpdate();
      grid.column(resolved.columns, "none");
      grid.setStatic(!this.editing || columns !== 12);
      for (const item of resolved.items) {
        const node = index.byId.get(item.id);
        if (!node) continue;
        visible.add(node.id);
        let el = this.elements.get(node.id);
        if (el && el.parentElement !== container) {
          if (el.gridstackNode?.grid?.engine) el.gridstackNode.grid.removeWidget(el, false, false);
          container.appendChild(el);
        }
        if (!el) {
          el = document.createElement("div");
          el.className = "grid-stack-item";
          el.dataset.nodeId = node.id;
          const content = document.createElement("div");
          content.className = "grid-stack-item-content";
          el.appendChild(content);
          this.elements.set(node.id, el);
          container.appendChild(el);
        }
        const content = el.querySelector(":scope > .grid-stack-item-content") as HTMLElement;
        const rendered = this.options?.render(node);
        if (rendered && rendered.parentElement !== content) content.replaceChildren(rendered);
        const locked = Boolean(node.locked || ancestorsOf(index, node.id).some((n) => n.locked));
        const placement = { id: node.id, x: item.x, y: item.y, w: item.w, h: item.h, locked, noMove: locked, noResize: locked || node.kind === "group", minW: 1, minH: 1, maxH: 48 };
        if (el.gridstackNode?.grid === grid) grid.update(el, placement);
        else grid.makeWidget(el, placement);
        if (node.kind === "group") {
          const inner = rendered?.querySelector<HTMLElement>(".fluent-dashboard__group-body");
          if (inner) {
            inner.hidden = item.collapsed;
            if (!item.collapsed) renderGrid(node.id, inner);
          }
        }
      }
      grid.batchUpdate(false);
    };
    try {
      renderGrid(null, this.container);
      this.options.visible(visible);
    } finally {
      this.applying = false;
    }
  }
  private scheduleChange(): void {
    if (this.applying || !this.editing || this.columns !== 12) return;
    clearTimeout(this.notification);
    // dropped and dragstop can span two grids; collect once after both have settled.
    this.notification = setTimeout(() => {
      const placements: NodePlacement[] = [];
      for (const [parentId, grid] of this.grids)
        for (const n of grid.engine.nodes) {
          const source = this.nodes.find((node) => node.id === (n.el?.dataset.nodeId ?? n.id));
          if (!source || source.locked || ancestorsOf(indexNodes(this.nodes), source.id).some((n) => n.locked)) continue;
          const p = { id: source.id, parentId, x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 1, h: source.kind === "group" ? source.tile.h : (n.h ?? 2) };
          if (p.parentId !== source.parentId || p.x !== source.tile.x || p.y !== source.tile.y || p.w !== source.tile.w || p.h !== source.tile.h) placements.push(p);
        }
      if (placements.length) for (const listener of this.listeners) listener(placements);
    }, 0);
  }
  destroy(): void {
    clearTimeout(this.notification);
    for (const grid of [...this.grids.values()].reverse()) if (grid.engine) grid.destroy(false);
    this.grids.clear();
    this.elements.clear();
    this.listeners.clear();
    this.container?.replaceChildren();
    this.container = undefined;
  }
}
