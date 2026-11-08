import { DEFAULT_CONSTRAINTS } from "../core/tiles";
import type { WidgetConfig } from "../core/types";
import type { SourceState } from "../data/scheduler";
import { formatBytes, formatDuration, formatLoad, type SystemSnapshot, usedPercent } from "../model";
import type { ClientRow, LeaseRow, NetworkRow, WirelessRow } from "./cards";
import { normalizeSystemSnapshot } from "./cards";
import type { WidgetContext, WidgetInstance, WidgetRegistry } from "./registry";
import { trafficRate } from "./traffic";

type Value = { value: string; detail?: string; percent?: number };
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}
function system(states: Map<string, SourceState>): SystemSnapshot {
  return normalizeSystemSnapshot(states.get("system.board")?.data, states.get("system.info")?.data, states.get("system.version")?.data);
}
function rows<T>(states: Map<string, SourceState>, key: string): T[] {
  return (states.get(key)?.data as T[] | undefined) ?? [];
}
function selected<T extends { name: string }>(items: T[], config: WidgetConfig): T | undefined {
  return items.find((item) => item.name === config.interface) ?? (config.interface ? undefined : items[0]);
}
class MetricWidget implements WidgetInstance {
  private body?: HTMLElement;
  private off: Array<() => void> = [];
  private states = new Map<string, SourceState>();
  private config: WidgetConfig;
  private visible = false;
  constructor(
    private ctx: WidgetContext,
    private sources: string[],
    private calculate: (states: Map<string, SourceState>, config: WidgetConfig) => Value,
  ) {
    this.config = ctx.config;
  }
  mount(body: HTMLElement): void {
    this.body = body;
    this.setVisible(true);
  }
  updateConfig(config: WidgetConfig): void {
    this.config = config;
    this.paint();
  }
  resize(_width: number, _height: number): void {}
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const off of this.off) off();
    this.off = [];
    if (visible)
      this.off = this.sources.map((key) =>
        this.ctx.data.subscribe(key, (state) => {
          this.states.set(key, state);
          this.paint();
        }),
      );
  }
  destroy(): void {
    this.setVisible(false);
    this.body = undefined;
  }
  private paint(): void {
    if (!this.body) return;
    const sources = this.sources.map((key) => this.states.get(key));
    this.ctx.setStatus(sources.some((s) => s?.status === "error") ? _("Data is stale or unavailable.") : sources.some((s) => s?.data === undefined) ? _("Loading…") : "");
    if (sources.some((s) => s?.data === undefined)) return;
    const result = this.calculate(this.states, this.config);
    let content = this.body.querySelector<HTMLElement>(":scope > .fluent-dashboard__metric");
    if (!content) {
      content = node("div", "fluent-dashboard__metric", "");
      this.body.replaceChildren(content);
    }
    let value = content.querySelector<HTMLElement>(".fluent-dashboard__metric-value");
    if (!value) {
      value = node("strong", "fluent-dashboard__metric-value", "");
      content.append(value);
    }
    value.textContent = result.value;
    let detail = content.querySelector<HTMLElement>(".fluent-dashboard__metric-detail");
    if (result.detail) {
      if (!detail) {
        detail = node("span", "fluent-dashboard__metric-detail", "");
        content.append(detail);
      }
      detail.textContent = result.detail;
    } else detail?.remove();
    let progress = content.querySelector("progress");
    if (result.percent !== undefined) {
      if (!progress) {
        progress = document.createElement("progress");
        content.append(progress);
      }
      progress.max = 100;
      progress.value = result.percent;
      progress.setAttribute("aria-label", result.detail ?? _("Usage"));
    } else progress?.remove();
  }
}

