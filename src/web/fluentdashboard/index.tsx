import { formatBytes, formatDuration, formatLoad, formatLocalTime, normalizeSystemSnapshot, type StorageSnapshot, type SystemSnapshot, usedPercent } from "./model";

interface NetworkRow {
  name: string;
  protocol: string;
  up: boolean;
  addresses: string[];
  gateway: string;
  uptime: number;
  device: string;
  rx: number;
  tx: number;
}

interface WirelessRow {
  radio: string;
  hardware: string;
  up: boolean;
  ssid: string;
  mode: string;
  channel: number | null;
  frequency: string;
  encryption: string;
}

interface SummarySnapshot {
  system: SystemSnapshot;
  wan4: NetworkRow[];
  wan6: NetworkRow[];
  interfaces: NetworkRow[];
  wireless: WirelessRow[];
  updatedAt: Date;
}

interface LeaseRow {
  family: string;
  hostname: string;
  address: string;
  identifier: string;
  expires: number | false;
}

interface ClientRow {
  network: string;
  hostname: string;
  mac: string;
  signal: number;
  noise: number | null;
  rxRate: number;
  txRate: number;
}

interface DetailSnapshot {
  leases: LeaseRow[];
  clients: ClientRow[];
}

type UnknownRecord = Record<string, unknown>;

const callSystemBoard = rpc.declare<unknown>({ object: "system", method: "board" });
const callSystemInfo = rpc.declare<unknown>({ object: "system", method: "info" });
const callLuciVersion = rpc.declare<unknown>({ object: "luci", method: "getVersion" });
const callDHCPLeases = rpc.declare<unknown>({ object: "luci-rpc", method: "getDHCPLeases", expect: { "": {} } });

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function summarizeNetwork(item: LuCI.network.Protocol, ipv6 = false): NetworkRow {
  const device = item.getL3Device() ?? item.getDevice();
  return {
    name: item.getName(),
    protocol: item.getI18n(),
    up: item.isUp(),
    addresses: ipv6 ? item.getIP6Addrs() : item.getIPAddrs(),
    gateway: ipv6 ? item.getGateway6Addr() : item.getGatewayAddr(),
    uptime: item.getUptime(),
    device: device?.getName() ?? "",
    rx: device?.getRXBytes() ?? 0,
    tx: device?.getTXBytes() ?? 0,
  };
}

async function loadSummary(): Promise<SummarySnapshot> {
  await withFallback(network.flushCache(), {});
  const [board, info, version, wan4, wan6, interfaces, radios, wifiNetworks] = await Promise.all([
    withFallback(callSystemBoard(), {}),
    withFallback(callSystemInfo(), {}),
    withFallback(callLuciVersion(), {}),
    withFallback(network.getWANNetworks(), []),
    withFallback(network.getWAN6Networks(), []),
    withFallback(network.getNetworks(), []),
    withFallback(network.getWifiDevices(), []),
    withFallback(network.getWifiNetworks(), []),
  ]);

  const wireless = wifiNetworks.map((wifi) => {
    const radio = radios.find((candidate) => candidate.getName() === wifi.getWifiDeviceName());
    return {
      radio: radio?.getName() ?? wifi.getWifiDeviceName() ?? "",
      hardware: radio?.getI18n() ?? "",
      up: wifi.isUp() && !(radio?.isDisabled() ?? false),
      ssid: wifi.getActiveSSID() || wifi.getSSID() || wifi.getMeshID() || "",
      mode: wifi.getActiveModeI18n() || wifi.getMode(),
      channel: wifi.getChannel(),
      frequency: wifi.getFrequency() ?? "",
      encryption: wifi.getActiveEncryption(),
    } satisfies WirelessRow;
  });

  for (const radio of radios) {
    if (!wireless.some((item) => item.radio === radio.getName())) {
      wireless.push({
        radio: radio.getName(),
        hardware: radio.getI18n(),
        up: radio.isUp() && !radio.isDisabled(),
        ssid: "",
        mode: "",
        channel: null,
        frequency: "",
        encryption: "",
      });
    }
  }

  return {
    system: normalizeSystemSnapshot(board, info, version),
    wan4: wan4.map((item) => summarizeNetwork(item)),
    wan6: wan6.map((item) => summarizeNetwork(item, true)),
    interfaces: interfaces.filter((item) => item.getName() !== "loopback").map((item) => summarizeNetwork(item)),
    wireless,
    updatedAt: new Date(),
  };
}

