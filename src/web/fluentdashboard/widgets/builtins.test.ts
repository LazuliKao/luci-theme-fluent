import assert from "node:assert/strict";
import test from "node:test";
import { filtered, validTableConfig } from "./table";

test("table filters visible values, sorts numeric fields and limits without mutating source", () => {
  const rows = [
    { name: "wifi10", signal: -80 },
    { name: "wifi2", signal: -45 },
    { name: "guest", signal: -60 },
  ];
  assert.deepEqual(filtered(rows, { query: "wifi", sortBy: "signal", descending: true, limit: 1 }), [rows[1]]);
  assert.deepEqual(filtered(rows, { sortBy: "name" }), [rows[2], rows[1], rows[0]]);
  assert.equal(rows[0].name, "wifi10");
  assert.equal(validTableConfig({ sortBy: "signal", descending: true }), true);
  assert.equal(validTableConfig({ descending: "true" }), false);
  assert.deepEqual(filtered(rows, { query: "missing" }), []);
});
