import {
  AddNodeCommand,
  BatchCommand,
  type Command,
  DissolveGroupCommand,
  DuplicateDashboardCommand,
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
import { ancestorsOf, childrenOf, depthOf, descendantsOf, groupLevels, indexNodes, isSelfOrAncestor } from "../core/tree";
import type { DashboardDocument, DashboardNode, GroupNode, TileSize, WidgetConfig, WidgetNode } from "../core/types";
import type { DataService } from "../data/service";
import { findFreeSpot } from "../layout/engine";
import { GridstackAdapter } from "../layout/gridstack-adapter";
import { observeColumns } from "../layout/responsive";
import type { DashboardPersistence } from "../persistence/uci";
import type { NetworkRow, WirelessRow } from "../widgets/cards";
import type { ConfigField, SelectOption, WidgetDefinition, WidgetRegistry } from "../widgets/registry";
import { WidgetRuntime } from "../widgets/runtime";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function button(label: string, action: () => void, disabled = false, variant = ""): HTMLButtonElement {
  const b = element("button", `cbi-button fluent-dashboard__btn${variant ? ` fluent-dashboard__btn--${variant}` : ""}`, label);
  b.type = "button";
  b.disabled = disabled;
  b.addEventListener("click", action);
  return b;
}

function fieldInput(label: string, value: string, type = "text", placeholder = ""): [HTMLLabelElement, HTMLInputElement] {
  const field = element("label", "fluent-dashboard__field");
  const title = element("span", "fluent-dashboard__field-label", label);
  const control = element("input", "fluent-dashboard__input");
  control.type = type;
  control.value = value;
  if (placeholder) control.placeholder = placeholder;
  field.append(title, control);
  return [field, control];
}

function sizeBadgeText(size: TileSize, w: number, h: number): string {
  const labels: Record<TileSize, string> = {
    small: "S",
    medium: "M",
    wide: "W",
    large: "L",
    xlarge: "XL",
    full: "Full",
    custom: `${w}×${h}`,
  };
  return `${labels[size] ?? size} (${w}×${h})`;
}

export class Workbench {
  readonly root = element("div", "fluent-dashboard");
  readonly store: DashboardStore;
  private topbar = element("header", "fluent-dashboard__topbar");
  private toolbar = element("fieldset", "fluent-dashboard__toolbar");
  private message = element("p", "fluent-dashboard__notice");
  private workspace = element("div", "fluent-dashboard__workspace");
  private library = element("fieldset", "fluent-dashboard__library");
  private libraryList = element("div", "fluent-dashboard__library-list");
  private canvas = element("div", "fluent-dashboard__canvas");
  private properties = element("fieldset", "fluent-dashboard__properties");
  private adapter = new GridstackAdapter();
  private runtime: WidgetRuntime;
  private groups = new Map<string, HTMLElement>();
  private off: Array<() => void> = [];
  private inspectorOff: Array<() => void> = [];
  private columns: 12 | 6 | 2 = 12;
  private mountedDashboard = "";
  private busy = false;
  private paused = false;
  private destroyed = false;
  private libraryFilter = "";
  private libraryCollapsed = false;
  private propertiesCollapsed = false;

  constructor(
    document: DashboardDocument,
    private registry: WidgetRegistry,
    private data: DataService,
    private persistence: DashboardPersistence,
    private writable: boolean,
  ) {
    this.store = new DashboardStore(document);
    this.runtime = new WidgetRuntime(registry, data, (id, multi) => this.select(id, multi));
    this.message.setAttribute("role", "status");
    this.workspace.append(this.library, this.canvas, this.properties);
    this.root.append(this.topbar, this.toolbar, this.message, this.workspace);
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
    this.buildLibraryShell();
    this.render();
  }

  private report(error: unknown): void {
    this.message.textContent = error instanceof Error ? error.message : String(error);
  }

  private command(command: Command): void {
    if (this.busy) return;
    try {
      this.message.textContent = "";
      this.store.execute(command);
    } catch (error) {
      this.report(error);
      this.renderLayout();
    }
  }

  private select(id: string, multi = false): void {
    if (!this.store.isEditing || this.busy) return;
    if (multi) {
      if (this.store.selection.has(id)) this.store.selection.delete(id);
      else this.store.selection.add(id);
    } else {
      if (this.store.selection.size === 1 && this.store.selection.has(id)) {
        this.store.selection.clear();
      } else {
        this.store.selection.clear();
        this.store.selection.add(id);
      }
    }
    this.store.emit();
  }

  private render(): void {
    if (this.destroyed) return;
    if (this.store.history.dirty && this.writable && !this.persistence.cacheDraft(this.store.document))
      this.message.textContent = _("Browser draft storage is unavailable. Export your changes before leaving.");

    this.renderTopbar();
    this.renderToolbar();

    const showLib = this.store.isEditing && !this.libraryCollapsed;
    const showProps = this.store.isEditing && !this.propertiesCollapsed;
    this.library.hidden = !showLib;
    this.properties.hidden = !showProps;
    this.workspace.classList.toggle("fluent-dashboard__workspace--editing", this.store.isEditing);
    this.workspace.classList.toggle("fluent-dashboard__workspace--no-library", !showLib);
    this.workspace.classList.toggle("fluent-dashboard__workspace--no-properties", !showProps);

    this.renderLibraryItems();
    this.renderProperties();
    this.renderLayout();
    this.setBusy(this.busy);
  }

  private renderTopbar(): void {
    this.topbar.replaceChildren();
    const brand = element("div", "fluent-dashboard__brand");
    const title = element("h1", "fluent-dashboard__title", _("Fluent Dashboard"));
    brand.append(title);

    const tabs = element("div", "fluent-dashboard__tabs");
    tabs.setAttribute("role", "tablist");
    for (const d of this.store.document.dashboards) {
      const tab = element("button", `fluent-dashboard__tab${d.id === this.store.activeDashboard.id ? " fluent-dashboard__tab--active" : ""}`, d.name);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(d.id === this.store.activeDashboard.id));
      tab.addEventListener("click", () => this.store.switchDashboard(d.id));
      tabs.append(tab);
    }
    brand.append(tabs);

    const actions = element("div", "fluent-dashboard__topbar-actions");
    actions.append(
      button(
        this.paused ? _("Resume") : _("Pause"),
        () => {
          this.paused = !this.paused;
          this.data.pause("manual", this.paused);
          this.render();
        },
        false,
        this.paused ? "warning" : "subtle",
      ),
      button(_("Export"), () => this.exportDocument(this.store.document), false, "subtle"),
    );

    const draft = this.persistence.readDraft();
    if (draft && !this.store.isEditing && this.writable) {
      actions.append(
        button(
          _("Restore draft"),
          () => {
            if (draft.revision !== this.store.document.revision) {
              this.report(_("This draft belongs to an older revision. It has been exported so you can review it before importing."));
              this.exportDocument(draft);
              return;
            }
            this.store.edit();
            this.replaceDocument(draft);
          },
          false,
          "subtle",
        ),
      );
    }

    if (!this.store.isEditing && this.writable) {
      actions.append(button(_("Edit"), () => this.store.edit(), false, "primary"));
    }

    this.topbar.append(brand, actions);
  }

  private renderToolbar(): void {
    this.toolbar.replaceChildren();
    this.toolbar.hidden = !this.store.isEditing;
    if (!this.store.isEditing) return;

    const leftGroup = element("div", "fluent-dashboard__toolbar-group");
    leftGroup.append(
      button(
        _("Widget library"),
        () => {
          this.libraryCollapsed = !this.libraryCollapsed;
          this.render();
        },
        false,
        this.libraryCollapsed ? "subtle" : "active",
      ),
    );

    const selector = element("select", "fluent-dashboard__select");
    selector.setAttribute("aria-label", _("Dashboard"));
    for (const d of this.store.document.dashboards) {
      const option = element("option", "", d.name);
      option.value = d.id;
      option.selected = d.id === this.store.activeDashboard.id;
      selector.append(option);
    }
    selector.addEventListener("change", () => this.store.switchDashboard(selector.value));
    leftGroup.append(
      selector,
      button(_("New dashboard"), () => {
        const id = createId("dashboard");
        this.command(
          new EditCommand("New dashboard", (doc) => {
            doc.dashboards.push({ id, name: `${_("Dashboard")} ${doc.dashboards.length + 1}`, nodes: [] });
          }),
        );
        if (this.store.document.dashboards.some((d) => d.id === id)) this.store.switchDashboard(id);
      }),
      button(_("Duplicate dashboard"), () => this.duplicateDashboard()),
    );

    const centerGroup = element("div", "fluent-dashboard__toolbar-group");
    const preview = element("select", "fluent-dashboard__select");
    preview.setAttribute("aria-label", _("Preview width"));
    for (const [value, label] of [
      ["0", _("Automatic width")],
      ["12", `${_("Desktop")} (12)`],
      ["6", `${_("Tablet")} (6)`],
      ["2", `${_("Phone")} (2)`],
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

    centerGroup.append(
      button(_("Undo"), () => this.store.undo(), !this.store.history.canUndo),
      button(_("Redo"), () => this.store.redo(), !this.store.history.canRedo),
      preview,
      button(_("Import"), () => this.importDocument()),
      button(_("Restore defaults"), () => this.replaceDocument(createDefaultDocument())),
    );

    const rightGroup = element("div", "fluent-dashboard__toolbar-group fluent-dashboard__toolbar-group--end");
    rightGroup.append(
      button(
        _("Properties"),
        () => {
          this.propertiesCollapsed = !this.propertiesCollapsed;
          this.render();
        },
        false,
        this.propertiesCollapsed ? "subtle" : "active",
      ),
      button(_("Cancel"), () => {
        this.persistence.clearDraft();
        this.store.cancel();
      }),
      button(
        _("Save"),
        () => {
          void this.save();
        },
        !this.store.history.dirty,
        "primary",
      ),
    );

    this.toolbar.append(leftGroup, centerGroup, rightGroup);
  }

  private buildLibraryShell(): void {
    this.library.replaceChildren();
    const header = element("div", "fluent-dashboard__panel-header");
    header.append(element("h2", "fluent-dashboard__panel-title", _("Widget library")));
    const searchWrap = element("div", "fluent-dashboard__library-search");
    const search = element("input", "fluent-dashboard__input");
    search.type = "search";
    search.placeholder = _("Filter widgets…");
    search.setAttribute("aria-label", _("Filter widgets…"));
    search.addEventListener("input", () => {
      this.libraryFilter = search.value.trim().toLowerCase();
      this.renderLibraryItems();
    });
    searchWrap.append(search);

    const addGroupBtn = button(`+ ${_("Add group")}`, () => this.addGroupNode(), false, "block");

    this.library.append(header, searchWrap, addGroupBtn, this.libraryList);
  }

  private addGroupNode(): void {
    const dashboard = this.store.activeDashboard;
    const tree = indexNodes(dashboard.nodes);
    let parentId: string | null = null;
    if (this.store.selection.size === 1) {
      const selId = [...this.store.selection][0];
      const selNode = tree.byId.get(selId);
      if (selNode?.kind === "group" && !selNode.locked && depthOf(tree, selNode.id) + 1 <= 2) {
        parentId = selNode.id;
      }
    }
    const parentNode = parentId ? tree.byId.get(parentId) : undefined;
    const cols = parentNode ? parentNode.tile.w : 12;
    const w = Math.min(12, cols);
    const h = 8;
    const siblings = childrenOf(tree, parentId).map((n) => ({ id: n.id, x: n.tile.x, y: n.tile.y, w: n.tile.w, h: n.tile.h }));
    const spot = findFreeSpot(siblings, w, h, cols);
    const id = createId("group");
    const group: GroupNode = {
      kind: "group",
      id,
      title: _("Group"),
      parentId,
      tile: { x: spot.x, y: spot.y, w, h, order: dashboard.nodes.length, size: w === 12 ? "full" : "xlarge" },
    };
    this.command(new AddNodeCommand(dashboard.id, group));
    this.select(id);
  }

  private addWidgetFromDefinition(definition: WidgetDefinition): void {
    const dashboard = this.store.activeDashboard;
    const tree = indexNodes(dashboard.nodes);
    const dimensions = presetDimensions(definition.defaultSize, definition.constraints);
    let parentId: string | null = null;
    if (this.store.selection.size === 1) {
      const selId = [...this.store.selection][0];
      const selNode = tree.byId.get(selId);
      if (selNode?.kind === "group" && !selNode.locked && dimensions.w <= selNode.tile.w) {
        parentId = selNode.id;
      } else if (selNode?.parentId) {
        const parentGroup = tree.byId.get(selNode.parentId);
        if (parentGroup?.kind === "group" && !parentGroup.locked && dimensions.w <= parentGroup.tile.w) {
          parentId = parentGroup.id;
        }
      }
    }
    const parentNode = parentId ? tree.byId.get(parentId) : undefined;
    const cols = parentNode ? parentNode.tile.w : 12;
    const siblings = childrenOf(tree, parentId).map((n) => ({ id: n.id, x: n.tile.x, y: n.tile.y, w: n.tile.w, h: n.tile.h }));
    const spot = findFreeSpot(siblings, dimensions.w, dimensions.h, cols);
    const id = createId("widget");
    const node: WidgetNode = {
      id,
      parentId,
      kind: "widget",
      widgetType: definition.type,
      widgetVersion: definition.version,
      config: JSON.parse(JSON.stringify(definition.defaultConfig)) as WidgetConfig,
      tile: { ...dimensions, size: definition.defaultSize, x: spot.x, y: spot.y, order: dashboard.nodes.length },
    };
    this.command(new AddNodeCommand(dashboard.id, node));
    this.select(id);
  }

  private renderLibraryItems(): void {
    this.libraryList.replaceChildren();
    const categories = new Map<string, WidgetDefinition[]>();
    for (const def of this.registry.list()) {
      if (this.libraryFilter) {
        const haystack = `${def.title} ${def.description} ${def.category} ${def.type}`.toLowerCase();
        if (!haystack.includes(this.libraryFilter)) continue;
      }
      const list = categories.get(def.category) ?? [];
      list.push(def);
      categories.set(def.category, list);
    }

    if (!categories.size) {
      this.libraryList.append(element("p", "fluent-dashboard__empty-hint", _("No matching widgets found.")));
      return;
    }

    for (const [category, definitions] of categories) {
      const details = element("details", "fluent-dashboard__category");
      details.open = true;
      const summary = element("summary", "fluent-dashboard__category-header");
      summary.append(element("span", "fluent-dashboard__category-name", category), element("span", "fluent-dashboard__badge fluent-dashboard__badge--count", String(definitions.length)));
      const items = element("div", "fluent-dashboard__category-items");
      for (const definition of definitions) {
        const dims = presetDimensions(definition.defaultSize, definition.constraints);
        const card = element("button", "fluent-dashboard__palette-item");
        card.type = "button";
        const top = element("div", "fluent-dashboard__palette-item-top");
        top.append(element("span", "fluent-dashboard__palette-item-title", definition.title), element("span", "fluent-dashboard__badge", sizeBadgeText(definition.defaultSize, dims.w, dims.h)));
        card.append(top);
        if (definition.description && definition.description !== definition.title) {
          card.append(element("span", "fluent-dashboard__palette-item-desc", definition.description));
        }
        card.addEventListener("click", () => this.addWidgetFromDefinition(definition));
        items.append(card);
      }
      details.append(summary, items);
      this.libraryList.append(details);
    }
  }

  private renderProperties(): void {
    for (const off of this.inspectorOff) off();
    this.inspectorOff = [];
    const dashboard = this.store.activeDashboard;
    this.properties.replaceChildren();

    const selected = dashboard.nodes.filter((n) => this.store.selection.has(n.id));
    const header = element("div", "fluent-dashboard__panel-header");
    const headerTitle =
      selected.length === 0
        ? _("Dashboard settings")
        : selected.length === 1
          ? selected[0].kind === "group"
            ? _("Group properties")
            : _("Widget properties")
          : `${_("Selected tiles")} (${selected.length})`;
    header.append(element("h2", "fluent-dashboard__panel-title", headerTitle));
    if (selected.length > 0) {
      header.append(
        button(
          _("Clear"),
          () => {
            this.store.selection.clear();
            this.store.emit();
          },
          false,
          "subtle",
        ),
      );
    }
    this.properties.append(header);

    if (selected.length === 0) {
      this.renderDashboardInspector(dashboard);
      return;
    }

    if (selected.length > 1) {
      this.renderBatchInspector(dashboard, selected);
      return;
    }

    const node = selected[0];
    if (node.kind === "group") {
      this.renderGroupInspector(dashboard, node);
    } else {
      this.renderWidgetInspector(dashboard, node);
    }
  }

  private renderDashboardInspector(dashboard: DashboardDocument["dashboards"][number]): void {
    const section = element("div", "fluent-dashboard__inspector-section");
    const [nameField, nameInput] = fieldInput(_("Dashboard name"), dashboard.name);
    nameInput.maxLength = 128;
    const applyRename = () => {
      const nextName = nameInput.value.trim();
      if (!nextName || nextName === dashboard.name) return;
      this.command(
        new EditCommand("Rename dashboard", (doc) => {
          const d = doc.dashboards.find((item) => item.id === dashboard.id);
          if (d) d.name = nextName;
        }),
      );
    };
    nameInput.addEventListener("change", applyRename);

    const isDefault = this.store.document.defaultDashboardId === dashboard.id;
    const actionsRow = element("div", "fluent-dashboard__button-row");
    actionsRow.append(
      button(_("Rename"), applyRename),
      button(
        isDefault ? _("Default dashboard") : _("Set as default"),
        () =>
          this.command(
            new EditCommand("Default dashboard", (doc) => {
              doc.defaultDashboardId = dashboard.id;
            }),
          ),
        isDefault,
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
        "danger",
      ),
    );
    section.append(nameField, actionsRow);

    const hintSection = element("div", "fluent-dashboard__inspector-section");
    hintSection.append(
      element("p", "fluent-dashboard__inspector-hint", _("Select tile headers to edit one or more tiles.")),
      button(`+ ${_("Add group")}`, () => this.addGroupNode(), false, "block"),
    );

    this.properties.append(section, hintSection);
  }

  private renderBatchInspector(dashboard: DashboardDocument["dashboards"][number], selected: DashboardNode[]): void {
    const tree = indexNodes(dashboard.nodes);
    const roots = selected.filter((n) => !ancestorsOf(tree, n.id).some((p) => this.store.selection.has(p.id)));
    const batch = (make: (id: string) => Command) => this.command(new BatchCommand(roots.map((n) => make(n.id))));

    const section = element("div", "fluent-dashboard__inspector-section");
    const row = element("div", "fluent-dashboard__button-row");
    row.append(
      button(_("Lock / unlock"), () => batch((id) => new ToggleLockCommand(dashboard.id, id))),
      button(_("Show / hide"), () => batch((id) => new ToggleHideCommand(dashboard.id, id))),
    );
    section.append(row);

    section.append(this.buildParentMoveControl(dashboard, roots));
    section.append(button(_("Remove selected and contents"), () => batch((id) => new RemoveNodeCommand(dashboard.id, id)), false, "danger"));
    this.properties.append(section);
  }

  private renderGroupInspector(dashboard: DashboardDocument["dashboards"][number], node: GroupNode): void {
    const infoSection = element("div", "fluent-dashboard__inspector-section");
    const [titleField, titleInput] = fieldInput(_("Title"), node.title);
    titleInput.maxLength = 256;
    titleInput.disabled = Boolean(node.locked);
    const [descField, descInput] = fieldInput(_("Description"), node.description ?? "", "text", _("Optional group subtitle…"));
    descInput.maxLength = 2048;
    descInput.disabled = Boolean(node.locked);

    const applyGroupMeta = () => {
      if (node.locked) return;
      const nextTitle = titleInput.value.trim() || _("Group");
      const nextDesc = descInput.value;
      if (nextTitle === node.title && nextDesc === (node.description ?? "")) return;
      this.command(
        new EditCommand("Configure group", (doc) => {
          const target = doc.dashboards.find((d) => d.id === dashboard.id)?.nodes.find((n) => n.id === node.id);
          if (target?.kind === "group" && !target.locked) {
            target.title = nextTitle;
            target.description = nextDesc || undefined;
          }
        }),
      );
    };
    titleInput.addEventListener("change", applyGroupMeta);
    descInput.addEventListener("change", applyGroupMeta);

    const collapseRow = element("label", "fluent-dashboard__checkbox-row");
    const collapseCheck = element("input");
    collapseCheck.type = "checkbox";
    collapseCheck.checked = Boolean(node.collapsed);
    collapseCheck.disabled = Boolean(node.locked);
    collapseCheck.addEventListener("change", () => this.command(new ToggleCollapseCommand(dashboard.id, node.id)));
    collapseRow.append(collapseCheck, element("span", "", _("Default collapsed / expanded")));

    infoSection.append(titleField, descField, collapseRow);

    const sizeSection = element("div", "fluent-dashboard__inspector-section");
    sizeSection.append(element("span", "fluent-dashboard__section-title", _("Group width")));
    const sizeBar = element("div", "fluent-dashboard__preset-bar");
    const lockedChildrenOverflowHalf = descendantsOf(indexNodes(dashboard.nodes), node.id).some((child) => child.locked && child.tile.x + child.tile.w > 6);
    for (const [w, label] of [
      [6, _("Half (6 col)")],
      [12, _("Full (12 col)")],
    ] as const) {
      const disabled = Boolean(node.locked) || (w === 6 && lockedChildrenOverflowHalf);
      const btn = button(label, () => this.command(new ResizeNodeCommand(dashboard.id, node.id, w, node.tile.h)), disabled, node.tile.w === w ? "active" : "");
      sizeBar.append(btn);
    }
    sizeSection.append(sizeBar);

    const manageSection = element("div", "fluent-dashboard__inspector-section");
    manageSection.append(element("span", "fluent-dashboard__section-title", _("Actions")));
    manageSection.append(this.buildParentMoveControl(dashboard, [node]));
    const orderRow = element("div", "fluent-dashboard__button-row");
    orderRow.append(
      button(_("Earlier"), () => this.reorder(node, -1), Boolean(node.locked)),
      button(_("Later"), () => this.reorder(node, 1), Boolean(node.locked)),
      button(_("Duplicate tile"), () => this.duplicateNode(node)),
    );
    const stateRow = element("div", "fluent-dashboard__button-row");
    stateRow.append(
      button(node.locked ? _("Unlock") : _("Lock / unlock"), () => this.command(new ToggleLockCommand(dashboard.id, node.id))),
      button(node.hidden ? _("Show") : _("Show / hide"), () => this.command(new ToggleHideCommand(dashboard.id, node.id)), Boolean(node.locked)),
    );
    const removeRow = element("div", "fluent-dashboard__button-row");
    removeRow.append(
      button(_("Dissolve and keep contents"), () => this.command(new DissolveGroupCommand(dashboard.id, node.id)), Boolean(node.locked)),
      button(_("Remove selected and contents"), () => this.command(new RemoveNodeCommand(dashboard.id, node.id)), Boolean(node.locked), "danger"),
    );
    manageSection.append(orderRow, stateRow, removeRow);

    this.properties.append(infoSection, sizeSection, manageSection);
  }

  private renderWidgetInspector(dashboard: DashboardDocument["dashboards"][number], node: WidgetNode): void {
    const definition = this.registry.get(node.widgetType);
    const metaBar = element("div", "fluent-dashboard__inspector-meta");
    metaBar.append(
      element("span", "fluent-dashboard__badge", definition ? `${definition.category} · ${definition.title}` : node.widgetType),
      element("span", "fluent-dashboard__badge fluent-dashboard__badge--muted", sizeBadgeText(node.tile.size, node.tile.w, node.tile.h)),
    );
    this.properties.append(metaBar);

    const appearanceSection = element("div", "fluent-dashboard__inspector-section");
    const [titleField, titleInput] = fieldInput(_("Title"), node.title ?? "", "text", definition?.title ?? node.widgetType);
    titleInput.maxLength = 256;
    titleInput.disabled = Boolean(node.locked);
    titleInput.addEventListener("change", () => {
      if (node.locked) return;
      const nextTitle = titleInput.value.trim();
      if (nextTitle === (node.title ?? "")) return;
      this.command(new UpdateConfigCommand(dashboard.id, node.id, node.config, nextTitle));
    });
    appearanceSection.append(titleField);

    if (definition) {
      appearanceSection.append(element("span", "fluent-dashboard__field-label", _("Tile size preset")));
      const presetBar = element("div", "fluent-dashboard__preset-bar");
      for (const size of allowedPresets(definition.constraints)) {
        const dims = presetDimensions(size, definition.constraints);
        presetBar.append(
          button(`${size} (${dims.w}×${dims.h})`, () => this.command(new ResizeNodeCommand(dashboard.id, node.id, dims.w, dims.h)), Boolean(node.locked), node.tile.size === size ? "active" : ""),
        );
      }
      appearanceSection.append(presetBar);
    }
    this.properties.append(appearanceSection);

    if (definition?.configFields?.length) {
      const configSection = element("div", "fluent-dashboard__inspector-section");
      configSection.append(element("span", "fluent-dashboard__section-title", _("Widget parameters")));
      for (const field of definition.configFields) {
        configSection.append(this.renderConfigField(dashboard.id, node, definition, field));
      }
      this.properties.append(configSection);
    }

    const manageSection = element("div", "fluent-dashboard__inspector-section");
    manageSection.append(element("span", "fluent-dashboard__section-title", _("Arrangement & actions")));
    manageSection.append(this.buildParentMoveControl(dashboard, [node]));
    const orderRow = element("div", "fluent-dashboard__button-row");
    orderRow.append(
      button(_("Earlier"), () => this.reorder(node, -1), Boolean(node.locked)),
      button(_("Later"), () => this.reorder(node, 1), Boolean(node.locked)),
      button(_("Duplicate tile"), () => this.duplicateNode(node)),
    );
    const stateRow = element("div", "fluent-dashboard__button-row");
    stateRow.append(
      button(node.locked ? _("Unlock") : _("Lock / unlock"), () => this.command(new ToggleLockCommand(dashboard.id, node.id))),
      button(node.hidden ? _("Show") : _("Show / hide"), () => this.command(new ToggleHideCommand(dashboard.id, node.id)), Boolean(node.locked)),
      button(_("Remove selected and contents"), () => this.command(new RemoveNodeCommand(dashboard.id, node.id)), Boolean(node.locked), "danger"),
    );
    manageSection.append(orderRow, stateRow);
    this.properties.append(manageSection);
  }

  private resolveDynamicOptions(source: "interfaces" | "radios", currentValue: string): SelectOption[] {
    if (source === "interfaces") {
      const rows = this.data.state<NetworkRow[]>("network.interfaces")?.data ?? [];
      const opts: SelectOption[] = [{ value: "", label: _("Automatic (first interface)") }];
      const seen = new Set<string>([""]);
      for (const row of rows) {
        if (!seen.has(row.name)) {
          seen.add(row.name);
          opts.push({ value: row.name, label: row.device ? `${row.name} (${row.device})` : row.name });
        }
      }
      if (currentValue && !seen.has(currentValue)) opts.push({ value: currentValue, label: currentValue });
      return opts;
    }
    const radios = this.data.state<WirelessRow[]>("wireless.radios")?.data ?? [];
    const opts: SelectOption[] = [{ value: "", label: _("Automatic (first radio)") }];
    const seen = new Set<string>([""]);
    for (const row of radios) {
      if (row.radio && !seen.has(row.radio)) {
        seen.add(row.radio);
        opts.push({ value: row.radio, label: row.ssid ? `${row.radio} (${row.ssid})` : row.radio });
      }
    }
    if (currentValue && !seen.has(currentValue)) opts.push({ value: currentValue, label: currentValue });
    return opts;
  }

  private renderConfigField(dashboardId: string, node: WidgetNode, definition: WidgetDefinition, field: ConfigField): HTMLElement {
    const applyValue = (nextValue: unknown) => {
      if (node.locked) return;
      const nextConfig: WidgetConfig = { ...node.config, [field.key]: nextValue };
      if (!definition.validateConfig(nextConfig)) {
        this.report(_("Invalid widget configuration."));
        return;
      }
      this.command(new UpdateConfigCommand(dashboardId, node.id, nextConfig, node.title));
    };

    if (field.type === "boolean") {
      const row = element("label", "fluent-dashboard__checkbox-row");
      const checkbox = element("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(node.config[field.key]);
      checkbox.disabled = Boolean(node.locked);
      checkbox.addEventListener("change", () => applyValue(checkbox.checked));
      row.append(checkbox, element("span", "", field.label));
      return row;
    }

    if (field.type === "select") {
      const wrap = element("label", "fluent-dashboard__field");
      wrap.append(element("span", "fluent-dashboard__field-label", field.label));
      const select = element("select", "fluent-dashboard__select");
      select.disabled = Boolean(node.locked);
      const current = String(node.config[field.key] ?? "");
      const populate = () => {
        const selectedVal = select.options.length ? select.value : current;
        const options = field.dynamicOptions ? this.resolveDynamicOptions(field.dynamicOptions, selectedVal) : (field.options ?? []);
        select.replaceChildren();
        for (const opt of options) {
          const optionEl = element("option", "", opt.label);
          optionEl.value = opt.value;
          optionEl.selected = opt.value === selectedVal;
          select.append(optionEl);
        }
      };
      populate();
      if (field.dynamicOptions) {
        const sourceKey = field.dynamicOptions === "interfaces" ? "network.interfaces" : "wireless.radios";
        this.inspectorOff.push(this.data.subscribe(sourceKey, () => populate()));
      }
      select.addEventListener("change", () => applyValue(select.value));
      wrap.append(select);
      return wrap;
    }

    if (field.type === "multiselect") {
      const wrap = element("div", "fluent-dashboard__field");
      wrap.append(element("span", "fluent-dashboard__field-label", field.label));
      const list = element("div", "fluent-dashboard__multiselect");
      const currentSet = new Set(Array.isArray(node.config[field.key]) ? (node.config[field.key] as string[]) : []);
      for (const opt of field.options ?? []) {
        const item = element("label", "fluent-dashboard__checkbox-row");
        const check = element("input");
        check.type = "checkbox";
        check.checked = currentSet.has(opt.value);
        check.disabled = Boolean(node.locked);
        check.addEventListener("change", () => {
          if (check.checked) currentSet.add(opt.value);
          else currentSet.delete(opt.value);
          applyValue([...currentSet]);
        });
        item.append(check, element("span", "", opt.label));
        list.append(item);
      }
      wrap.append(list);
      return wrap;
    }

    if (field.type === "number") {
      const current = String(node.config[field.key] ?? (field.key === "limit" ? 200 : (field.min ?? 10)));
      const [labelEl, inputEl] = fieldInput(field.label, current, "number");
      if (field.min !== undefined) inputEl.min = String(field.min);
      if (field.max !== undefined) inputEl.max = String(field.max);
      inputEl.disabled = Boolean(node.locked);
      inputEl.addEventListener("change", () => {
        let num = Number(inputEl.value);
        if (!Number.isFinite(num)) return;
        if (field.min !== undefined) num = Math.max(field.min, num);
        if (field.max !== undefined) num = Math.min(field.max, num);
        applyValue(Math.round(num));
      });
      return labelEl;
    }

    const current = String(node.config[field.key] ?? "");
    const [labelEl, inputEl] = fieldInput(field.label, current, "text", field.placeholder ?? "");
    inputEl.disabled = Boolean(node.locked);
    inputEl.addEventListener("change", () => applyValue(inputEl.value));
    return labelEl;
  }

  private buildParentMoveControl(dashboard: DashboardDocument["dashboards"][number], roots: DashboardNode[]): HTMLElement {
    const tree = indexNodes(dashboard.nodes);
    const wrap = element("label", "fluent-dashboard__field");
    wrap.append(element("span", "fluent-dashboard__field-label", _("Container group")));
    const select = element("select", "fluent-dashboard__select");
    select.setAttribute("aria-label", _("Move to group"));
    const rootOpt = element("option", "", _("Root canvas"));
    rootOpt.value = "";
    select.append(rootOpt);
    const currentParent = roots.length === 1 ? (roots[0].parentId ?? "") : "";
    for (const group of dashboard.nodes.filter((n): n is GroupNode => n.kind === "group")) {
      const invalidTarget = roots.some((r) => isSelfOrAncestor(tree, r.id, group.id) || depthOf(tree, group.id) + 1 + groupLevels(tree, r.id) > 2 || r.tile.w > group.tile.w);
      if (invalidTarget) continue;
      const option = element("option", "", group.title);
      option.value = group.id;
      option.selected = group.id === currentParent;
      select.append(option);
    }
    select.value = currentParent;
    select.disabled = roots.some((r) => Boolean(r.locked));
    select.addEventListener("change", () => {
      const targetParent = select.value || null;
      this.command(
        new MoveNodeCommand(
          dashboard.id,
          roots.map((n) => ({ id: n.id, parentId: targetParent, ...n.tile, x: 0, y: 0 })),
        ),
      );
    });
    wrap.append(select);
    return wrap;
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
        collapsed: () => this.store.collapsed,
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
      const header = element("header", "fluent-dashboard__card-header fluent-dashboard__group-header");
      header.tabIndex = 0;
      const titleWrap = element("div", "fluent-dashboard__group-title-wrap");
      titleWrap.append(element("h2", "fluent-dashboard__card-title"), element("div", "fluent-dashboard__card-badges"));
      const actions = element("div", "fluent-dashboard__card-actions");
      const collapseBtn = button(
        _("Collapse / expand"),
        () => {
          if (this.store.isEditing) {
            this.command(new ToggleCollapseCommand(this.store.activeDashboard.id, node.id));
          } else {
            if (this.store.collapsed.has(node.id)) this.store.collapsed.delete(node.id);
            else this.store.collapsed.add(node.id);
            this.renderLayout();
          }
        },
        false,
        "subtle",
      );
      collapseBtn.classList.add("fluent-dashboard__collapse-btn");
      actions.append(collapseBtn);
      header.append(titleWrap, actions);
      header.addEventListener("click", (event) => {
        if (!(event.target instanceof Element && event.target.closest("button"))) {
          this.select(node.id, event.shiftKey || event.ctrlKey || event.metaKey);
        }
      });
      header.addEventListener("keydown", (event) => {
        if (event.target === header && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          this.select(node.id, event.shiftKey || event.ctrlKey || event.metaKey);
        }
      });
      group.append(header, element("div", "fluent-dashboard__group-body"));
      this.groups.set(node.id, group);
    }
    const heading = group.querySelector("h2");
    if (heading) heading.textContent = node.title;
    const isCollapsed = this.store.collapsed.has(node.id);
    group.classList.toggle("fluent-dashboard__group--collapsed", isCollapsed);
    group.classList.toggle("fluent-dashboard__card--locked", Boolean(node.locked));
    group.classList.toggle("fluent-dashboard__card--hidden", Boolean(node.hidden));
    const collapseBtn = group.querySelector<HTMLButtonElement>(".fluent-dashboard__collapse-btn");
    if (collapseBtn) collapseBtn.textContent = isCollapsed ? _("Expand") : _("Collapse");
    const badges = group.querySelector<HTMLElement>(".fluent-dashboard__card-badges");
    if (badges) {
      badges.replaceChildren();
      if (this.store.isEditing && node.locked) badges.append(element("span", "fluent-dashboard__badge", _("Locked")));
      if (this.store.isEditing && node.hidden) badges.append(element("span", "fluent-dashboard__badge fluent-dashboard__badge--muted", _("Hidden")));
    }
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
        const d = doc.dashboards.find((item) => item.id === this.store.activeDashboard.id);
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
        const d = doc.dashboards.find((item) => item.id === this.store.activeDashboard.id);
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
    const name = `${this.store.activeDashboard.name} (${_("Copy")})`;
    this.command(new DuplicateDashboardCommand(this.store.activeDashboard.id, id, name));
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
        this.persistence.clearDraft();
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
      return;
    }
    if (event.key === "Escape" && this.store.selection.size > 0) {
      event.preventDefault();
      this.store.selection.clear();
      this.store.emit();
      return;
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
          x: Math.max(0, n.tile.x + (event.shiftKey ? 0 : dx)),
          y: Math.max(0, n.tile.y + (event.shiftKey ? 0 : dy)),
          w: Math.max(1, n.tile.w + (event.shiftKey ? dx : 0)),
          h: Math.max(1, n.tile.h + (event.shiftKey ? dy : 0)),
        })),
      ),
    );
  }

  destroy(): void {
    this.destroyed = true;
    for (const off of this.inspectorOff) off();
    this.inspectorOff = [];
    for (const off of this.off) off();
    this.adapter.destroy();
    this.runtime.destroy();
    this.data.destroy();
  }
}