function normalizeLeases(value: unknown): LeaseRow[] {
  const data = asRecord(value);
  const leases: LeaseRow[] = [];

  if (Array.isArray(data.dhcp_leases)) {
    for (const item of data.dhcp_leases) {
      const lease = asRecord(item);
      leases.push({
        family: "IPv4",
        hostname: asString(lease.hostname),
        address: asString(lease.ipaddr),
        identifier: asString(lease.macaddr),
        expires: lease.expires === false ? false : asNumber(lease.expires),
      });
    }
  }

  if (Array.isArray(data.dhcp6_leases)) {
    for (const item of data.dhcp6_leases) {
      const lease = asRecord(item);
      const addresses = Array.isArray(lease.ip6addrs) ? lease.ip6addrs.filter((address): address is string => typeof address === "string") : [];
      leases.push({
        family: "IPv6",
        hostname: asString(lease.hostname),
        address: addresses.join(", ") || asString(lease.ip6addr),
        identifier: asString(lease.duid),
        expires: lease.expires === false ? false : asNumber(lease.expires),
      });
    }
  }

  return leases;
}

async function loadDetails(): Promise<DetailSnapshot> {
  const [leaseData, wifiNetworks, hostHints] = await Promise.all([withFallback(callDHCPLeases(), {}), withFallback(network.getWifiNetworks(), []), withFallback(network.getHostHints(), null)]);
  const clientGroups = await Promise.all(wifiNetworks.map(async (wifi) => ({ wifi, peers: await withFallback(wifi.getAssocList(), []) })));
  const clients: ClientRow[] = [];

  for (const { wifi, peers } of clientGroups) {
    for (const peer of peers) {
      const hostname = hostHints?.getHostnameByMACAddr(peer.mac) || hostHints?.getIPAddrByMACAddr(peer.mac) || hostHints?.getIP6AddrByMACAddr(peer.mac) || "";
      clients.push({
        network: wifi.getActiveSSID() || wifi.getSSID() || wifi.getName(),
        hostname,
        mac: peer.mac,
        signal: peer.signal,
        noise: peer.noise ?? null,
        rxRate: peer.rx?.rate ?? 0,
        txRate: peer.tx?.rate ?? 0,
      });
    }
  }

  return { leases: normalizeLeases(leaseData), clients };
}

function valueOrDash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function statusPill(up: boolean): HTMLElement {
  return E("span", { class: `fluent-dashboard__status fluent-dashboard__status--${up ? "up" : "down"}` }, up ? _("Online") : _("Offline"));
}

function definitionList(rows: Array<[string, string | number | Node]>): HTMLElement {
  return E(
    "dl",
    { class: "fluent-dashboard__details" },
    rows.flatMap(([label, value]) => [E("dt", {}, label), E("dd", {}, value instanceof Node ? value : valueOrDash(value))]),
  );
}

function card(name: string, title: string, content: Node | Node[], wide = false): HTMLElement {
  return E("section", { class: `fluent-dashboard__card${wide ? " fluent-dashboard__card--wide" : ""}`, "data-dashboard-section": name }, [
    E("h2", { class: "fluent-dashboard__card-title" }, title),
    E("div", { class: "fluent-dashboard__card-content" }, content),
  ]);
}

