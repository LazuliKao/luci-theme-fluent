import type { DataService } from "../data/service";
import { formatBytes, formatDuration, formatLoad, formatLocalTime, normalizeSystemSnapshot, type StorageSnapshot, type SystemSnapshot, usedPercent } from "../model";

export interface NetworkRow {
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

export interface WirelessRow {
  radio: string;
  hardware: string;
  up: boolean;
  ssid: string;
  mode: string;
  channel: number | null;
  frequency: string;
  encryption: string;
}

export interface SummarySnapshot {
  system: SystemSnapshot;
  wan4: NetworkRow[];
  wan6: NetworkRow[];
  interfaces: NetworkRow[];
  wireless: WirelessRow[];
  updatedAt: Date;
}

export interface LeaseRow {
  family: string;
  hostname: string;
  address: string;
  identifier: string;
  expires: number | false;
}

export interface ClientRow {
  network: string;
  hostname: string;
  mac: string;
  signal: number;
  noise: number | null;
  rxRate: number;
  txRate: number;
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

async function loadRadios(): Promise<WirelessRow[]> {
  const [radios, wifiNetworks] = await Promise.all([network.getWifiDevices(), network.getWifiNetworks()]);
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

  return wireless;
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

async function loadClients(): Promise<ClientRow[]> {
  const [wifiNetworks, hostHints] = await Promise.all([network.getWifiNetworks(), network.getHostHints()]);
  const clientGroups = await Promise.all(wifiNetworks.map(async (wifi) => ({ wifi, peers: await wifi.getAssocList() })));
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

  return clients;
}

/** All widgets share these sources; cache invalidation happens once per network batch. */
export function registerSources(data: DataService): void {
  data.register({ key: "system.board", interval: 60000, load: callSystemBoard });
  data.register({ key: "system.info", interval: 3000, load: callSystemInfo });
  data.register({ key: "system.version", interval: 60000, load: callLuciVersion });
  data.register({ key: "dhcp.leases", interval: 15000, load: async () => normalizeLeases(await callDHCPLeases()) });
  let cacheFlight: Promise<unknown> | undefined;
  let cacheTime = 0;
  const fresh = async () => {
    if (!cacheFlight && Date.now() - cacheTime > 1000) {
      cacheFlight = network
        .flushCache()
        .then((v) => {
          cacheTime = Date.now();
          return v;
        })
        .finally(() => {
          cacheFlight = undefined;
        });
    }
    await cacheFlight;
  };
  data.register({
    key: "network.interfaces",
    interval: 3000,
    load: async () => {
      await fresh();
      return (await network.getNetworks()).filter((n) => n.getName() !== "loopback").map((n) => summarizeNetwork(n));
    },
  });
  data.register({
    key: "network.wan",
    interval: 10000,
    load: async () => {
      await fresh();
      const [v4, v6] = await Promise.all([network.getWANNetworks(), network.getWAN6Networks()]);
      return { wan4: v4.map((n) => summarizeNetwork(n)), wan6: v6.map((n) => summarizeNetwork(n, true)) };
    },
  });
  data.register({
    key: "wireless.radios",
    interval: 15000,
    load: async () => {
      await fresh();
      return loadRadios();
    },
  });
  data.register({
    key: "wireless.clients",
    interval: 10000,
    load: async () => {
      await fresh();
      return loadClients();
    },
  });
  data.register({ key: "network.hostHints", interval: 60000, load: () => network.getHostHints() });
}

export { normalizeSystemSnapshot };

function valueOrDash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function statusPill(up: boolean): HTMLElement {
  return <span class={`fluent-dashboard__status fluent-dashboard__status--${up ? "up" : "down"}`}>{up ? _("Online") : _("Offline")}</span>;
}

function definitionList(rows: Array<[string, string | number | Node]>): HTMLElement {
  return (
    <div class="fluent-dashboard__details">
      {rows.flatMap(([label, value]) => [
        <div class="fluent-dashboard__details-label">{label}</div>,
        <div class="fluent-dashboard__details-value">{value instanceof Node ? value : valueOrDash(value)}</div>,
      ])}
    </div>
  );
}

function card(name: string, title: string, content: Node | Node[], wide = false): HTMLElement {
  return (
    <div class={`fluent-dashboard__card${wide ? " fluent-dashboard__card--wide" : ""}`} data-dashboard-section={name}>
      <h2 class="fluent-dashboard__card-title">{title}</h2>
      <div class="fluent-dashboard__card-content">{content}</div>
    </div>
  );
}

function renderTable(headers: string[], rows: Array<Array<string | number | Node>>, emptyMessage: string): HTMLElement {
  return (
    <div class="fluent-dashboard__table-wrap">
      <table class="fluent-dashboard__table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr>
                {row.map((cell) => (
                  <td>{cell instanceof Node ? cell : valueOrDash(cell)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td class="fluent-dashboard__empty" colSpan={headers.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function resourceMeter(label: string, storage: StorageSnapshot): HTMLElement {
  const used = Math.max(0, storage.total - storage.free);
  const percent = usedPercent(storage);
  return (
    <div class="fluent-dashboard__meter">
      <div class="fluent-dashboard__meter-label">
        <span>{label}</span>
        <span>{`${formatBytes(used)} / ${formatBytes(storage.total)}`}</span>
      </div>
      <div class="fluent-dashboard__meter-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
        <span class="fluent-dashboard__meter-value" style={`width:${percent.toFixed(1)}%`}></span>
      </div>
    </div>
  );
}

export function renderSystem(system: SystemSnapshot): HTMLElement {
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

export function renderResources(system: SystemSnapshot): HTMLElement {
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

export function renderInternet(summary: Pick<SummarySnapshot, "wan4" | "wan6">): HTMLElement {
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

export function renderInterfaces(interfaces: NetworkRow[]): HTMLElement {
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

export function renderWireless(items: WirelessRow[]): HTMLElement {
  return card(
    "wireless",
    _("Wireless"),
    renderTable(
      [_("Radio"), _("SSID"), _("Status"), _("Mode"), _("Channel"), _("Encryption")],
      items.map((item) => [
        <span title={item.hardware}>{valueOrDash(item.radio)}</span>,
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

export function renderLeases(leases: LeaseRow[]): HTMLElement {
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

export function renderClients(clients: ClientRow[]): HTMLElement {
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
