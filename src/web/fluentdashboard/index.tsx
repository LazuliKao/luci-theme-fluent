import type { DashboardDocument } from "./core/types";
import { DataService } from "./data/service";
import { Workbench } from "./editor/workbench";
import { DashboardPersistence, type PersistenceReply } from "./persistence/uci";
import { registerBuiltins } from "./widgets/builtins";
import { registerSources } from "./widgets/cards";
import { registerMetrics } from "./widgets/metrics";
import { WidgetRegistry } from "./widgets/registry";
import { registerShortcuts } from "./widgets/shortcuts";

const loadLayout = rpc.declare<PersistenceReply>({ object: "luci.fluentdashboard", method: "load", reject: true });
const saveLayout = rpc.declare<PersistenceReply, [string, number]>({ object: "luci.fluentdashboard", method: "save", params: ["layout", "expectedRevision"], reject: true });
const canSave = rpc.declare<boolean, [string, string, string]>({ object: "session", method: "access", params: ["scope", "object", "function"], expect: { access: false } });

class mainImpl extends L.view {
  handleSave = null;
  handleSaveApply = null;
  handleReset = null;
  private workbench?: Workbench;
  private observer?: MutationObserver;
  private persistence?: DashboardPersistence;
  async load(): Promise<[DashboardDocument, boolean]> {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      /* Optional draft recovery. */
    }
    this.persistence = new DashboardPersistence({ load: loadLayout, save: saveLayout }, storage, `fluentdashboard.draft.v1:${location.host}`);
    return Promise.all([this.persistence.load(), canSave("ubus", "luci.fluentdashboard", "save").catch(() => false)]);
  }
  render([document, writable]: [DashboardDocument, boolean]): HTMLElement {
    if (!window.document.getElementById("fluent-dashboard-styles"))
      window.document.head.appendChild(<link id="fluent-dashboard-styles" rel="stylesheet" href={L.resource("view/fluentdashboard/index.css")} />);
    this.workbench?.destroy();
    this.observer?.disconnect();
    const data = new DataService();
    registerSources(data);
    data.observeVisibility(window.document);
    const registry = new WidgetRegistry();
    registerBuiltins(registry);
    registerMetrics(registry);
    registerShortcuts(registry);
    this.workbench = new Workbench(document, registry, data, this.persistence as DashboardPersistence, writable);
    const root = this.workbench.root;
    let connected = false;
    this.observer = new MutationObserver(() => {
      if (root.isConnected) connected = true;
      else if (connected) {
        this.workbench?.destroy();
        this.observer?.disconnect();
      }
    });
    this.observer.observe(window.document.body, { childList: true, subtree: true });
    return root;
  }
}
export const main = mainImpl;
