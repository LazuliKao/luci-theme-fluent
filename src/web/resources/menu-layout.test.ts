import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultMenuCategories,
  buildMenuPresentation,
  canRestoreMenuItem,
  discoverMenuItems,
  moveMenuCategory,
  moveMenuItem,
  type PendingMenuLayout,
  parseMenuLayout,
  primaryCategoryId,
  resolveMenuLayout,
  restoreMenuItemToOriginalPosition,
  type SavedMenuCategory,
  serializeMenuLayout,
} from "./menu-layout";
import { searchMenu } from "./utils/menu-search";

type MenuNode = LuCI.ui.menu.MenuNode;

Object.assign(globalThis, {
  _: (value: string) => value,
  ui: {
    menu: {
      getChildren: (node: MenuNode): MenuNode[] => Object.values(node.children ?? {}).sort((left, right) => left.order - right.order),
    },
  },
});

function menuNode(name: string, title: string, order: number, children?: MenuNode[]): MenuNode {
  return {
    name,
    title,
    order,
    satisfied: true,
    children: Object.fromEntries((children ?? []).map((child) => [child.name, child])),
  };
}

function fixture(includePluginItem = false): MenuNode {
  const statusItems = [menuNode("overview", "Overview", 10)];
  if (includePluginItem) statusItems.push(menuNode("history", "History", 15));
  statusItems.push(menuNode("realtime", "Realtime graphs", 20));

  const status = menuNode("status", "Status", 10, statusItems);
  const network = menuNode("network", "Network", 20, [menuNode("interfaces", "Interfaces", 10), menuNode("diagnostics", "Diagnostics", 20)]);
  const services = menuNode("services", "Services", 30, [menuNode("dns", "DNS", 10)]);
  const logout = menuNode("logout", "Logout", 40);

  return menuNode("root", "Root", 0, [menuNode("admin", "Administration", 10, [status, network, services, logout])]);
}

function emptyPending(): PendingMenuLayout {
  return { titles: [], itemTitles: [], categoryMoves: [], itemMoves: [] };
}

function serializeState(
  tree: MenuNode,
  categories: readonly SavedMenuCategory[],
  hiddenCategoryIds: ReadonlySet<string> = new Set(),
  hiddenItemPaths: ReadonlySet<string> = new Set(),
  pending: PendingMenuLayout = emptyPending(),
  itemTitles: ReadonlyMap<string, string> = new Map(),
): string {
  return serializeMenuLayout(tree, categories, hiddenCategoryIds, hiddenItemPaths, pending, itemTitles);
}

function parse(value: string) {
  const parsed = parseMenuLayout(value);
  assert.ok(parsed);
  return parsed;
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length < 2) return [[...values]];
  return values.flatMap((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]));
}

test("default layout discovers primary and second-level menus without persisting a snapshot", () => {
  const tree = fixture();
  const categories = buildDefaultMenuCategories(tree);

  assert.deepEqual(
    categories.map((category) => ({ id: category.id, title: category.title, items: category.items })),
    [
      { id: "primary:admin/status", title: "Status", items: ["admin/status/overview", "admin/status/realtime"] },
      { id: "primary:admin/network", title: "Network", items: ["admin/network/interfaces", "admin/network/diagnostics"] },
      { id: "primary:admin/services", title: "Services", items: ["admin/services/dns"] },
      { id: "primary:admin/logout", title: "Logout", items: [] },
    ],
  );
  assert.equal(serializeState(tree, categories), "");
});

test("a hidden second-level menu stores only its path", () => {
  const tree = fixture();
  const value = serializeState(tree, buildDefaultMenuCategories(tree), new Set(), new Set(["admin/status/overview"]));

  assert.equal(value, '{"version":1,"hiddenItems":["admin/status/overview"]}');
  const presentation = buildMenuPresentation(tree, value);
  assert.equal(presentation.hiddenPaths.has("admin/status/overview"), true);
  assert.deepEqual(searchMenu(presentation, "Overview"), []);
});

