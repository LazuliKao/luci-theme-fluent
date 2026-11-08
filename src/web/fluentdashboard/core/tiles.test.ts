import assert from "node:assert/strict";
import test from "node:test";
import { allowedPresets, clampDimensions, DEFAULT_CONSTRAINTS, presetDimensions, sanitizeTile } from "./tiles";

test("presets respect parent columns and widget bounds", () => {
  assert.deepEqual(presetDimensions("full", DEFAULT_CONSTRAINTS, 6), { w: 6, h: 8 });
  assert.deepEqual(clampDimensions({ w: Infinity, h: -10 }), { w: 1, h: 2 });
  assert.deepEqual(allowedPresets({ min: { w: 4, h: 8 }, max: { w: 6, h: 8 } }), ["large", "xlarge"]);
  const tile = sanitizeTile({ x: 99, y: -1, w: 12, h: 8 }, 2);
  assert.equal(tile.x, 0);
  assert.equal(tile.w, 2);
  assert.equal(tile.y, 0);
});
