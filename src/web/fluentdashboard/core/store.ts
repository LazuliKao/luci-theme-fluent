import type { Command } from "./commands";
import { History } from "./history";
import type { DashboardDocument } from "./types";

export class DashboardStore {
  readonly history: History;
  activeDashboardId: string;
  isEditing = false;
  previewColumns: 12 | 6 | 2 | null = null;
  readonly selection = new Set<string>();
  readonly collapsed = new Set<string>();
  private listeners = new Set<() => void>();
  constructor(document: DashboardDocument) {
    this.history = new History(document);
    this.activeDashboardId = document.defaultDashboardId;
    this.resetCollapsed();
  }
  get document(): DashboardDocument {
    return this.history.document;
  }
  get activeDashboard() {
    return this.document.dashboards.find((d) => d.id === this.activeDashboardId) ?? this.document.dashboards[0];
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(): void {
    if (!this.document.dashboards.some((d) => d.id === this.activeDashboardId)) this.activeDashboardId = this.document.defaultDashboardId;
    const ids = new Set(this.activeDashboard.nodes.map((n) => n.id));
    for (const id of this.selection) if (!ids.has(id)) this.selection.delete(id);
    for (const listener of [...this.listeners]) listener();
  }
  execute(command: Command): void {
    if (!this.isEditing) throw new Error("Enter edit mode first");
    this.history.execute(command);
    this.emit();
  }
  undo(): void {
    if (this.isEditing) {
      this.history.undo();
      this.emit();
    }
  }
  redo(): void {
    if (this.isEditing) {
      this.history.redo();
      this.emit();
    }
  }
  edit(): void {
    this.isEditing = true;
    this.emit();
  }
  cancel(): void {
    this.history.cancel();
    this.isEditing = false;
    this.previewColumns = null;
    this.selection.clear();
    this.resetCollapsed();
    this.emit();
  }
  saved(document: DashboardDocument): void {
    this.history.saved(document);
    this.isEditing = false;
    this.previewColumns = null;
    this.selection.clear();
    this.resetCollapsed();
    this.emit();
  }
  switchDashboard(id: string): void {
    if (!this.document.dashboards.some((d) => d.id === id)) throw new Error("Dashboard not found");
    this.activeDashboardId = id;
    this.selection.clear();
    this.emit();
  }
  private resetCollapsed(): void {
    this.collapsed.clear();
    for (const d of this.document.dashboards) for (const n of d.nodes) if (n.kind === "group" && n.collapsed) this.collapsed.add(n.id);
  }
}
