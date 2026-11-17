export interface StorageSnapshot {
  total: number;
  free: number;
}

export interface ThermalSensor {
  zone: string;
  type: string;
  tempC: number;
}

export interface PortStatusRow {
  device: string;
  operstate: string;
  carrier: boolean;
  speed: number | null;
  duplex: string;
}

export interface TelemetrySnapshot {
  temperatures: ThermalSensor[];
  conntrack: { count: number; max: number };
  ports: PortStatusRow[];
}

export interface MountRow {
  device: string;
  mount: string;
  size: number;
  used: number;
  avail: number;
  percent: number;
}

export interface SystemSnapshot {
  hostname: string;
  model: string;
  architecture: string;
  target: string;
  firmware: string;
  kernel: string;
  luciVersion: string;
  uptime: number;
  localtime: number;
  load: number[];
  memory: StorageSnapshot;
  swap: StorageSnapshot;
  root: StorageSnapshot;
  tmp: StorageSnapshot;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeStorage(value: unknown, availableKey = "free"): StorageSnapshot {
  const storage = asRecord(value);
  return {
    total: asNumber(storage.total),
    free: asNumber(storage[availableKey] ?? storage.free),
  };
}

export function normalizeSystemSnapshot(boardValue: unknown, infoValue: unknown, versionValue: unknown): SystemSnapshot {
  const board = asRecord(boardValue);
  const info = asRecord(infoValue);
  const release = asRecord(board.release);
  const version = asRecord(versionValue);
  const load = Array.isArray(info.load) ? info.load.map(asNumber) : [];

  return {
    hostname: asString(board.hostname),
    model: asString(board.model),
    architecture: asString(board.system),
    target: asString(release.target),
    firmware: asString(release.description),
    kernel: asString(board.kernel),
    luciVersion: [asString(version.branch), asString(version.revision)].filter(Boolean).join(" "),
    uptime: asNumber(info.uptime),
    localtime: asNumber(info.localtime),
    load,
    memory: normalizeStorage(info.memory, "available"),
    swap: normalizeStorage(info.swap),
    root: normalizeStorage(info.root),
    tmp: normalizeStorage(info.tmp),
  };
}

export function usedPercent(storage: StorageSnapshot): number {
  if (storage.total <= 0) return 0;
  return Math.min(100, Math.max(0, ((storage.total - storage.free) / storage.total) * 100));
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** unit;
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return [days > 0 ? `${days}d` : "", `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
}

export function formatLoad(load: number[]): string {
  if (load.length === 0) return "-";
  return load
    .slice(0, 3)
    .map((value) => (value / 65535).toFixed(2))
    .join(" / ");
}

export function formatLocalTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(timestamp * 1000));
}

export function normalizeTelemetry(value: unknown): TelemetrySnapshot {
  const data = asRecord(value);
  const temperatures: ThermalSensor[] = Array.isArray(data.temperatures)
    ? data.temperatures
        .map((item) => {
          const rec = asRecord(item);
          return { zone: asString(rec.zone), type: asString(rec.type), tempC: asNumber(rec.tempC) };
        })
        .filter((item) => Number.isFinite(item.tempC) && item.tempC > -100 && item.tempC < 200)
    : [];
  const ct = asRecord(data.conntrack);
  const ports: PortStatusRow[] = Array.isArray(data.ports)
    ? data.ports
        .map((item) => {
          const rec = asRecord(item);
          const speed = typeof rec.speed === "number" && rec.speed > 0 ? rec.speed : null;
          return {
            device: asString(rec.device),
            operstate: asString(rec.operstate) || "unknown",
            carrier: Boolean(rec.carrier),
            speed,
            duplex: asString(rec.duplex),
          };
        })
        .filter((item) => item.device.length > 0)
    : [];
  return {
    temperatures,
    conntrack: { count: Math.max(0, asNumber(ct.count)), max: Math.max(0, asNumber(ct.max)) },
    ports,
  };
}

export function normalizeMounts(value: unknown): MountRow[] {
  const list = Array.isArray(value) ? value : Array.isArray(asRecord(value).result) ? (asRecord(value).result as unknown[]) : [];
  return list
    .map((item) => {
      const rec = asRecord(item);
      const size = Math.max(0, asNumber(rec.size));
      const free = Math.max(0, asNumber(rec.free));
      const avail = Math.max(0, asNumber(rec.avail ?? rec.free));
      const used = Math.max(0, size - free);
      const percent = size > 0 ? Math.min(100, Math.max(0, (used / size) * 100)) : 0;
      return {
        device: asString(rec.device),
        mount: asString(rec.mount),
        size,
        used,
        avail,
        percent,
      };
    })
    .filter((row) => row.mount.length > 0 && row.size > 0);
}
