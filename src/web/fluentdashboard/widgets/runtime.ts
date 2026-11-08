import type { WidgetNode } from "../core/types";
import type { DataService } from "../data/service";
import { WidgetFrame } from "./frame";
import type { WidgetInstance, WidgetRegistry } from "./registry";

interface Mounted {
  frame: WidgetFrame;
  instance?: WidgetInstance;
  type: string;
  version: number;
  config: string;
  observer: ResizeObserver;
}
export class WidgetRuntime {
  private mounted = new Map<string, Mounted>();
  constructor(
    private registry: WidgetRegistry,
    private data: DataService,
    private select: (id: string) => void,
  ) {}
  render(node: WidgetNode, editing: boolean): HTMLElement {
    const definition = this.registry.get(node.widgetType);
    let mounted = this.mounted.get(node.id);
    if (mounted && (mounted.type !== node.widgetType || mounted.version !== node.widgetVersion)) {
      this.remove(node.id);
      mounted = undefined;
    }
    if (!mounted) {
      const frame = new WidgetFrame(
        node,
        definition?.title ?? node.widgetType,
        () => {
          void this.data.refresh(definition?.requiredData ?? []);
        },
        () => this.select(node.id),
      );
      const observer = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) this.mounted.get(node.id)?.instance?.resize(rect.width, rect.height);
      });
      mounted = { frame, type: node.widgetType, version: node.widgetVersion, config: "", observer };
      this.mounted.set(node.id, mounted);
      observer.observe(frame.body);
      if (!definition) frame.setStatus(_("Widget extension unavailable. Configuration has been preserved."));
      else {
        try {
          const config =
            node.widgetVersion === definition.version
              ? node.config
              : node.widgetVersion < definition.version && definition.migrateConfig
                ? definition.migrateConfig(node.config, node.widgetVersion)
                : undefined;
          if (!config || !definition.validateConfig(config)) throw new Error(_("Unsupported widget configuration version."));
          mounted.instance = definition.createInstance({ data: this.data, config, setStatus: (message) => frame.setStatus(message) });
          mounted.instance.mount(frame.body);
          mounted.config = JSON.stringify(node.config);
        } catch (error) {
          mounted.instance?.destroy();
          mounted.instance = undefined;
          frame.setStatus(String(error));
        }
      }
    }
    const config = JSON.stringify(node.config);
    if (mounted.instance && config !== mounted.config) {
      const resolved =
        node.widgetVersion === definition?.version ? node.config : node.widgetVersion < (definition?.version ?? 0) ? definition?.migrateConfig?.(node.config, node.widgetVersion) : undefined;
      if (resolved && definition?.validateConfig(resolved)) {
        mounted.instance.updateConfig(resolved);
        mounted.config = config;
      } else mounted.frame.setStatus(_("Invalid widget configuration."));
    }
    mounted.frame.update(node, definition?.title ?? node.widgetType, editing);
    return mounted.frame.element;
  }
  retain(ids: ReadonlySet<string>, visible: ReadonlySet<string>): void {
    for (const [id, mounted] of this.mounted)
      if (!ids.has(id)) this.remove(id);
      else mounted.instance?.setVisible(visible.has(id));
  }
  destroy(): void {
    for (const id of this.mounted.keys()) this.remove(id);
  }
  private remove(id: string): void {
    const m = this.mounted.get(id);
    m?.observer.disconnect();
    m?.instance?.destroy();
    m?.frame.element.remove();
    this.mounted.delete(id);
  }
}
