import type { Command } from "./commands";
import { cloneDocument, validateDocument } from "./schema";
import type { DashboardDocument } from "./types";

export class History {
  private past: DashboardDocument[] = [];
  private future: DashboardDocument[] = [];
  private baseline: DashboardDocument;
  private current: DashboardDocument;
  constructor(
    document: DashboardDocument,
    private readonly limit = 100,
  ) {
    validateDocument(document);
    this.baseline = cloneDocument(document);
    this.current = cloneDocument(document);
  }
  get document(): DashboardDocument {
    return cloneDocument(this.current);
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  get dirty(): boolean {
    return JSON.stringify(this.current) !== JSON.stringify(this.baseline);
  }
  execute(command: Command): void {
    const next = command.execute(this.current);
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = next;
    this.future = [];
  }
  undo(): void {
    const previous = this.past.pop();
    if (previous) {
      this.future.push(this.current);
      this.current = previous;
    }
  }
  redo(): void {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
  }
  saved(document: DashboardDocument): void {
    validateDocument(document);
    this.current = cloneDocument(document);
    this.baseline = cloneDocument(document);
    this.past = [];
    this.future = [];
  }
  cancel(): void {
    this.saved(this.baseline);
  }
}
