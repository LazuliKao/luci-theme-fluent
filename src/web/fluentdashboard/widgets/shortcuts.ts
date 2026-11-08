import { DEFAULT_CONSTRAINTS } from "../core/tiles";
import type { WidgetConfig } from "../core/types";
import type { WidgetContext, WidgetInstance, WidgetRegistry } from "./registry";

/** Routes are fixed LuCI paths: imported documents cannot inject arbitrary links. */
const routes = [
  { id: "status", label: () => _("System status"), path: ["admin", "status", "overview"] },
  { id: "interfaces", label: () => _("Interfaces"), path: ["admin", "network", "network"] },
  { id: "wireless", label: () => _("Wireless"), path: ["admin", "network", "wireless"] },
  { id: "dhcp", label: () => _("DHCP and DNS"), path: ["admin", "network", "dhcp"] },
  { id: "firewall", label: () => _("Firewall"), path: ["admin", "network", "firewall"] },
  { id: "system", label: () => _("System settings"), path: ["admin", "system", "system"] },
] as const;

class ShortcutsWidget implements WidgetInstance {
  private container?: HTMLElement;
  private config: WidgetConfig;
  constructor(ctx: WidgetContext) {
    this.config = ctx.config;
  }
  mount(container: HTMLElement): void {
    this.container = container;
    this.paint();
  }
  updateConfig(config: WidgetConfig): void {
    this.config = config;
    this.paint();
  }
  resize(_width: number, _height: number): void {}
  setVisible(_visible: boolean): void {}
  destroy(): void {
    this.container = undefined;
  }
  private paint(): void {
    if (!this.container) return;
    const list = document.createElement("nav");
    list.className = "fluent-dashboard__shortcuts";
    for (const route of routes) {
      if (Array.isArray(this.config.links) && !this.config.links.includes(route.id)) continue;
      const link = document.createElement("a");
      link.href = L.url(...route.path);
      link.textContent = route.label();
      list.append(link);
    }
    this.container.replaceChildren(list);
  }
}

export function registerShortcuts(registry: WidgetRegistry): void {
  registry.register({
    type: "navigation.shortcuts",
    title: _("Quick links"),
    description: _("Open common LuCI pages"),
    category: _("Navigation"),
    icon: "",
    version: 1,
    defaultSize: "wide",
    supportedSizes: ["medium", "wide", "large", "xlarge", "full", "custom"],
    constraints: { ...DEFAULT_CONSTRAINTS, min: { w: 2, h: 2 } },
    defaultConfig: { links: routes.map((route) => route.id) },
    requiredData: [],
    validateConfig: (config) =>
      Array.isArray(config.links) &&
      config.links.length <= routes.length &&
      new Set(config.links).size === config.links.length &&
      config.links.every((id) => typeof id === "string" && routes.some((route) => route.id === id)),
    createInstance: (context) => new ShortcutsWidget(context),
  });
}