/** Samples bytes (not wireless link speed) and computes rates from elapsed monotonic wall time. */
class TrafficWidget implements WidgetInstance {
  private body?: HTMLElement;
  private off?: () => void;
  private config: WidgetConfig;
  private samples: Array<{ rx: number; tx: number }> = [];
  private last?: { name: string; rx: number; tx: number; at: number };
  private sampledAt?: number;
  private state?: SourceState<NetworkRow[]>;
  private visible = false;
  constructor(private ctx: WidgetContext) {
    this.config = ctx.config;
  }
  mount(body: HTMLElement): void {
    this.body = body;
    this.setVisible(true);
  }
  updateConfig(config: WidgetConfig): void {
    this.config = config;
    this.samples = [];
    this.last = undefined;
    this.sampledAt = undefined;
    this.paint();
  }
  resize(_width: number, _height: number): void {}
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.off?.();
    this.off = undefined;
    if (visible)
      this.off = this.ctx.data.subscribe<NetworkRow[]>("network.interfaces", (state) => {
        this.state = state;
        if (state.status === "ready" && state.updatedAt && state.updatedAt !== this.sampledAt) {
          this.sample(state.data ?? [], state.updatedAt);
          this.sampledAt = state.updatedAt;
        }
        this.paint();
      });
  }
  destroy(): void {
    this.setVisible(false);
    this.body = undefined;
  }
  private sample(items: NetworkRow[], at: number): void {
    const row = selected(items, this.config);
    if (!row) {
      this.last = undefined;
      return;
    }
    const prior = this.last;
    if (prior && prior.name === row.name) {
      const rate = trafficRate(prior, { rx: row.rx, tx: row.tx, at });
      if (rate) this.samples.push(rate);
      this.samples = this.samples.slice(-Number(this.config.history ?? 40));
    }
    this.last = { name: row.name, rx: row.rx, tx: row.tx, at };
  }
  private paint(): void {
    if (!this.body) return;
    this.ctx.setStatus(this.state?.status === "error" ? _("Data is stale or unavailable.") : !this.state?.data ? _("Loading…") : "");
    if (!this.state?.data) return;
    let content = this.body.querySelector<HTMLElement>(":scope > .fluent-dashboard__traffic");
    if (!content) {
      content = node("div", "fluent-dashboard__traffic", "");
      this.body.replaceChildren(content);
    }
    const row = selected(this.state.data, this.config);
    let label = content.querySelector<HTMLElement>(".fluent-dashboard__metric-detail");
    if (!label) {
      label = node("span", "fluent-dashboard__metric-detail", "");
      content.append(label);
    }
    label.textContent = row?.name ?? _("No interface available");
    const latest = this.samples.at(-1);
    let value = content.querySelector<HTMLElement>(".fluent-dashboard__metric-value");
    if (!value) {
      value = node("strong", "fluent-dashboard__metric-value", "");
      content.append(value);
    }
    value.textContent = latest ? `${_("Down")} ${formatBytes(latest.rx)}/s · ${_("Up")} ${formatBytes(latest.tx)}/s` : _("Waiting for second sample…");
    content.querySelector("svg")?.remove();
    if (this.samples.length > 1) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 40");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", _("Receive and transmit throughput history"));
      const max = Math.max(1, ...this.samples.flatMap((s) => [s.rx, s.tx]));
      for (const direction of ["rx", "tx"] as const) {
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("class", `fluent-dashboard__traffic-${direction}`);
        polyline.setAttribute("points", this.samples.map((s, i) => `${((i * 100) / (this.samples.length - 1)).toFixed(2)},${(39 - (s[direction] / max) * 38).toFixed(2)}`).join(" "));
        svg.append(polyline);
      }
      content.append(svg);
    }
  }
}

