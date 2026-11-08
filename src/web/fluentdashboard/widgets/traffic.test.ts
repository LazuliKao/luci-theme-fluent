import assert from "node:assert/strict";
import test from "node:test";
import { trafficRate } from "./traffic";

test("throughput uses byte counter deltas divided by elapsed seconds", () => {
  assert.deepEqual(trafficRate({ rx: 200, tx: 500, at: 1000 }, { rx: 1224, tx: 2548, at: 3000 }), { rx: 512, tx: 1024 });
});
test("counter resets, bad counters and duplicate timestamps cannot produce false spikes", () => {
  assert.equal(trafficRate({ rx: 100, tx: 100, at: 1000 }, { rx: 200, tx: 200, at: 1000 }), undefined);
  assert.deepEqual(trafficRate({ rx: 100, tx: 100, at: 1000 }, { rx: 10, tx: 200, at: 2000 }), { rx: 0, tx: 100 });
  assert.equal(trafficRate({ rx: -1, tx: 100, at: 1000 }, { rx: 200, tx: 200, at: 2000 }), undefined);
});