test("a hidden built-in primary menu is absent from presentation search and tab visibility", () => {
  const tree = fixture();
  const statusId = primaryCategoryId("admin/status");
  const value = serializeState(tree, buildDefaultMenuCategories(tree), new Set([statusId]));

  assert.equal(value, '{"version":1,"hiddenCategories":["admin/status"]}');
  const presentation = buildMenuPresentation(tree, value);
  assert.equal(presentation.hiddenCategoryIds.has(statusId), true);
  assert.equal(presentation.hiddenPaths.has("admin/status"), true);
  assert.deepEqual(searchMenu(presentation, "Realtime"), []);
});

test("one cross-primary move is encoded as one anchored item move", () => {
  const tree = fixture();
  const categories = moveMenuItem(buildDefaultMenuCategories(tree), "admin/status/realtime", primaryCategoryId("admin/network"), "admin/network/interfaces");
  const value = serializeState(tree, categories);

  assert.equal(value, '{"version":1,"itemMoves":[["admin/status/realtime","admin/network","admin/network/interfaces"]]}');
  assert.deepEqual(
    buildMenuPresentation(tree, value).categories.map((category) => category.items.map((item) => item.path)),
    [["admin/status/overview"], ["admin/status/realtime", "admin/network/interfaces", "admin/network/diagnostics"], ["admin/services/dns"], []],
  );
});

test("restoring an item removes its semantic diff", () => {
  const tree = fixture();
  const items = discoverMenuItems(tree);
  const defaults = buildDefaultMenuCategories(tree);
  const reordered = moveMenuItem(defaults, "admin/status/realtime", primaryCategoryId("admin/status"), "admin/status/overview");

  assert.equal(canRestoreMenuItem(reordered, items, "admin/status/realtime"), true);
  const restored = restoreMenuItemToOriginalPosition(reordered, items, "admin/status/realtime");
  assert.equal(canRestoreMenuItem(restored, items, "admin/status/realtime"), false);
  assert.equal(serializeState(tree, restored), "");
});

test("primary ordering is encoded with sparse before anchors", () => {
  const tree = fixture();
  const categories = moveMenuCategory(buildDefaultMenuCategories(tree), primaryCategoryId("admin/services"), primaryCategoryId("admin/status"));
  const value = serializeState(tree, categories);

  assert.equal(value, '{"version":1,"categoryMoves":[["admin/services","admin/status"]]}');
  assert.deepEqual(
    buildMenuPresentation(tree, value).categories.map((category) => category.id),
    categories.map((category) => category.id),
  );
});

test("custom primaries use compact numeric references", () => {
  const tree = fixture();
  let categories = buildDefaultMenuCategories(tree);
  categories.push({ id: "editor-only-id", title: "Quick access", items: [] });
  categories = moveMenuItem(categories, "admin/status/realtime", "editor-only-id");
  categories = moveMenuCategory(categories, "editor-only-id", primaryCategoryId("admin/network"));
  const value = serializeState(tree, categories, new Set(["editor-only-id"]));

  assert.equal(value, '{"version":1,"custom":["Quick access"],"categoryMoves":[[0,"admin/network"]],"itemMoves":[["admin/status/realtime",0,null]],"hiddenCategories":[0]}');
  const presentation = buildMenuPresentation(tree, value);
  assert.equal(presentation.hiddenCategoryIds.has("custom:0"), true);
  assert.equal(presentation.hiddenPaths.has("admin/status/realtime"), true);
  assert.deepEqual(searchMenu(presentation, "Realtime"), []);
  assert.deepEqual(
    presentation.categories.map((category) => ({ title: category.title, items: category.items.map((item) => item.path) })),
    [
      { title: "Status", items: ["admin/status/overview"] },
      { title: "Quick access", items: ["admin/status/realtime"] },
      { title: "Network", items: ["admin/network/interfaces", "admin/network/diagnostics"] },
      { title: "Services", items: ["admin/services/dns"] },
      { title: "Logout", items: [] },
    ],
  );
});

