import { Scheduler, type Source, type SourceState } from "./scheduler";

export class DataService {
  private pauses = new Set<string>();
  private detachVisibility?: () => void;
  constructor(readonly scheduler = new Scheduler()) {}
  register<T>(source: Source<T>): void {
    this.scheduler.register(source);
  }
  subscribe<T>(key: string, listener: (state: SourceState<T>) => void): () => void {
    return this.scheduler.subscribe(key, listener);
  }
  select<T, R>(key: string, selector: (data: T) => R, listener: (state: SourceState<R>) => void): () => void {
    return this.subscribe<T>(key, (state) => listener({ ...state, data: state.data === undefined ? undefined : selector(state.data) }));
  }
  refresh(keys: readonly string[]): Promise<SourceState[]> {
    return Promise.all([...new Set(keys)].map((key) => this.scheduler.request(key)));
  }
  pause(reason: string, paused: boolean): void {
    if (paused) this.pauses.add(reason);
    else this.pauses.delete(reason);
    this.scheduler.setPaused(this.pauses.size > 0);
  }
  observeVisibility(document: Document): void {
    this.detachVisibility?.();
    const update = () => this.pause("visibility", document.hidden);
    document.addEventListener("visibilitychange", update);
    update();
    this.detachVisibility = () => document.removeEventListener("visibilitychange", update);
  }
  destroy(): void {
    this.detachVisibility?.();
    this.scheduler.destroy();
  }
}
