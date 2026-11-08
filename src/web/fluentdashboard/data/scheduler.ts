export interface Source<T = unknown> {
  key: string;
  interval: number;
  load(): Promise<T>;
}
export interface SourceState<T = unknown> {
  status: "idle" | "loading" | "ready" | "error";
  data?: T;
  error?: unknown;
  stale: boolean;
  attemptedAt?: number;
  updatedAt?: number;
}
interface Entry {
  source: Source;
  state: SourceState;
  listeners: Set<(state: SourceState) => void>;
  due: number;
  failures: number;
  flight?: Promise<SourceState>;
  complete?: (state: SourceState) => void;
}
export type BatchDispatcher = (sources: readonly Source[]) => Promise<PromiseSettledResult<unknown>[]>;
/** LuCI rpc.declare calls enqueue into LuCI's request batch when invoked in one tick. */
export const dispatchTogether: BatchDispatcher = (sources) =>
  Promise.allSettled(
    sources.map((s) => {
      try {
        return s.load();
      } catch (error) {
        return Promise.reject(error);
      }
    }),
  );

/** One timer, shared flights, bounded retry delays and a 50ms coalescing window. */
export class Scheduler {
  private entries = new Map<string, Entry>();
  private queue = new Set<Entry>();
  private timer?: ReturnType<typeof setTimeout>;
  private tickTimer?: ReturnType<typeof setInterval>;
  private paused = false;
  private disposed = false;
  constructor(
    private readonly dispatch: BatchDispatcher = dispatchTogether,
    private readonly windowMs = 50,
    private readonly now = Date.now,
  ) {}
  register<T>(source: Source<T>): void {
    if (this.entries.has(source.key)) throw new Error(`Duplicate data source: ${source.key}`);
    this.entries.set(source.key, { source, state: { status: "idle", stale: false }, listeners: new Set(), due: 0, failures: 0 });
  }
  state<T>(key: string): SourceState<T> {
    return { ...this.entry(key).state } as SourceState<T>;
  }
  subscribe<T>(key: string, listener: (state: SourceState<T>) => void): () => void {
    if (this.disposed) throw new Error("Scheduler destroyed");
    const entry = this.entry(key),
      callback = listener as (state: SourceState) => void;
    entry.listeners.add(callback);
    callback({ ...entry.state });
    if (!this.paused && this.now() >= entry.due) void this.request(key);
    if (!this.tickTimer) this.tickTimer = setInterval(() => this.tick(), 250);
    return () => {
      entry.listeners.delete(callback);
      if (![...this.entries.values()].some((e) => e.listeners.size)) {
        clearInterval(this.tickTimer);
        this.tickTimer = undefined;
      }
    };
  }
  request(key: string): Promise<SourceState> {
    if (this.disposed) return Promise.reject(new Error("Scheduler destroyed"));
    const entry = this.entry(key);
    if (entry.flight) return entry.flight;
    entry.flight = new Promise((resolve) => {
      entry.complete = resolve;
    });
    this.queue.add(entry);
    if (!this.timer)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.flush();
      }, this.windowMs);
    return entry.flight;
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.tick();
  }
  tick(): void {
    if (this.paused || this.disposed) return;
    for (const entry of this.entries.values()) if (entry.listeners.size && !entry.flight && this.now() >= entry.due) void this.request(entry.source.key);
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const batch = [...this.queue];
    this.queue.clear();
    if (!batch.length || this.disposed) return;
    for (const e of batch) {
      e.state = { ...e.state, status: "loading", attemptedAt: this.now() };
      this.notify(e);
    }
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await this.dispatch(batch.map((e) => e.source));
    } catch (reason) {
      results = batch.map(() => ({ status: "rejected", reason }));
    }
    if (this.disposed) return;
    batch.forEach((entry, i) => {
      const result = results[i];
      if (result?.status === "fulfilled") {
        entry.state = { status: "ready", data: result.value, stale: false, attemptedAt: entry.state.attemptedAt, updatedAt: this.now() };
        entry.failures = 0;
      } else {
        entry.failures++;
        entry.state = { ...entry.state, status: "error", stale: entry.state.updatedAt !== undefined, error: result?.status === "rejected" ? result.reason : new Error("Missing batch result") };
      }
      entry.due = this.now() + (entry.failures ? Math.min(300000, Math.max(1000, entry.source.interval) * 2 ** Math.min(8, entry.failures)) : entry.source.interval);
      const complete = entry.complete;
      entry.complete = undefined;
      entry.flight = undefined;
      complete?.({ ...entry.state });
      this.notify(entry);
    });
  }
  destroy(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    clearInterval(this.tickTimer);
    this.queue.clear();
    for (const entry of this.entries.values()) {
      entry.listeners.clear();
      entry.complete?.({ ...entry.state });
      entry.complete = undefined;
      entry.flight = undefined;
    }
  }
  private entry(key: string): Entry {
    const entry = this.entries.get(key);
    if (!entry) throw new Error(`Unknown source: ${key}`);
    return entry;
  }
  private notify(entry: Entry): void {
    for (const listener of [...entry.listeners]) {
      try {
        listener({ ...entry.state });
      } catch (error) {
        console.error("Dashboard subscriber failed", error);
      }
    }
  }
}
