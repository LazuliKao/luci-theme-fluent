import assert from "node:assert/strict";
import test from "node:test";
import { AddNodeCommand, BatchCommand, DissolveGroupCommand, EditCommand, MoveNodeCommand, RemoveNodeCommand, ToggleLockCommand, UpdateConfigCommand } from "./commands";
import { History } from "./history";
import { createDefaultDocument, migrateDocument, validateDocument } from "./schema";
import { DashboardStore } from "./store";
import type { GroupNode } from "./types";

const group = (id = "group", parentId: string | null = null): GroupNode => ({ id, parentId, kind: "group", title: id, tile: { x: 0, y: 32, w: 12, h: 8, order: 7, size: "full" } });
test("defaults roundtrip; unknown widget types and configs survive", () => {
  const doc = createDefaultDocument();
  const node = doc.dashboards[0].nodes[0];
  if (node.kind === "widget") {
    node.widgetType = "extension.future";
    node.config = { nested: [1, true, null] };
  }
  assert.deepEqual(migrateDocument(JSON.parse(JSON.stringify(doc))), doc);
});
test("reject corrupted parent graphs, dimensions, versions and non-JSON data", () => {
  for (const corrupt of [
    (d: ReturnType<typeof createDefaultDocument>) => {
      d.schemaVersion = 99;
    },
    (d: ReturnType<typeof createDefaultDocument>) => {
      d.dashboards[0].nodes[0].parentId = "missing";
    },
    (d: ReturnType<typeof createDefaultDocument>) => {
      d.dashboards[0].nodes[0].tile.x = 12;
    },
    (d: ReturnType<typeof createDefaultDocument>) => {
      (d.dashboards[0].nodes[0] as unknown as Record<string, unknown>).parentId = undefined;
    },
    (d: ReturnType<typeof createDefaultDocument>) => {
      d.dashboards[0].nodes.push(group("a", "b"), group("b", "a"));
    },
    (d: ReturnType<typeof createDefaultDocument>) => {
      d.dashboards[0].nodes.push(group("a"), group("b", "a"), group("c", "b"));
    },
  ]) {
    const doc = createDefaultDocument();
    corrupt(doc);
    assert.throws(() => validateDocument(doc));
  }
});
test("collision moves restore whole document and clear redo on branching", () => {
  const doc = createDefaultDocument(),
    history = new History(doc),
    n = doc.dashboards[0].nodes[0];
  history.execute(new MoveNodeCommand("overview", [{ id: n.id, parentId: null, x: 6, y: 0, w: 6, h: 8 }]));
  const moved = history.document;
  assert.notDeepEqual(moved, doc);
  history.undo();
  assert.deepEqual(history.document, doc);
  assert.equal(history.dirty, false);
  history.redo();
  assert.deepEqual(history.document, moved);
  history.undo();
  history.execute(new UpdateConfigCommand("overview", n.id, { query: "router" }));
  assert.equal(history.canRedo, false);
});
test("failed batches leave history untouched; locked deletion rejected", () => {
  const history = new History(createDefaultDocument()),
    initial = history.document;
  assert.throws(() => history.execute(new BatchCommand([new AddNodeCommand("overview", group()), new RemoveNodeCommand("overview", "absent")])));
  assert.deepEqual(history.document, initial);
  assert.equal(history.canUndo, false);
  history.execute(new ToggleLockCommand("overview", "system_info"));
  assert.throws(() => history.execute(new RemoveNodeCommand("overview", "system_info")));
});
test("dissolving group preserves children and is undoable", () => {
  const doc = createDefaultDocument();
  doc.dashboards[0].nodes.push(group());
  doc.dashboards[0].nodes[0].parentId = "group";
  const command = new DissolveGroupCommand("overview", "group"),
    next = command.execute(doc);
  assert.equal(next.dashboards[0].nodes.length, 7);
  assert.equal(next.dashboards[0].nodes[0].parentId, null);
  assert.deepEqual(command.undo(), doc);
});
test("runtime state is not document history; cancel returns saved baseline", () => {
  const store = new DashboardStore(createDefaultDocument());
  store.selection.add("system_info");
  store.collapsed.add("transient");
  assert.equal(store.history.dirty, false);
  assert.throws(() => store.execute(new RemoveNodeCommand("overview", "system_info")));
  store.edit();
  store.execute(new RemoveNodeCommand("overview", "system_info"));
  store.cancel();
  assert.equal(store.document.dashboards[0].nodes.length, 7);
  const snapshot = store.document;
  snapshot.dashboards[0].nodes.length = 0;
  assert.equal(store.document.dashboards[0].nodes.length, 7);
});
test("nested groups resize from child placement and move their siblings without overlap", () => {
  const doc = createDefaultDocument();
  doc.dashboards[0].nodes.push(group("container"));
  const first = doc.dashboards[0].nodes[0];
  first.parentId = "container";
  first.tile.x = 0;
  first.tile.y = 0;
  const history = new History(doc);
  history.execute(new MoveNodeCommand("overview", [{ id: first.id, parentId: "container", x: 0, y: 18, w: 6, h: 8 }]));
  const next = history.document.dashboards[0];
  const container = next.nodes.find((n) => n.id === "container");
  assert.ok(container && container.tile.h >= 27);
  assert.ok(
    next.nodes
      .filter((n) => n.parentId === null && n.id !== "container")
      .every(
        (n) => n.tile.y + n.tile.h <= container.tile.y || n.tile.y >= container.tile.y + container.tile.h || n.tile.x + n.tile.w <= container.tile.x || n.tile.x >= container.tile.x + container.tile.w,
      ),
  );
  history.undo();
  assert.deepEqual(history.document, doc);
});
test("switching away from a deleted dashboard falls back to the default", () => {
  const doc = createDefaultDocument();
  doc.dashboards.push({ id: "second", name: "Second", nodes: [] });
  const store = new DashboardStore(doc);
  store.switchDashboard("second");
  store.edit();
  store.execute(
    new EditCommand("Delete dashboard", (d) => {
      d.dashboards = d.dashboards.filter((dash) => dash.id !== "second");
    }),
  );
  assert.equal(store.activeDashboardId, "overview");
  store.undo();
  assert.equal(store.document.dashboards.length, 2);
});
test("mobile order is independent of desktop placement after drag", () => {
  const doc = createDefaultDocument();
  const original = doc.dashboards[0].nodes.map((n) => n.tile.order);
  const next = new MoveNodeCommand("overview", [{ id: "system_info", parentId: null, x: 0, y: 50, w: 6, h: 8 }]).execute(doc);
  assert.deepEqual(
    next.dashboards[0].nodes.map((n) => n.tile.order),
    original,
  );
});
