import { DEFAULT_CONSTRAINTS } from "../core/tiles";
import type { WidgetConfig } from "../core/types";
import type { SourceState } from "../data/scheduler";
import {
  type ClientRow,
  type LeaseRow,
  type MountRow,
  type NetworkRow,
  normalizeSystemSnapshot,
  type PortStatusRow,
  renderClients,
  renderInterfaces,
  renderInternet,
  renderLeases,
  renderMounts,
  renderPorts,
  renderResources,
  renderSystem,
  renderWireless,
  type TelemetrySnapshot,
  type WirelessRow,
} from "./cards";
import { reconcile } from "./dom";
import type { ConfigField, WidgetContext, WidgetInstance, WidgetRegistry } from "./registry";
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

function tableConfigFields(sortColumns: Array<{ value: string; label: string }>): ConfigField[] {
  return [
    { key: "query", label: _("Filter text"), type: "text", placeholder: _("Search rows…") },
    { key: "limit", label: _("Maximum rows"), type: "number", min: 1, max: 1000 },
    {
      key: "sortBy",
      label: _("Sort field"),
      type: "select",
      options: [{ value: "", label: _("Default order") }, ...sortColumns],
    },
    { key: "descending", label: _("Descending"), type: "boolean" },
  ];
}

export function registerBuiltins(registry: WidgetRegistry): void {
  const system = (states: States) => normalizeSystemSnapshot(states.get("system.board")?.data, states.get("system.info")?.data, states.get("system.version")?.data);
  const add = (
    type: string,
    title: string,
    description: string,
    category: string,
    icon: string,
    keys: string[],
    render: (states: States, config: WidgetConfig) => HTMLElement,
    configFields?: ConfigField[],
  ) =>
    registry.register({
      type,
      title,
      description,
      category,
      icon,
      version: 1,
      supportedSizes: ["wide", "large", "xlarge", "full", "custom"],
      defaultSize: "xlarge",
      constraints: { ...DEFAULT_CONSTRAINTS, min: { w: 2, h: 4 } },
      defaultConfig: {},
      requiredData: keys,
      configFields,
      validateConfig: validTableConfig,
      createInstance: (context) => new LiveWidget(context, keys, render),
    });
  add("system.info", _("System"), _("Hardware model, firmware, kernel, uptime, and load overview"), _("System"), "system", ["system.board", "system.info", "system.version"], (s) =>
    renderSystem(system(s)),
  );
  add("system.resources", _("Resources"), _("Memory, swap, root, and temporary storage utilization bars"), _("System"), "gauge", ["system.info"], (s) => renderResources(system(s)));
  add("network.internet", _("Internet"), _("IPv4 and IPv6 WAN upstream connectivity and gateways"), _("Network"), "globe", ["network.wan"], (s) =>
    renderInternet(s.get("network.wan")?.data as { wan4: NetworkRow[]; wan6: NetworkRow[] }),
  );
  add(
    "network.interfaces",
    _("Interfaces"),
    _("All network interfaces, devices, addresses, and traffic counters"),
    _("Network"),
    "ethernet",
    ["network.interfaces"],
    (s, c) => renderInterfaces(filtered(s.get("network.interfaces")?.data as NetworkRow[], c)),
    tableConfigFields([
      { value: "name", label: _("Interface") },
      { value: "device", label: _("Device") },
      { value: "protocol", label: _("Protocol") },
      { value: "rx", label: _("Received") },
      { value: "tx", label: _("Transmitted") },
      { value: "uptime", label: _("Uptime") },
    ]),
  );
  add(
    "wireless.radios",
    _("Wireless"),
    _("Wi-Fi radios, SSIDs, operating modes, channels, and encryption"),
    _("Wireless"),
    "wifi",
    ["wireless.radios"],
    (s, c) => renderWireless(filtered(s.get("wireless.radios")?.data as WirelessRow[], c)),
    tableConfigFields([
      { value: "radio", label: _("Radio") },
      { value: "ssid", label: _("SSID") },
      { value: "mode", label: _("Mode") },
      { value: "channel", label: _("Channel") },
      { value: "encryption", label: _("Encryption") },
    ]),
  );
  add(
    "dhcp.leases",
    _("Active DHCP Leases"),
    _("Connected DHCPv4 and DHCPv6 client leases and expiry times"),
    _("Clients"),
    "devices",
    ["dhcp.leases"],
    (s, c) => renderLeases(filtered(s.get("dhcp.leases")?.data as LeaseRow[], c)),
    tableConfigFields([
      { value: "hostname", label: _("Hostname") },
      { value: "address", label: _("Address") },
      { value: "family", label: _("Family") },
      { value: "identifier", label: _("MAC / DUID") },
      { value: "expires", label: _("Expires") },
    ]),
  );
  add(
    "wireless.clients",
    _("Wireless Clients"),
    _("Associated Wi-Fi stations, signal strength, and PHY rates"),
    _("Clients"),
    "clients",
    ["wireless.clients"],
    (s, c) => renderClients(filtered(s.get("wireless.clients")?.data as ClientRow[], c)),
    tableConfigFields([
      { value: "hostname", label: _("Host") },
      { value: "network", label: _("Network") },
      { value: "mac", label: _("MAC address") },
      { value: "signal", label: _("Signal") },
      { value: "rxRate", label: _("RX Rate") },
      { value: "txRate", label: _("TX Rate") },
    ]),
  );
  add(
    "network.port-status",
    _("Ethernet Port Status"),
    _("Physical network device carrier status, link speed, and duplex"),
    _("Network"),
    "port",
    ["system.telemetry"],
    (s, c) => renderPorts(filtered(((s.get("system.telemetry")?.data as TelemetrySnapshot | undefined)?.ports ?? []) as PortStatusRow[], c)),
    tableConfigFields([
      { value: "device", label: _("Port") },
      { value: "speed", label: _("Speed") },
      { value: "duplex", label: _("Duplex") },
    ]),
  );
  add(
    "system.mounts",
    _("Disk Mount Points"),
    _("Filesystem mount points, capacity, used percentage, and free space"),
    _("Resources"),
    "storage",
    ["system.mounts"],
    (s, c) => renderMounts(filtered((s.get("system.mounts")?.data as MountRow[] | undefined) ?? [], c)),
    tableConfigFields([
      { value: "mount", label: _("Mount Point") },
      { value: "device", label: _("Device") },
      { value: "percent", label: _("Used %") },
      { value: "size", label: _("Total") },
    ]),
  );
}
