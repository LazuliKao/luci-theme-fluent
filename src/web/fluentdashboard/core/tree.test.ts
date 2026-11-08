import assert from "node:assert/strict";
import test from "node:test";
import { ancestorsOf, depthOf, descendantsOf, groupLevels, indexNodes, isSelfOrAncestor } from "./tree";
import type { GroupNode } from "./types";

const group = (id: string, parentId: string | null): GroupNode => ({ kind: "group", id, parentId, title: id, tile: { size: "full", x: 0, y: 0, w: 12, h: 8, order: 0 } });
test("tree relationships and cycle guards", () => {
  const index = indexNodes([group("a", null), group("b", "a")]);
  assert.equal(depthOf(index, "b"), 1);
  assert.equal(groupLevels(index, "a"), 2);
  assert.deepEqual(
    descendantsOf(index, "a").map((n) => n.id),
    ["b"],
  );
  assert.equal(isSelfOrAncestor(index, "a", "b"), true);
  const cycle = indexNodes([group("a", "b"), group("b", "a")]);
  assert.equal(ancestorsOf(cycle, "a").length, 1);
  assert.throws(() => groupLevels(cycle, "a"));
});
