import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes, formatDuration, formatLoad, normalizeMounts, normalizeSystemSnapshot, normalizeTelemetry, usedPercent } from "./model";

test("normalizes missing optional system data", () => {
  assert.deepEqual(normalizeSystemSnapshot(undefined, { memory: null }, {}), {
    hostname: "",
    model: "",
    architecture: "",
    target: "",
    firmware: "",
    kernel: "",
    luciVersion: "",
    uptime: 0,
    localtime: 0,
    load: [],
    memory: { total: 0, free: 0 },
    swap: { total: 0, free: 0 },
    root: { total: 0, free: 0 },
    tmp: { total: 0, free: 0 },
  });
});

test("uses available memory and clamps utilization", () => {
  const snapshot = normalizeSystemSnapshot({}, { memory: { total: 100, free: 5, available: 25 } }, {});
  assert.deepEqual(snapshot.memory, { total: 100, free: 25 });
  assert.equal(usedPercent(snapshot.memory), 75);
  assert.equal(usedPercent({ total: 100, free: -20 }), 100);
  assert.equal(usedPercent({ total: 0, free: 0 }), 0);
});

test("formats dashboard values", () => {
  assert.equal(formatBytes(1536), "1.5 KiB");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatDuration(90061), "1d 1h 1m");
  assert.equal(formatDuration(0), "-");
  assert.equal(formatLoad([65535, 32768, 0]), "1.00 / 0.50 / 0.00");
});

test("normalizes telemetry and mount points safely", () => {
  const telemetry = normalizeTelemetry({
    temperatures: [{ zone: "thermal_zone0", type: "cpu-thermal", tempC: 52.4 }],
    conntrack: { count: 140, max: 16384 },
    ports: [{ device: "eth0", operstate: "up", carrier: true, speed: 1000, duplex: "full" }],
  });
  assert.equal(telemetry.temperatures.length, 1);
  assert.equal(telemetry.temperatures[0].tempC, 52.4);
  assert.equal(telemetry.conntrack.count, 140);
  assert.equal(telemetry.ports[0].speed, 1000);

  const mounts = normalizeMounts({
    result: [{ device: "/dev/root", mount: "/", size: 1000, free: 400, avail: 350 }],
  });
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].used, 600);
  assert.equal(mounts[0].percent, 60);
});