test("only changed built-in titles are stored and restoring the title clears the value", () => {
  const tree = fixture();
  const categories = buildDefaultMenuCategories(tree);
  categories[0].title = "Health";

  assert.equal(serializeState(tree, categories), '{"version":1,"titles":[["admin/status","Health"]]}');
  categories[0].title = "Status";
  assert.equal(serializeState(tree, categories), "");
});

test("item titles are stored only when changed and cleared when restored to original", () => {
  const tree = fixture();
  const categories = buildDefaultMenuCategories(tree);
  const itemTitles = new Map<string, string>();

  // No item title overrides produces empty
  assert.equal(serializeState(tree, categories, new Set(), new Set(), emptyPending(), itemTitles), "");

  // An override that matches the original translated title is not stored
  itemTitles.set("admin/status/overview", "Overview");
  assert.equal(serializeState(tree, categories, new Set(), new Set(), emptyPending(), itemTitles), "");

  // A changed title is stored
  itemTitles.set("admin/status/overview", "Dashboard");
  assert.equal(serializeState(tree, categories, new Set(), new Set(), emptyPending(), itemTitles), '{"version":1,"itemTitles":[["admin/status/overview","Dashboard"]]}');

  // Multiple item titles
  itemTitles.set("admin/network/interfaces", "My Interfaces");
  const serialized = serializeState(tree, categories, new Set(), new Set(), emptyPending(), itemTitles);
  const parsed = parse(serialized);
  assert.deepEqual(parsed.itemTitles, [
    ["admin/status/overview", "Dashboard"],
    ["admin/network/interfaces", "My Interfaces"],
  ]);

  // Round-trip: resolve and re-serialize preserves item titles
  const resolved = resolveMenuLayout(tree, parsed);
  assert.equal(resolved.itemTitles.get("admin/status/overview"), "Dashboard");
  assert.equal(resolved.itemTitles.get("admin/network/interfaces"), "My Interfaces");
  const reserialized = serializeState(tree, resolved.categories, resolved.hiddenCategoryIds, resolved.hiddenItemPaths, resolved.pending, resolved.itemTitles);
  assert.equal(reserialized, serialized);

  // Restoring item to original title removes it
  itemTitles.set("admin/status/overview", "Overview");
  assert.equal(serializeState(tree, categories, new Set(), new Set(), emptyPending(), itemTitles), '{"version":1,"itemTitles":[["admin/network/interfaces","My Interfaces"]]}');
});

test("item title overrides appear in presentation", () => {
  const tree = fixture();
  const value = '{"version":1,"itemTitles":[["admin/status/overview","Dashboard"]]}';
  const presentation = buildMenuPresentation(tree, value);
  const statusCategory = presentation.categories.find((c) => c.title === "Status");
  assert.ok(statusCategory);
  const overviewItem = statusCategory.items.find((i) => i.path === "admin/status/overview");
  assert.ok(overviewItem);
  assert.equal(overviewItem.title, "Dashboard");
  assert.equal(overviewItem.rawTitle, "Overview");

  // Non-overridden items keep their original title
  const realtimeItem = statusCategory.items.find((i) => i.path === "admin/status/realtime");
  assert.ok(realtimeItem);
  assert.equal(realtimeItem.title, "Realtime graphs");
});