function renderTable(headers: string[], rows: Array<Array<string | number | Node>>, emptyMessage: string): HTMLElement {
  const body = rows.length
    ? rows.map((row) =>
        E(
          "tr",
          {},
          row.map((cell) => E("td", {}, cell instanceof Node ? cell : valueOrDash(cell))),
        ),
      )
    : [E("tr", {}, E("td", { class: "fluent-dashboard__empty", colspan: headers.length }, emptyMessage))];

  return E(
    "div",
    { class: "fluent-dashboard__table-wrap" },
    E("table", { class: "fluent-dashboard__table" }, [
      E(
        "thead",
        {},
        E(
          "tr",
          {},
          headers.map((header) => E("th", {}, header)),
        ),
      ),
      E("tbody", {}, body),
    ]),
  );
}

function resourceMeter(label: string, storage: StorageSnapshot): HTMLElement {
  const used = Math.max(0, storage.total - storage.free);
  const percent = usedPercent(storage);
  return E("div", { class: "fluent-dashboard__meter" }, [
    E("div", { class: "fluent-dashboard__meter-label" }, [E("span", {}, label), E("span", {}, `${formatBytes(used)} / ${formatBytes(storage.total)}`)]),
    E(
      "div",
      { class: "fluent-dashboard__meter-track", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(percent) },
      E("span", { class: "fluent-dashboard__meter-value", style: `width:${percent.toFixed(1)}%` }),
    ),
  ]);
}

function renderSystem(system: SystemSnapshot): HTMLElement {
  return card(
    "system",
    _("System"),
    definitionList([
      [_("Hostname"), system.hostname],
      [_("Model"), system.model],
      [_("Architecture"), system.architecture],
      [_("Target Platform"), system.target],
      [_("Firmware Version"), system.firmware],
      [_("Kernel Version"), system.kernel],
      [_("LuCI Version"), system.luciVersion],
      [_("Local Time"), formatLocalTime(system.localtime)],
      [_("Uptime"), formatDuration(system.uptime)],
      [_("Load Average"), formatLoad(system.load)],
    ]),
  );
}

function renderResources(system: SystemSnapshot): HTMLElement {
  const meters = [
    [_("Memory"), system.memory],
    [_("Swap"), system.swap],
    [_("Root storage"), system.root],
    [_("Temporary storage"), system.tmp],
  ] as Array<[string, StorageSnapshot]>;
  return card(
    "resources",
    _("Resources"),
    meters.map(([label, storage]) => resourceMeter(label, storage)),
  );
}

function renderInternet(summary: SummarySnapshot): HTMLElement {
  const rows = [...summary.wan4.map((item) => ["IPv4", item]), ...summary.wan6.map((item) => ["IPv6", item])] as Array<[string, NetworkRow]>;
  return card(
    "internet",
    _("Internet"),
    renderTable(
      [_("Family"), _("Interface"), _("Status"), _("Protocol"), _("Address"), _("Gateway"), _("Uptime")],
      rows.map(([family, item]) => [family, item.name, statusPill(item.up), item.protocol, item.addresses.join(", "), item.gateway, formatDuration(item.uptime)]),
      _("No Internet connection information is available."),
    ),
    true,
  );
}

function renderInterfaces(interfaces: NetworkRow[]): HTMLElement {
  return card(
    "interfaces",
    _("Interfaces"),
    renderTable(
      [_("Interface"), _("Device"), _("Status"), _("Address"), _("Received"), _("Transmitted")],
      interfaces.map((item) => [item.name, item.device, statusPill(item.up), item.addresses.join(", "), formatBytes(item.rx), formatBytes(item.tx)]),
      _("No network interfaces were found."),
    ),
    true,
  );
}

function renderWireless(items: WirelessRow[]): HTMLElement {
  return card(
    "wireless",
    _("Wireless"),
    renderTable(
      [_("Radio"), _("SSID"), _("Status"), _("Mode"), _("Channel"), _("Encryption")],
      items.map((item) => [
        E("span", { title: item.hardware }, valueOrDash(item.radio)),
        item.ssid,
        statusPill(item.up),
        item.mode,
        item.channel === null ? "-" : item.frequency ? `${item.channel} (${item.frequency} GHz)` : item.channel,
        item.encryption,
      ]),
      _("No wireless radios were found."),
    ),
    true,
  );
}

function formatExpiry(expires: number | false): string {
  if (expires === false) return _("Unlimited");
  if (expires <= 0) return _("Expired");
  return formatDuration(expires);
}

