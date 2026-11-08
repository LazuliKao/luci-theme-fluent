import {
  AddNodeCommand,
  BatchCommand,
  type Command,
  DissolveGroupCommand,
  EditCommand,
  MoveNodeCommand,
  RemoveNodeCommand,
  ResizeNodeCommand,
  ToggleCollapseCommand,
  ToggleHideCommand,
  ToggleLockCommand,
  UpdateConfigCommand,
} from "../core/commands";
import { createId } from "../core/ids";
import { createDefaultDocument, migrateDocument } from "../core/schema";
import { DashboardStore } from "../core/store";
import { allowedPresets, presetDimensions } from "../core/tiles";
import { ancestorsOf, indexNodes } from "../core/tree";
import type { DashboardDocument, DashboardNode, WidgetNode } from "../core/types";
import type { DataService } from "../data/service";
import { GridstackAdapter } from "../layout/gridstack-adapter";
import { observeColumns } from "../layout/responsive";
import type { DashboardPersistence } from "../persistence/uci";
import type { WidgetRegistry } from "../widgets/registry";
import { WidgetRuntime } from "../widgets/runtime";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}
function button(label: string, action: () => void, disabled = false): HTMLButtonElement {
  const b = element("button", "cbi-button", label);
  b.type = "button";
  b.disabled = disabled;
  b.addEventListener("click", action);
  return b;
}
function input(label: string, value: string, type = "text"): [HTMLLabelElement, HTMLInputElement] {
  const field = element("label", "fluent-dashboard__field", label),
    control = element("input");
  control.type = type;
  control.value = value;
  field.append(control);
  return [field, control];
}