export function registerMetrics(registry: WidgetRegistry): void {
  const metric = (
    type: string,
    title: string,
    category: string,
    sources: string[],
    calculate: (states: Map<string, SourceState>, config: WidgetConfig) => Value,
    options: { interface?: boolean; radio?: boolean } = {},
  ) =>
    registry.register({
      type,
      title,
      description: title,
      category,
      icon: "",
      version: 1,
      defaultSize: "medium",
      supportedSizes: ["medium", "wide", "large", "xlarge", "full", "custom"],
      constraints: { ...DEFAULT_CONSTRAINTS, min: { w: 2, h: 2 } },
      defaultConfig: options.interface ? { interface: "" } : options.radio ? { radio: "" } : {},
      requiredData: sources,
      validateConfig: (config) =>
        (!options.interface || config.interface === undefined || (typeof config.interface === "string" && config.interface.length <= 64)) &&
        (!options.radio || config.radio === undefined || (typeof config.radio === "string" && config.radio.length <= 64)),
      createInstance: (ctx) => new MetricWidget(ctx, sources, calculate),
    });
  const sys = ["system.board", "system.info", "system.version"];
  metric("system.hostname", _("Device name"), _("System"), sys, (s) => ({ value: system(s).hostname || "–", detail: system(s).model }));
  metric("system.uptime", _("Uptime"), _("System"), ["system.info"], (s) => ({ value: formatDuration(system(s).uptime) }));
  metric("system.load", _("System load"), _("System"), ["system.info"], (s) => ({ value: formatLoad(system(s).load), detail: _("1 / 5 / 15 minutes") }));
  metric("system.firmware", _("Firmware"), _("System"), ["system.board"], (s) => ({ value: system(s).firmware || "–", detail: system(s).target }));
  metric("system.kernel", _("Kernel"), _("System"), ["system.board"], (s) => ({ value: system(s).kernel || "–", detail: system(s).architecture }));
  for (const [type, title, key] of [
    ["memory", _("Memory"), "memory"],
    ["swap", _("Swap"), "swap"],
    ["root", _("Root storage"), "root"],
    ["tmp", _("Temporary storage"), "tmp"],
  ] as const) {
    metric(`system.${type}`, title, _("Resources"), ["system.info"], (s) => {
      const storage = system(s)[key];
      return storage.total
        ? { value: `${Math.round(usedPercent(storage))}%`, detail: `${formatBytes(storage.total - storage.free)} / ${formatBytes(storage.total)}`, percent: usedPercent(storage) }
        : { value: _("Not available") };
    });
  }
  metric(
    "network.interface-status",
    _("Interface status"),
    _("Network"),
    ["network.interfaces"],
    (s, c) => {
      const row = selected(rows<NetworkRow>(s, "network.interfaces"), c);
      return { value: row ? (row.up ? _("Online") : _("Offline")) : _("Not available"), detail: row ? `${row.name} · ${row.protocol}` : undefined };
    },
    { interface: true },
  );
  metric(
    "network.interface-address",
    _("Interface address"),
    _("Network"),
    ["network.interfaces"],
    (s, c) => {
      const row = selected(rows<NetworkRow>(s, "network.interfaces"), c);
      return { value: row?.addresses.join(", ") || "–", detail: row?.name };
    },
    { interface: true },
  );
  metric(
    "network.interface-traffic",
    _("Interface bytes"),
    _("Network"),
    ["network.interfaces"],
    (s, c) => {
      const row = selected(rows<NetworkRow>(s, "network.interfaces"), c);
      return { value: row ? `${formatBytes(row.rx)} ↓  ${formatBytes(row.tx)} ↑` : "–", detail: row ? `${row.name} · ${_("Cumulative counters")}` : undefined };
    },
    { interface: true },
  );
  metric("network.wan-status", _("WAN status"), _("Network"), ["network.wan"], (s) => {
    const wan = s.get("network.wan")?.data as { wan4: NetworkRow[]; wan6: NetworkRow[] };
    const row = [...wan.wan4, ...wan.wan6][0];
    return { value: row ? (row.up ? _("Online") : _("Offline")) : _("Not available"), detail: row?.addresses.join(", ") };
  });
  metric("network.interface-count", _("Active interfaces"), _("Network"), ["network.interfaces"], (s) => ({
    value: String(rows<NetworkRow>(s, "network.interfaces").filter((n) => n.up).length),
    detail: _("Connected network interfaces"),
  }));
  metric(
    "network.interface-uptime",
    _("Interface uptime"),
    _("Network"),
    ["network.interfaces"],
    (s, c) => {
      const row = selected(rows<NetworkRow>(s, "network.interfaces"), c);
      return { value: row?.up ? formatDuration(row.uptime) : _("Offline"), detail: row?.name };
    },
    { interface: true },
  );
  metric(
    "network.interface-gateway",
    _("Interface gateway"),
    _("Network"),
    ["network.interfaces"],
    (s, c) => {
      const row = selected(rows<NetworkRow>(s, "network.interfaces"), c);
      return { value: row?.gateway || _("Not available"), detail: row?.name };
    },
    { interface: true },
  );
  metric(
    "network.interface-protocol",
    _("Interface protocol"),
    _("Network"),
    ["network.interfaces"],
    (s, c) => {
      const row = selected(rows<NetworkRow>(s, "network.interfaces"), c);
      return { value: row?.protocol || _("Not available"), detail: row?.name };
    },
    { interface: true },
  );
  metric("wireless.radio-count", _("Active Wi-Fi networks"), _("Wireless"), ["wireless.radios"], (s) => ({ value: String(rows<WirelessRow>(s, "wireless.radios").filter((n) => n.up).length) }));
  metric("wireless.ssid-count", _("Broadcast SSIDs"), _("Wireless"), ["wireless.radios"], (s) => ({
    value: String(
      new Set(
        rows<WirelessRow>(s, "wireless.radios")
          .filter((n) => n.up && n.ssid)
          .map((n) => n.ssid),
      ).size,
    ),
  }));
  metric(
    "wireless.radio-status",
    _("Radio status"),
    _("Wireless"),
    ["wireless.radios"],
    (s, c) => {
      const radios = rows<WirelessRow>(s, "wireless.radios");
      const radio = radios.find((r) => r.radio === c.radio) ?? (c.radio ? undefined : radios[0]);
      return { value: radio ? (radio.up ? _("Online") : _("Offline")) : _("Not available"), detail: radio ? `${radio.radio} · ${radio.ssid}` : undefined };
    },
    { radio: true },
  );
  metric(
    "wireless.channel",
    _("Wi-Fi channel"),
    _("Wireless"),
    ["wireless.radios"],
    (s, c) => {
      const radios = rows<WirelessRow>(s, "wireless.radios");
      const radio = radios.find((r) => r.radio === c.radio) ?? (c.radio ? undefined : radios[0]);
      return { value: radio?.channel == null ? _("Not available") : String(radio.channel), detail: radio ? `${radio.radio} · ${radio.frequency}` : undefined };
    },
    { radio: true },
  );
  metric("wireless.client-count", _("Wireless client count"), _("Wireless"), ["wireless.clients"], (s) => ({ value: String(rows<ClientRow>(s, "wireless.clients").length) }));
  metric("wireless.average-signal", _("Average Wi-Fi signal"), _("Wireless"), ["wireless.clients"], (s) => {
    const signals = rows<ClientRow>(s, "wireless.clients")
      .map((n) => n.signal)
      .filter(Number.isFinite);
    return { value: signals.length ? `${Math.round(signals.reduce((a, b) => a + b, 0) / signals.length)} dBm` : _("No clients"), detail: `${signals.length} ${_("clients")}` };
  });
  metric("dhcp.lease-count", _("DHCP lease count"), _("Clients"), ["dhcp.leases"], (s) => ({ value: String(rows<LeaseRow>(s, "dhcp.leases").length) }));
  metric("dhcp.ipv6-count", _("IPv6 lease count"), _("Clients"), ["dhcp.leases"], (s) => ({ value: String(rows<LeaseRow>(s, "dhcp.leases").filter((n) => n.family === "IPv6").length) }));
  metric("dhcp.ipv4-count", _("IPv4 lease count"), _("Clients"), ["dhcp.leases"], (s) => ({ value: String(rows<LeaseRow>(s, "dhcp.leases").filter((n) => n.family === "IPv4").length) }));
  metric("wireless.strongest-signal", _("Strongest Wi-Fi signal"), _("Wireless"), ["wireless.clients"], (s) => {
    const clients = rows<ClientRow>(s, "wireless.clients").filter((n) => Number.isFinite(n.signal));
    const strongest = clients.reduce<ClientRow | undefined>((best, client) => (!best || client.signal > best.signal ? client : best), undefined);
    return { value: strongest ? `${strongest.signal} dBm` : _("No clients"), detail: strongest?.hostname || strongest?.mac };
  });
  registry.register({
    type: "network.traffic-trend",
    title: _("Live traffic trend"),
    description: _("Receive and transmit bytes per second"),
    category: _("Network"),
    icon: "",
    version: 1,
    defaultSize: "wide",
    supportedSizes: ["wide", "large", "xlarge", "full", "custom"],
    constraints: { ...DEFAULT_CONSTRAINTS, min: { w: 3, h: 2 } },
    defaultConfig: { interface: "", history: 40 },
    requiredData: ["network.interfaces"],
    validateConfig: (c) => typeof c.interface === "string" && c.interface.length <= 64 && Number.isInteger(c.history) && Number(c.history) >= 10 && Number(c.history) <= 120,
    createInstance: (ctx) => new TrafficWidget(ctx),
  });
}