test("unresolved item title overrides survive saves and apply after reinstall", () => {
  const tree = fixture();
  const original = '{"version":1,"itemTitles":[["admin/status/history","My History"]]}';
  const resolved = resolveMenuLayout(tree, parse(original));

  // The item doesn't exist yet, so it's pending
  assert.equal(resolved.itemTitles.size, 0);
  assert.deepEqual(resolved.pending.itemTitles, [["admin/status/history", "My History"]]);

  // Re-serializing preserves the pending title
  const saved = serializeState(tree, resolved.categories, resolved.hiddenCategoryIds, resolved.hiddenItemPaths, resolved.pending, resolved.itemTitles);
  assert.equal(saved, original);

  // After the plugin is installed, the title applies
  const treeWithPlugin = fixture(true);
  const presentation = buildMenuPresentation(treeWithPlugin, saved);
  const statusCategory = presentation.categories.find((c) => c.title === "Status");
  assert.ok(statusCategory);
  const historyItem = statusCategory.items.find((i) => i.path === "admin/status/history");
  assert.ok(historyItem);
  assert.equal(historyItem.title, "My History");
});

test("temporarily unresolved plugin rules survive saves and apply after reinstall", () => {
  const tree = fixture();
  const original = '{"version":1,"itemMoves":[["admin/status/history","admin/network","admin/network/diagnostics"]],"hiddenItems":["admin/services/missing"]}';
  const resolved = resolveMenuLayout(tree, parse(original));

  assert.deepEqual(resolved.pending.itemMoves, [["admin/status/history", primaryCategoryId("admin/network"), "admin/network/diagnostics"]]);
  const savedAgain = serializeState(tree, resolved.categories, resolved.hiddenCategoryIds, resolved.hiddenItemPaths, resolved.pending);
  assert.equal(savedAgain, original);

  const presentation = buildMenuPresentation(fixture(true), savedAgain);
  assert.deepEqual(
    presentation.categories[0].items.map((item) => item.path),
    ["admin/status/overview", "admin/status/realtime"],
  );
  assert.deepEqual(
    presentation.categories[1].items.map((item) => item.path),
    ["admin/network/interfaces", "admin/status/history", "admin/network/diagnostics"],
  );
});

test("new plugin items merge at native positions around existing semantic diffs", () => {
  const oldTree = fixture();
  const categories = moveMenuItem(buildDefaultMenuCategories(oldTree), "admin/status/realtime", primaryCategoryId("admin/network"));
  const value = serializeState(oldTree, categories);
  const presentation = buildMenuPresentation(fixture(true), value);

  assert.deepEqual(
    presentation.categories[0].items.map((item) => item.path),
    ["admin/status/overview", "admin/status/history"],
  );
  assert.deepEqual(
    presentation.categories[1].items.map((item) => item.path),
    ["admin/network/interfaces", "admin/network/diagnostics", "admin/status/realtime"],
  );
});

test("sparse primary moves reproduce every permutation of the discovered categories", () => {
  const tree = fixture();
  const defaults = buildDefaultMenuCategories(tree);

  for (const categories of permutations(defaults)) {
    const value = serializeState(tree, categories);
    const actual = buildMenuPresentation(tree, value).categories.map((category) => category.id);
    assert.deepEqual(
      actual,
      categories.map((category) => category.id),
    );
  }
});

test("sparse item moves reproduce every permutation inside a primary", () => {
  const tree = fixture(true);
  const defaults = buildDefaultMenuCategories(tree);

  for (const paths of permutations(defaults[0].items)) {
    const categories = defaults.map((category) => ({ ...category, items: [...category.items] }));
    categories[0].items = paths;
    const value = serializeState(tree, categories);
    const actual = buildMenuPresentation(tree, value).categories[0].items.map((item) => item.path);
    assert.deepEqual(actual, paths);
  }
});

test("the version-one delta parser rejects snapshots, deletion tombstones, duplicates, and malformed references", () => {
  assert.equal(parseMenuLayout(JSON.stringify({ version: 2, categories: [], hidden: [] })), null);
  assert.equal(parseMenuLayout(JSON.stringify({ version: 1, removed: ["admin/status"] })), null);
  assert.equal(parseMenuLayout(JSON.stringify({ version: 1, custom: ["One"], itemMoves: [["admin/status/overview", 1, null]] })), null);
  assert.equal(
    parseMenuLayout(
      JSON.stringify({
        version: 1,
        itemMoves: [
          ["admin/status/overview", "admin/network", null],
          ["admin/status/overview", "admin/services", null],
        ],
      }),
    ),
    null,
  );
});