export class Workbench {
  readonly root = element("div", "fluent-dashboard");
  readonly store: DashboardStore;
  private toolbar = element("fieldset", "fluent-dashboard__toolbar");
  private message = element("p", "fluent-dashboard__notice");
  private workspace = element("div", "fluent-dashboard__workspace");
  private library = element("fieldset", "fluent-dashboard__library");
  private canvas = element("div", "fluent-dashboard__canvas");
  private properties = element("fieldset", "fluent-dashboard__properties");
  private adapter = new GridstackAdapter();
  private runtime: WidgetRuntime;
  private groups = new Map<string, HTMLElement>();
  private off: Array<() => void> = [];
  private columns: 12 | 6 | 2 = 12;
  private mountedDashboard = "";
  private busy = false;
  private paused = false;
  private destroyed = false;
  constructor(
    document: DashboardDocument,
    private registry: WidgetRegistry,
    private data: DataService,
    private persistence: DashboardPersistence,
    private writable: boolean,
  ) {
    this.store = new DashboardStore(document);
    this.runtime = new WidgetRuntime(registry, data, (id) => this.select(id));
    this.message.setAttribute("role", "status");
    this.workspace.append(this.library, this.canvas, this.properties);
    this.root.append(element("h1", "", _("Fluent Dashboard")), this.toolbar, this.message, this.workspace);
    this.off.push(this.store.subscribe(() => this.render()));
    this.off.push(
      observeColumns(this.canvas, (columns) => {
        this.columns = columns;
        this.renderLayout();
      }),
    );
    const keydown = (event: KeyboardEvent) => this.onKey(event);
    this.root.addEventListener("keydown", keydown);
    this.off.push(() => this.root.removeEventListener("keydown", keydown));
    const unload = (event: BeforeUnloadEvent) => {
      if (this.store.history.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    this.off.push(() => window.removeEventListener("beforeunload", unload));
    this.render();
  }
  private report(error: unknown): void {
    this.message.textContent = error instanceof Error ? error.message : String(error);
  }
  private command(command: Command): void {
    if (this.busy) return;
    try {
      this.store.execute(command);
    } catch (error) {
      this.report(error);
      this.renderLayout();
    }
  }
  private select(id: string): void {
    if (!this.store.isEditing || this.busy) return;
    if (this.store.selection.has(id)) this.store.selection.delete(id);
    else this.store.selection.add(id);
    this.store.emit();
  }
  private render(): void {
    if (this.destroyed) return;
    if (this.store.history.dirty && this.writable && !this.persistence.cacheDraft(this.store.document))
      this.message.textContent = _("Browser draft storage is unavailable. Export your changes before leaving.");
    this.toolbar.replaceChildren();
    const selector = element("select");
    selector.setAttribute("aria-label", _("Dashboard"));
    for (const d of this.store.document.dashboards) {
      const option = element("option", "", d.name);
      option.value = d.id;
      option.selected = d.id === this.store.activeDashboard.id;
      selector.append(option);
    }
    selector.addEventListener("change", () => this.store.switchDashboard(selector.value));
    this.toolbar.append(
      selector,
      button(this.paused ? _("Resume") : _("Pause"), () => {
        this.paused = !this.paused;
        this.data.pause("manual", this.paused);
        this.render();
      }),
      button(_("Export"), () => this.exportDocument(this.store.document)),
    );
    if (this.store.isEditing) {
      const preview = element("select");
      preview.setAttribute("aria-label", _("Preview width"));
      for (const [value, label] of [
        ["0", _("Automatic width")],
        ["12", _("Desktop")],
        ["6", _("Tablet")],
        ["2", _("Phone")],
      ]) {
        const option = element("option", "", label);
        option.value = value;
        preview.append(option);
      }
      preview.value = String(this.store.previewColumns ?? 0);
      preview.addEventListener("change", () => {
        this.store.previewColumns = (Number(preview.value) as 12 | 6 | 2) || null;
        this.renderLayout();
      });
      this.toolbar.append(
        button(_("Undo"), () => this.store.undo(), !this.store.history.canUndo),
        button(_("Redo"), () => this.store.redo(), !this.store.history.canRedo),
        preview,
        button(
          _("Save"),
          () => {
            void this.save();
          },
          !this.store.history.dirty,
        ),
        button(_("Cancel"), () => {
          this.persistence.clearDraft();
          this.store.cancel();
        }),
        button(_("New dashboard"), () => {
          const id = createId("dashboard");
          this.command(
            new EditCommand("New dashboard", (doc) => {
              doc.dashboards.push({ id, name: _("New dashboard"), nodes: [] });
            }),
          );
          if (this.store.document.dashboards.some((d) => d.id === id)) this.store.switchDashboard(id);
        }),
        button(_("Duplicate dashboard"), () => this.duplicateDashboard()),
        button(_("Import"), () => this.importDocument()),
        button(_("Restore defaults"), () => this.replaceDocument(createDefaultDocument())),
      );
    } else if (this.writable) this.toolbar.append(button(_("Edit"), () => this.store.edit()));
    const draft = this.persistence.readDraft();
    if (draft && !this.store.isEditing && this.writable)
      this.toolbar.append(
        button(_("Restore draft"), () => {
          if (draft.revision !== this.store.document.revision) {
            this.report(_("This draft belongs to an older revision. It has been exported so you can review it before importing."));
            this.exportDocument(draft);
            return;
          }
          this.store.edit();
          this.replaceDocument(draft);
        }),
      );
    this.library.hidden = this.properties.hidden = !this.store.isEditing;
    this.workspace.classList.toggle("fluent-dashboard__workspace--editing", this.store.isEditing);
    this.renderLibrary();
    this.renderProperties();
    this.renderLayout();
    this.setBusy(this.busy);
  }
  private renderLibrary(): void {
    this.library.replaceChildren(element("legend", "", _("Widget library")));
    for (const definition of this.registry.list())
      this.library.append(
        button(`${definition.category} · ${definition.title}`, () => {
          const dimensions = presetDimensions(definition.defaultSize, definition.constraints);
          const node: WidgetNode = {
            id: createId("widget"),
            parentId: null,
            kind: "widget",
            widgetType: definition.type,
            widgetVersion: definition.version,
            config: { ...definition.defaultConfig },
            tile: { ...dimensions, size: definition.defaultSize, x: 0, y: 0, order: this.store.activeDashboard.nodes.length },
          };
          this.command(new AddNodeCommand(this.store.activeDashboard.id, node));
        }),
      );
    this.library.append(
      button(_("Add group"), () =>
        this.command(
          new AddNodeCommand(this.store.activeDashboard.id, {
            kind: "group",
            id: createId("group"),
            title: _("Group"),
            parentId: null,
            tile: { x: 0, y: 0, w: 12, h: 8, order: this.store.activeDashboard.nodes.length, size: "full" },
          }),
        ),
      ),
    );
  }
  private renderProperties(): void {
    const dashboard = this.store.activeDashboard;
    this.properties.replaceChildren(element("legend", "", _("Properties")));
    const [nameLabel, name] = input(_("Dashboard name"), dashboard.name);
    this.properties.append(
      nameLabel,
      button(_("Rename"), () =>
        this.command(
          new EditCommand("Rename dashboard", (doc) => {
            const d = doc.dashboards.find((d) => d.id === dashboard.id);
            if (d) d.name = name.value;
          }),
        ),
      ),
      button(_("Set as default"), () =>
        this.command(
          new EditCommand("Default dashboard", (doc) => {
            doc.defaultDashboardId = dashboard.id;
          }),
        ),
      ),
      button(
        _("Delete dashboard"),
        () =>
          this.command(
            new EditCommand("Delete dashboard", (doc) => {
              doc.dashboards = doc.dashboards.filter((d) => d.id !== dashboard.id);
              if (doc.defaultDashboardId === dashboard.id) doc.defaultDashboardId = doc.dashboards[0]?.id;
            }),
          ),
        this.store.document.dashboards.length <= 1,
      ),
    );
    const selected = dashboard.nodes.filter((n) => this.store.selection.has(n.id));
    if (!selected.length) {
      this.properties.append(element("p", "", _("Select tile headers to edit one or more tiles.")));
      return;
    }
    const roots = selected.filter((n) => !ancestorsOf(indexNodes(dashboard.nodes), n.id).some((p) => this.store.selection.has(p.id)));
    const batch = (make: (id: string) => Command) => this.command(new BatchCommand(roots.map((n) => make(n.id))));
    this.properties.append(
      button(_("Lock / unlock"), () => batch((id) => new ToggleLockCommand(dashboard.id, id))),
      button(_("Show / hide"), () => batch((id) => new ToggleHideCommand(dashboard.id, id))),
      button(_("Remove selected and contents"), () => batch((id) => new RemoveNodeCommand(dashboard.id, id))),
    );
    const parent = element("select");
    parent.setAttribute("aria-label", _("Move to group"));
    const root = element("option", "", _("Root"));
    root.value = "";
    parent.append(root);
    for (const group of dashboard.nodes.filter((n) => n.kind === "group")) {
      const option = element("option", "", group.title);
      option.value = group.id;
      parent.append(option);
    }
    this.properties.append(
      parent,
      button(_("Move to group"), () =>
        this.command(
          new MoveNodeCommand(
            dashboard.id,
            roots.map((n) => ({ id: n.id, parentId: parent.value || null, ...n.tile, x: 0, y: 0 })),
          ),
        ),
      ),
    );
    if (selected.length !== 1) return;
    const node = selected[0];
    const [titleLabel, title] = input(_("Title"), node.title ?? "");
    title.maxLength = 256;
    this.properties.append(titleLabel);
    if (node.kind === "widget") {
      const definition = this.registry.get(node.widgetType);
      const fields: Array<[key: string, control: HTMLInputElement]> = [];
      if (definition?.type === "network.traffic-trend" || definition?.type.startsWith("network.interface-")) {
        const [label, control] = input(_("Interface name (empty: first)"), String(node.config.interface ?? ""));
        this.properties.append(label);
        fields.push(["interface", control]);
      }
      if (definition?.type === "wireless.radio-status" || definition?.type === "wireless.channel") {
        const [label, control] = input(_("Radio name (empty: first)"), String(node.config.radio ?? ""));
        this.properties.append(label);
        fields.push(["radio", control]);
      }
      if (definition?.type === "network.traffic-trend") {
        const [label, control] = input(_("History samples (10–120)"), String(node.config.history ?? 40), "number");
        control.min = "10";
        control.max = "120";
        this.properties.append(label);
        fields.push(["history", control]);
      }
      if (["network.interfaces", "wireless.radios", "dhcp.leases", "wireless.clients"].includes(node.widgetType)) {
        const [queryLabel, query] = input(_("Filter text"), String(node.config.query ?? ""));
        const [limitLabel, limit] = input(_("Maximum rows"), String(node.config.limit ?? 200), "number");
        limit.min = "1";
        limit.max = "1000";
        const [sortLabel, sort] = input(_("Sort field (for example: name, signal, expires)"), String(node.config.sortBy ?? ""));
        const [descendingLabel, descending] = input(_("Descending"), "", "checkbox");
        descending.checked = Boolean(node.config.descending);
        this.properties.append(queryLabel, limitLabel, sortLabel, descendingLabel);
        fields.push(["query", query], ["limit", limit], ["sortBy", sort], ["descending", descending]);
      }
      if (node.widgetType === "navigation.shortcuts") {
        const [label, control] = input(_("Quick links (status, interfaces, wireless, dhcp, firewall, system)"), Array.isArray(node.config.links) ? node.config.links.join(", ") : "");
        this.properties.append(label);
        fields.push(["links", control]);
      }
      this.properties.append(
        button(_("Apply properties"), () => {
          const config = { ...node.config };
          for (const [key, control] of fields)
            config[key] =
              key === "links"
                ? control.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                : control.type === "checkbox"
                  ? control.checked
                  : control.type === "number"
                    ? Number(control.value)
                    : control.value;
          if (!this.registry.get(node.widgetType)?.validateConfig(config)) {
            this.report(_("Invalid widget configuration."));
            return;
          }
          this.command(new UpdateConfigCommand(dashboard.id, node.id, config, title.value));
        }),
      );
      if (definition)
        for (const size of allowedPresets(definition.constraints))
          this.properties.append(
            button(size, () => {
              const { w, h } = presetDimensions(size, definition.constraints);
              this.command(new ResizeNodeCommand(dashboard.id, node.id, w, h));
            }),
          );
    } else {
      const [descriptionLabel, description] = input(_("Description"), node.description ?? "");
      description.maxLength = 2048;
      this.properties.append(
        descriptionLabel,
        button(_("Apply group properties"), () =>
          this.command(
            new EditCommand("Configure group", (doc) => {
              const n = doc.dashboards.find((d) => d.id === dashboard.id)?.nodes.find((n) => n.id === node.id);
              if (n?.kind === "group" && !n.locked) {
                n.title = title.value;
                n.description = description.value;
              }
            }),
          ),
        ),
        button(_("Default collapsed / expanded"), () => this.command(new ToggleCollapseCommand(dashboard.id, node.id))),
        button(_("Dissolve and keep contents"), () => this.command(new DissolveGroupCommand(dashboard.id, node.id))),
      );
    }
    this.properties.append(
      button(_("Earlier"), () => this.reorder(node, -1)),
      button(_("Later"), () => this.reorder(node, 1)),
      button(_("Duplicate tile"), () => this.duplicateNode(node)),
    );
  }
  private renderLayout(): void {
    if (this.destroyed) return;
    const dashboard = this.store.activeDashboard;
    if (dashboard.id !== this.mountedDashboard) {
      this.adapter.destroy();
      this.runtime.destroy();
      this.groups.clear();
      this.adapter = new GridstackAdapter();
      this.adapter.mount(this.canvas, {
        render: (node) => this.renderNode(node),
        collapsed: () => (this.store.isEditing ? new Set() : this.store.collapsed),
        visible: (visible) => this.runtime.retain(new Set(this.store.activeDashboard.nodes.filter((n) => n.kind === "widget").map((n) => n.id)), visible),
      });
      this.adapter.onChange((placements) => this.command(new MoveNodeCommand(this.store.activeDashboard.id, placements)));
      this.mountedDashboard = dashboard.id;
    }
    this.adapter.setEditing(this.store.isEditing && !this.busy);
    this.adapter.apply(dashboard.nodes, this.store.previewColumns ?? this.columns);
    for (const [id, group] of this.groups)
      if (!dashboard.nodes.some((n) => n.id === id)) {
        group.remove();
        this.groups.delete(id);
      }
    for (const el of this.canvas.querySelectorAll<HTMLElement>("[data-node-id]")) el.classList.toggle("fluent-dashboard__tile--selected", this.store.selection.has(el.dataset.nodeId ?? ""));
  }
  private renderNode(node: DashboardNode): HTMLElement {
    if (node.kind === "widget") return this.runtime.render(node, this.store.isEditing);
    let group = this.groups.get(node.id);
    if (!group) {
      group = element("section", "fluent-dashboard__group");
      const header = element("header", "fluent-dashboard__card-header");
      header.tabIndex = 0;
      header.append(element("h2", "fluent-dashboard__card-title"));
      header.append(
        button(_("Collapse / expand"), () => {
          if (this.store.isEditing) this.command(new ToggleCollapseCommand(this.store.activeDashboard.id, node.id));
          else {
            if (this.store.collapsed.has(node.id)) this.store.collapsed.delete(node.id);
            else this.store.collapsed.add(node.id);
            this.renderLayout();
          }
        }),
      );
      header.addEventListener("click", (event) => {
        if (!(event.target instanceof HTMLButtonElement)) this.select(node.id);
      });
      header.addEventListener("keydown", (event) => {
        if (event.target === header && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          this.select(node.id);
        }
      });
      group.append(header, element("div", "fluent-dashboard__group-body"));
      this.groups.set(node.id, group);
    }
    const heading = group.querySelector("h2");
    if (heading) heading.textContent = node.title;
    let description = group.querySelector<HTMLElement>(".fluent-dashboard__group-description");
    if (node.description) {
      if (!description) {
        description = element("p", "fluent-dashboard__group-description");
        group.querySelector(".fluent-dashboard__card-header")?.after(description);
      }
      description.textContent = node.description;
    } else description?.remove();
    return group;
  }
  private reorder(node: DashboardNode, delta: number): void {
    this.command(
      new EditCommand("Reorder tile", (doc) => {
        const d = doc.dashboards.find((d) => d.id === this.store.activeDashboard.id);
        if (!d || node.locked) return;
        const siblings = d.nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.tile.order - b.tile.order);
        const index = siblings.findIndex((n) => n.id === node.id),
          target = index + delta;
        if (target < 0 || target >= siblings.length || siblings[target].locked) return;
        [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
        siblings.forEach((n, i) => {
          n.tile.order = i;
        });
      }),
    );
  }
  private duplicateNode(node: DashboardNode): void {
    this.command(
      new EditCommand("Duplicate tile", (doc) => {
        const d = doc.dashboards.find((d) => d.id === this.store.activeDashboard.id);
        if (!d) return;
        const tree = indexNodes(d.nodes),
          originals = d.nodes.filter((n) => n.id === node.id || ancestorsOf(tree, n.id).some((p) => p.id === node.id));
        const ids = new Map(originals.map((n) => [n.id, createId(n.kind)]));
        const bottom = Math.max(0, ...d.nodes.filter((n) => n.parentId === node.parentId).map((n) => n.tile.y + n.tile.h));
        for (const original of originals) {
          const copy = JSON.parse(JSON.stringify(original)) as DashboardNode;
          copy.id = ids.get(original.id) as string;
          copy.parentId = original.parentId ? (ids.get(original.parentId) ?? original.parentId) : null;
          if (original.id === node.id) {
            copy.tile.y = bottom;
            copy.tile.order = d.nodes.length;
          }
          d.nodes.push(copy);
        }
      }),
    );
  }
  private duplicateDashboard(): void {
    const id = createId("dashboard");
    this.command(
      new EditCommand("Duplicate dashboard", (doc) => {
        const copy = JSON.parse(JSON.stringify(this.store.activeDashboard));
        copy.id = id;
        copy.name = `${copy.name} (${_("Copy")})`;
        doc.dashboards.push(copy);
      }),
    );
    if (this.store.document.dashboards.some((d) => d.id === id)) this.store.switchDashboard(id);
  }
  private replaceDocument(document: DashboardDocument): void {
    this.command(
      new EditCommand("Replace layout", (doc) => {
        const imported = migrateDocument(document);
        imported.revision = doc.revision;
        Object.assign(doc, imported);
      }),
    );
  }
  private exportDocument(document: DashboardDocument): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const link = element("a");
    link.href = url;
    link.download = "fluentdashboard.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private importDocument(): void {
    const file = element("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (!selected) return;
      if (selected.size > 262144) {
        this.report(_("Layout file is too large."));
        return;
      }
      void selected
        .text()
        .then((text) => {
          if (!this.destroyed) this.replaceDocument(migrateDocument(JSON.parse(text)));
        })
        .catch((e: unknown) => this.report(e));
    });
    file.click();
  }
  private async save(): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    this.adapter.setEditing(false);
    try {
      const saved = await this.persistence.save(this.store.document);
      if (!this.destroyed) {
        this.store.saved(saved);
        this.message.textContent = _("Shared layout saved.");
      }
    } catch (error) {
      if (!this.destroyed) this.report(error);
    } finally {
      if (!this.destroyed) {
        this.setBusy(false);
        this.renderLayout();
      }
    }
  }
  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.toolbar.disabled = this.library.disabled = this.properties.disabled = busy;
  }
  private onKey(event: KeyboardEvent): void {
    if (!this.store.isEditing || this.busy || (event.target instanceof Element && event.target.closest("input, textarea, select"))) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.store.redo();
      else this.store.undo();
    }
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!delta[event.key] || !this.store.selection.size) return;
    event.preventDefault();
    const [dx, dy] = delta[event.key];
    const tree = indexNodes(this.store.activeDashboard.nodes);
    const nodes = this.store.activeDashboard.nodes.filter((n) => this.store.selection.has(n.id) && !ancestorsOf(tree, n.id).some((p) => this.store.selection.has(p.id)));
    if ((this.store.previewColumns ?? this.columns) !== 12) {
      if (nodes.length === 1) this.reorder(nodes[0], dx || dy);
      return;
    }
    this.command(
      new MoveNodeCommand(
        this.store.activeDashboard.id,
        nodes.map((n) => ({
          id: n.id,
          parentId: n.parentId,
          x: n.tile.x + (event.shiftKey ? 0 : dx),
          y: n.tile.y + (event.shiftKey ? 0 : dy),
          w: n.tile.w + (event.shiftKey ? dx : 0),
          h: n.tile.h + (event.shiftKey ? dy : 0),
        })),
      ),
    );
  }
  destroy(): void {
    this.destroyed = true;
    for (const off of this.off) off();
    this.adapter.destroy();
    this.runtime.destroy();
    this.data.destroy();
  }
}
