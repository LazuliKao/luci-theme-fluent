import assert from "node:assert/strict";
import test from "node:test";
import { Scheduler } from "./scheduler";

test("coalesces source requests, reuses flights, retains stale data on error", async () => {
  let calls = 0,
    fail = false,
    clock = 0;
  const scheduler = new Scheduler(
    async (sources) => {
      calls++;
      return Promise.allSettled(sources.map((s) => s.load()));
    },
    50,
    () => clock,
  );
  scheduler.register({
    key: "a",
    interval: 3000,
    load: async () => {
      if (fail) throw new Error("offline");
      return 42;
    },
  });
  scheduler.register({ key: "b", interval: 10000, load: async () => 7 });
  try {
    const a = scheduler.request("a"),
      b = scheduler.request("b");
    assert.equal(scheduler.request("a"), a);
    await scheduler.flush();
    await Promise.all([a, b]);
    assert.equal(calls, 1);
    clock = 3000;
    fail = true;
    const failed = scheduler.request("a");
    await scheduler.flush();
    assert.equal((await failed).data, 42);
    assert.equal(scheduler.state("a").stale, true);
    assert.equal(scheduler.state("a").updatedAt, 0);
  } finally {
    scheduler.destroy();
  }
});
test("unsubscribe prevents delivery, pauses stop polling, disposal settles queued requests", async () => {
  const scheduler = new Scheduler();
  let notifications = 0;
  scheduler.register({ key: "a", interval: 3, load: async () => 1 });
  scheduler.setPaused(true);
  const unsubscribe = scheduler.subscribe("a", () => {
    notifications++;
  });
  scheduler.tick();
  assert.equal(scheduler.state("a").status, "idle");
  unsubscribe();
  const request = scheduler.request("a");
  await scheduler.flush();
  await request;
  assert.equal(notifications, 1);
  const pending = scheduler.request("a");
  scheduler.destroy();
  await pending;
});
