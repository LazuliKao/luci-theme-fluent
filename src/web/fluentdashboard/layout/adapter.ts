import type { DashboardNode, NodePlacement } from "../core/types";
export interface AdapterMountOptions {
  render(node: DashboardNode): HTMLElement;
  collapsed(): ReadonlySet<string>;
  visible(ids: ReadonlySet<string>): void;
}
export interface LayoutAdapter {
  mount(container: HTMLElement, options: AdapterMountOptions): void;
  setEditing(enabled: boolean): void;
  apply(nodes: readonly DashboardNode[], columns: number): void;
  onChange(listener: (placements: NodePlacement[]) => void): () => void;
  destroy(): void;
}
