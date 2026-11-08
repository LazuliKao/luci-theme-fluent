import { DEFAULT_CONSTRAINTS } from "../core/tiles";
import type { WidgetConfig } from "../core/types";
import type { SourceState } from "../data/scheduler";
import {
  type ClientRow,
  type LeaseRow,
  type NetworkRow,
  normalizeSystemSnapshot,
  renderClients,
  renderInterfaces,
  renderInternet,
  renderLeases,
  renderResources,
  renderSystem,
  renderWireless,
  type WirelessRow,
} from "./cards";
import { reconcile } from "./dom";
import type { WidgetContext, WidgetInstance, WidgetRegistry } from "./registry";
import { filtered, validTableConfig } from "./table";

type States = Map<string, SourceState>;

/** A mounted instance owns subscriptions, never timers or RPC declarations. */
class LiveWidget implements WidgetInstance {
  private container?: HTMLElement;
  private subscriptions: Array<() => void> = [];
  private states: States = new Map();
  private visible = false;
  private config: WidgetConfig;
  constructor(
    private context: WidgetContext,
    private keys: string[],
    private render: (states: States, config: WidgetConfig) => HTMLElement,
  ) {
    this.config = context.config;
  }
  mount(container: HTMLElement): void {
    this.container = container;
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
    for (const off of this.subscriptions) off();
    this.subscriptions = [];
    if (visible)
      this.subscriptions = this.keys.map((key) =>
        this.context.data.subscribe(key, (state) => {
          this.states.set(key, state);
          this.paint();
        }),
      );
  }
  destroy(): void {
    this.setVisible(false);
    this.container = undefined;
    this.states.clear();
  }
  private paint(): void {
    if (!this.container || !this.visible) return;
    const states = this.keys.map((key) => this.states.get(key));
    const failure = states.find((s) => s?.status === "error");
    this.context.setStatus(
      failure ? (failure.stale ? _("Data is stale. Refresh to retry.") : _("Unable to load data. Refresh to retry.")) : states.some((s) => s?.data === undefined) ? _("Loading…") : "",
    );
    if (states.some((s) => s?.data === undefined)) return;
    const next = this.render(this.states, this.config);
    // Legacy card renderers only supply body content; the runtime owns the frame.
    const body = next.querySelector(".fluent-dashboard__card-content") ?? next;
    const shell = document.createElement("div");
    shell.className = this.container.className;
    for (const child of Array.from(body.childNodes)) shell.appendChild(child);
    reconcile(this.container, shell);
  }
}

export function registerBuiltins(registry: WidgetRegistry): void {
  const system = (states: States) => normalizeSystemSnapshot(states.get("system.board")?.data, states.get("system.info")?.data, states.get("system.version")?.data);
  const add = (type: string, title: string, category: string, keys: string[], render: (states: States, config: WidgetConfig) => HTMLElement) =>
    registry.register({
      type,
      title,
      description: title,
      category,
      icon: "",
      version: 1,
      supportedSizes: ["wide", "large", "xlarge", "full", "custom"],
      defaultSize: "xlarge",
      constraints: { ...DEFAULT_CONSTRAINTS, min: { w: 2, h: 4 } },
      defaultConfig: {},
      requiredData: keys,
      validateConfig: validTableConfig,
      createInstance: (context) => new LiveWidget(context, keys, render),
    });
  add("system.info", _("System"), _("System"), ["system.board", "system.info", "system.version"], (s) => renderSystem(system(s)));
  add("system.resources", _("Resources"), _("System"), ["system.info"], (s) => renderResources(system(s)));
  add("network.internet", _("Internet"), _("Network"), ["network.wan"], (s) => renderInternet(s.get("network.wan")?.data as { wan4: NetworkRow[]; wan6: NetworkRow[] }));
  add("network.interfaces", _("Interfaces"), _("Network"), ["network.interfaces"], (s, c) => renderInterfaces(filtered(s.get("network.interfaces")?.data as NetworkRow[], c)));
  add("wireless.radios", _("Wireless"), _("Wireless"), ["wireless.radios"], (s, c) => renderWireless(filtered(s.get("wireless.radios")?.data as WirelessRow[], c)));
  add("dhcp.leases", _("Active DHCP Leases"), _("Clients"), ["dhcp.leases"], (s, c) => renderLeases(filtered(s.get("dhcp.leases")?.data as LeaseRow[], c)));
  add("wireless.clients", _("Wireless Clients"), _("Clients"), ["wireless.clients"], (s, c) => renderClients(filtered(s.get("wireless.clients")?.data as ClientRow[], c)));
}