function renderLeases(leases: LeaseRow[]): HTMLElement {
  return card(
    "leases",
    _("Active DHCP Leases"),
    renderTable(
      [_("Family"), _("Hostname"), _("Address"), _("MAC / DUID"), _("Expires")],
      leases.map((lease) => [lease.family, lease.hostname, lease.address, lease.identifier, formatExpiry(lease.expires)]),
      _("There are no active DHCP leases."),
    ),
    true,
  );
}

function formatRate(rate: number): string {
  return rate > 0 ? `${(rate / 1000).toFixed(1)} ${_("Mbit/s")}` : "-";
}

function renderClients(clients: ClientRow[]): HTMLElement {
  return card(
    "clients",
    _("Wireless Clients"),
    renderTable(
      [_("Network"), _("Host"), _("MAC address"), _("Signal"), _("RX / TX Rate")],
      clients.map((client) => [
        client.network,
        client.hostname,
        client.mac,
        client.noise === null ? `${client.signal} dBm` : `${client.signal} / ${client.noise} dBm`,
        `${formatRate(client.rxRate)} / ${formatRate(client.txRate)}`,
      ]),
      _("No wireless clients are connected."),
    ),
    true,
  );
}

function ensureStylesheet(): void {
  if (document.getElementById("fluent-dashboard-styles")) return;
  document.head.appendChild(E("link", { id: "fluent-dashboard-styles", rel: "stylesheet", href: L.resource("view/fluentdashboard/index.css") }));
}

class mainImpl extends L.view {
  handleSave = null;
  handleSaveApply = null;
  handleReset = null;
  private root: HTMLElement | null = null;

  load(): Promise<[SummarySnapshot, DetailSnapshot]> {
    return Promise.all([loadSummary(), loadDetails()]);
  }

  private replaceSection(name: string, section: HTMLElement): void {
    this.root?.querySelector(`[data-dashboard-section="${name}"]`)?.replaceWith(section);
  }

  private async refreshSummary(): Promise<void> {
    if (!this.root?.isConnected) return;
    const summary = await loadSummary();
    if (!this.root?.isConnected) return;
    this.replaceSection("system", renderSystem(summary.system));
    this.replaceSection("resources", renderResources(summary.system));
    this.replaceSection("internet", renderInternet(summary));
    this.replaceSection("interfaces", renderInterfaces(summary.interfaces));
    this.replaceSection("wireless", renderWireless(summary.wireless));
    const updated = this.root.querySelector("[data-dashboard-updated]");
    if (updated) updated.textContent = summary.updatedAt.toLocaleTimeString();
  }

  private async refreshDetails(): Promise<void> {
    if (!this.root?.isConnected) return;
    const details = await loadDetails();
    if (!this.root?.isConnected) return;
    this.replaceSection("leases", renderLeases(details.leases));
    this.replaceSection("clients", renderClients(details.clients));
  }

  render([summary, details]: [SummarySnapshot, DetailSnapshot]): HTMLElement {
    ensureStylesheet();
    this.root = E("div", { class: "fluent-dashboard" }, [
      E("header", { class: "fluent-dashboard__header" }, [
        E("div", {}, [E("h1", {}, _("Fluent Dashboard")), E("p", {}, _("A live overview of this OpenWrt device."))]),
        E("p", { class: "fluent-dashboard__updated" }, [_("Updated"), " ", E("time", { "data-dashboard-updated": "" }, summary.updatedAt.toLocaleTimeString())]),
      ]),
      E("div", { class: "fluent-dashboard__grid" }, [
        renderSystem(summary.system),
        renderResources(summary.system),
        renderInternet(summary),
        renderInterfaces(summary.interfaces),
        renderWireless(summary.wireless),
        renderLeases(details.leases),
        renderClients(details.clients),
      ]),
    ]);
    poll.add(() => this.refreshSummary(), 5);
    poll.add(() => this.refreshDetails(), 15);
    return this.root;
  }
}

export const main = mainImpl;
