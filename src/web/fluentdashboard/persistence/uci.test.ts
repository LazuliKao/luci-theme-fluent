import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultDocument } from "../core/schema";
import { DashboardPersistence, RevisionConflictError } from "./uci";

test("two editors cannot silently overwrite a newer shared revision", async () => {
  let stored = createDefaultDocument();
  const transport = {
    load: async () => ({ document: stored }),
    save: async (layout: string, revision: number) => {
      if (revision !== stored.revision) return { error: "conflict", revision: stored.revision };
      stored = { ...JSON.parse(layout), revision: revision + 1 };
      return { document: stored };
    },
  };
  const a = new DashboardPersistence(transport),
    b = new DashboardPersistence(transport);
  const [first, second] = await Promise.all([a.load(), b.load()]);
  first.dashboards[0].name = "Published";
  second.dashboards[0].name = "Stale";
  assert.equal((await a.save(first)).revision, 1);
  await assert.rejects(b.save(second), RevisionConflictError);
  assert.equal(stored.dashboards[0].name, "Published");
  assert.equal(second.revision, 0);
});
test("only explicit empty server state creates defaults; errors do not overwrite corruption", async () => {
  const empty = new DashboardPersistence({ load: async () => ({ document: null, revision: 0 }), save: async () => ({}) });
  assert.deepEqual(await empty.load(), createDefaultDocument());
  const corrupt = new DashboardPersistence({ load: async () => ({ error: "corrupt" }), save: async () => ({}) });
  await assert.rejects(corrupt.load());
});
test("draft retained after failure and cleared only after successful publish", async () => {
  const values = new Map<string, string>(),
    storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  let fail = true;
  const persistence = new DashboardPersistence({ load: async () => ({}), save: async (layout) => (fail ? { error: "storage" } : { document: { ...JSON.parse(layout), revision: 1 } }) }, storage);
  const document = createDefaultDocument();
  assert.equal(persistence.cacheDraft(document), true);
  await assert.rejects(persistence.save(document));
  assert.deepEqual(persistence.readDraft(), document);
  fail = false;
  await persistence.save(document);
  assert.equal(persistence.readDraft(), undefined);
});