test("pure move helpers remain immutable and ignore invalid targets", () => {
  const categories = [
    { id: "status", title: "Status", items: ["admin/status/overview", "admin/status/realtime"] },
    { id: "network", title: "Network", items: ["admin/network/interfaces"] },
  ];
  const moved = moveMenuItem(categories, "admin/status/realtime", "network", "admin/network/interfaces");

  assert.deepEqual(categories[0].items, ["admin/status/overview", "admin/status/realtime"]);
  assert.deepEqual(moved[1].items, ["admin/status/realtime", "admin/network/interfaces"]);
  assert.deepEqual(moveMenuItem(moved, "admin/status/realtime", "missing"), moved);
  assert.deepEqual(moveMenuCategory(categories, "status", "missing"), categories);
});

test("configured moved items keep the active list-item and submenu classes required by the indicator", async () => {
  class FakeElement {
    children: unknown[] = [];
    className = "";
    style: Record<string, string> = {};

    constructor(readonly tagName: string) {}

    classList = {
      add: (...names: string[]) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        for (const name of names) classes.add(name);
        this.className = [...classes].join(" ");
      },
      remove: (...names: string[]) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        for (const name of names) classes.delete(name);
        this.className = [...classes].join(" ");
      },
      contains: (name: string) => this.className.split(/\s+/).includes(name),
    };

    appendChild(child: unknown) {
      this.children.push(child);
      return child;
    }

    append(...children: unknown[]) {
      this.children.push(...children.flat());
    }

    addEventListener() {}
  }

  const mainMenu = new FakeElement("main");
  const createElement = (tagName: string, props: Record<string, unknown> | null, ...children: unknown[]) => {
    const element = new FakeElement(tagName);
    const attributes = props ?? {};
    if (typeof attributes.class === "string") element.className = attributes.class;
    Object.assign(element, attributes);
    element.append(...children.flat());
    return element;
  };
  Object.assign(globalThis, {
    baseclass: { extend: <T>(value: T) => value },
    document: {
      querySelector: (selector: string) => (selector === "#mainmenu" ? mainMenu : null),
      createDocumentFragment: () => new FakeElement("fragment"),
    },
    E: createElement,
    React: { createElement },
    L: {
      env: { dispatchpath: ["admin", "system", "startup"] },
      url: (...segments: string[]) => segments.join("/"),
    },
  });
  Object.assign(ui, { createHandlerFn: () => () => undefined });

  // menu-fluent reads LuCI globals during module evaluation, so the test imports it after installing the harness.
  const { main } = await import("./menu-fluent");
  const presentation = {
    categories: [
      {
        id: "custom:0",
        title: "Home",
        primary: null,
        items: [
          {
            path: "admin/system/startup",
            pathSegments: ["admin", "system", "startup"] as [string, string, string],
            node: {} as MenuNode,
            title: "Startup",
            rawTitle: "Startup",
            originalPrimaryPath: "admin/system",
            originalPrimaryTitle: "System",
          },
        ],
      },
    ],
    hiddenCategoryIds: new Set<string>(),
    hiddenPaths: new Set<string>(),
    configured: true,
  };
  const context = { ...main, adjustBrandTextSize: () => undefined };
  const navigation = main.renderConfiguredMenu.call(context, presentation) as unknown as FakeElement;
  const category = navigation.children[0] as FakeElement;
  const submenu = category.children[1] as FakeElement;
  const item = submenu.children[0] as FakeElement;

  assert.equal(category.classList.contains("active"), true);
  assert.equal(submenu.classList.contains("active"), true);
  assert.equal(item.classList.contains("active"), true);
});
