import { cloneDocument, createDefaultDocument, migrateDocument, validateDocument } from "../core/schema";
import type { DashboardDocument } from "../core/types";

export interface PersistenceReply {
  document?: unknown;
  revision?: number;
  error?: string;
  message?: string;
}
export interface DashboardTransport {
  load(): Promise<PersistenceReply>;
  save(layout: string, expectedRevision: number): Promise<PersistenceReply>;
}
export class RevisionConflictError extends Error {
  constructor(readonly revision: number) {
    super("Dashboard changed on another device. Export your draft or reload the shared layout before saving.");
  }
}
export class DashboardPersistence {
  private saving = false;
  constructor(
    private transport: DashboardTransport,
    private storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
    private draftKey = "fluentdashboard.draft.v1",
  ) {}
  async load(): Promise<DashboardDocument> {
    const reply = await this.transport.load();
    if (reply.error) throw new Error(reply.message ?? reply.error);
    if (reply.document === null && reply.revision === 0) return createDefaultDocument();
    return migrateDocument(reply.document);
  }
  async save(document: DashboardDocument): Promise<DashboardDocument> {
    if (this.saving) throw new Error("A save is already in progress");
    validateDocument(document);
    const snapshot = cloneDocument(document);
    snapshot.meta = { ...snapshot.meta, updatedAt: new Date().toISOString() };
    this.saving = true;
    try {
      const reply = await this.transport.save(JSON.stringify(snapshot), document.revision);
      if (reply.error === "conflict") throw new RevisionConflictError(reply.revision ?? 0);
      if (reply.error) throw new Error(reply.message ?? reply.error);
      const saved = migrateDocument(reply.document);
      if (saved.revision <= document.revision) throw new Error("Server returned a non-increasing revision");
      this.clearDraft();
      return saved;
    } finally {
      this.saving = false;
    }
  }
  cacheDraft(document: DashboardDocument): boolean {
    try {
      validateDocument(document);
      this.storage?.setItem(this.draftKey, JSON.stringify(document));
      return Boolean(this.storage);
    } catch {
      return false;
    }
  }
  readDraft(): DashboardDocument | undefined {
    try {
      const value = this.storage?.getItem(this.draftKey);
      return value ? migrateDocument(JSON.parse(value)) : undefined;
    } catch {
      return undefined;
    }
  }
  clearDraft(): void {
    try {
      this.storage?.removeItem(this.draftKey);
    } catch {
      /* Browser storage can be disabled. */
    }
  }
}
