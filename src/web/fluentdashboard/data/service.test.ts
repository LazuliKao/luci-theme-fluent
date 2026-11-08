import assert from "node:assert/strict";
import test from "node:test";
import { Scheduler } from "./scheduler";
import { DataService } from "./service";

test("multiple selectors of one source share a single flight and stop receiving after unsubscribe", async () => {
  let requests = 0;
  const scheduler = new Scheduler(undefined, 50, () => 0);
  const service = new DataService(scheduler);
  service.register({
    key: "devices",
    interval: 10_000,
    load: async () => {
      requests++;
      return [{ name: "lan" }, { name: "wan" }];
    },
  });
  const lan: number[] = [],
    wan: number[] = [];
  const offLan = service.select<{ name: string }[], number>(
    "devices",
    (devices) => devices.filter((d) => d.name === "lan").length,
    (state) => {
      if (state.data !== undefined) lan.push(state.data);
    },
  );
  const offWan = service.select<{ name: string }[], number>(
    "devices",
    (devices) => devices.filter((d) => d.name === "wan").length,
    (state) => {
      if (state.data !== undefined) wan.push(state.data);
    },
  );
  try {
    await scheduler.flush();
    assert.equal(requests, 1);
    assert.deepEqual(lan, [1]);
    assert.deepEqual(wan, [1]);
    offLan();
    offWan();
    const snapshot = [lan.length, wan.length];
    const refreshed = service.refresh(["devices", "devices"]);
    await scheduler.flush();
    await refreshed;
    assert.equal(requests, 2);
    assert.deepEqual([lan.length, wan.length], snapshot);
  } finally {
    offLan();
    offWan();
    service.destroy();
  }
});
