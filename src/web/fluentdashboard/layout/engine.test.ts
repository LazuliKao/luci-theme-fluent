import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultDocument } from "../core/schema";
import { collides, compactVertical, resolveLayout } from "./engine";

test("12/6/2 folding is collision-free and never mutates authored coordinates", () => {
  const nodes = createDefaultDocument().dashboards[0].nodes,
    before = JSON.stringify(nodes);
  for (const columns of [12, 6, 2]) {
    const items = [...resolveLayout(nodes, columns).items.values()];
    for (let i = 0; i < items.length; i++) {
      assert.ok(items[i].x + items[i].w <= columns);
      for (let j = 0; j < i; j++) assert.equal(collides(items[i], items[j]), false);
    }
  }
  assert.equal(JSON.stringify(nodes), before);
});
test("gravity resolves overlapping rectangles", () => {
  const items = compactVertical(
    [
      { id: "a", x: 0, y: 0, w: 6, h: 4 },
      { id: "b", x: 0, y: 0, w: 6, h: 4 },
    ],
    12,
  );
  assert.equal(collides(items[0], items[1]), false);
});
test("desktop layout preserves deliberate authored spacing while folded views flow", () => {
  const nodes = createDefaultDocument().dashboards[0].nodes;
  for (const node of nodes) node.tile.y += 42;
  assert.equal(resolveLayout(nodes, 12).items.get(nodes[0].id)?.y, 42);
  assert.notEqual(resolveLayout(nodes, 2).items.get(nodes[0].id)?.y, 42);
});
