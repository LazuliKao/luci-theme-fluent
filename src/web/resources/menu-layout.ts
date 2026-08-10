export interface SavedMenuCategory {
  id: string;
  title: string;
  items: string[];
}

export type SavedMenuCategoryRef = string | number;
export type SavedMenuCategoryMove = [source: SavedMenuCategoryRef, before: SavedMenuCategoryRef | null];
export type SavedMenuItemMove = [path: string, target: SavedMenuCategoryRef, before: string | null];
export type SavedMenuTitle = [primaryPath: string, title: string];

export interface SavedMenuLayout {
  version: 1;
  custom: string[];
  titles: SavedMenuTitle[];
  categoryMoves: SavedMenuCategoryMove[];
  itemMoves: SavedMenuItemMove[];
  hiddenCategories: SavedMenuCategoryRef[];
  hiddenItems: string[];
}

export interface PendingMenuLayout {
  titles: Array<[categoryId: string, title: string]>;
  categoryMoves: Array<[sourceId: string, beforeId: string | null]>;
  itemMoves: Array<[path: string, targetId: string, before: string | null]>;
}

export interface ResolvedMenuLayout {
  categories: SavedMenuCategory[];
  hiddenCategoryIds: Set<string>;
  hiddenItemPaths: Set<string>;
  pending: PendingMenuLayout;
  configured: boolean;
}

export interface PresentationPrimary {
  path: string;
  pathSegments: [string, string];
  node: LuCI.ui.menu.MenuNode;
  title: string;
  rawTitle: string;
}

export interface PresentationItem {
  path: string;
  pathSegments: [string, string, string];
  node: LuCI.ui.menu.MenuNode;
  title: string;
  rawTitle: string;
  originalPrimaryPath: string;
  originalPrimaryTitle: string;
}

export interface PresentationCategory {
  id: string;
  title: string;
  primary: PresentationPrimary | null;
  items: PresentationItem[];
}

export interface MenuPresentation {
  categories: PresentationCategory[];
  hiddenCategoryIds: ReadonlySet<string>;
  hiddenPaths: ReadonlySet<string>;
  configured: boolean;
}

interface DiscoveredMenu {
  primaries: PresentationPrimary[];
  items: PresentationItem[];
}

const PRIMARY_CATEGORY_PREFIX = "primary:";
const CUSTOM_CATEGORY_PREFIX = "custom:";
const SAVED_LAYOUT_KEYS = new Set(["version", "custom", "titles", "categoryMoves", "itemMoves", "hiddenCategories", "hiddenItems"]);

function translatedTitle(title: string): string {
  return typeof _ === "function" ? _(title) : title;
}

export function primaryCategoryId(path: string): string {
  return `${PRIMARY_CATEGORY_PREFIX}${path}`;
}

function primaryPathFromId(id: string): string | null {
  return id.startsWith(PRIMARY_CATEGORY_PREFIX) ? id.slice(PRIMARY_CATEGORY_PREFIX.length) : null;
}

function discoverMenu(root: LuCI.ui.menu.MenuNode): DiscoveredMenu {
  const primaries: PresentationPrimary[] = [];
  const items: PresentationItem[] = [];

  for (const rootNode of ui.menu.getChildren(root)) {
    if (!rootNode.satisfied) continue;

    for (const primaryNode of ui.menu.getChildren(rootNode)) {
      const primaryRawTitle = primaryNode.title?.trim();
      if (!primaryNode.satisfied || !primaryRawTitle) continue;

      const primaryPath = `${rootNode.name}/${primaryNode.name}`;
      const primaryTitle = translatedTitle(primaryRawTitle);
      primaries.push({
        path: primaryPath,
        pathSegments: [rootNode.name, primaryNode.name],
        node: primaryNode,
        title: primaryTitle,
        rawTitle: primaryRawTitle,
      });

      for (const itemNode of ui.menu.getChildren(primaryNode)) {
        const rawTitle = itemNode.title?.trim();
        if (!itemNode.satisfied || !rawTitle) continue;

        items.push({
          path: `${primaryPath}/${itemNode.name}`,
          pathSegments: [rootNode.name, primaryNode.name, itemNode.name],
          node: itemNode,
          title: translatedTitle(rawTitle),
          rawTitle,
          originalPrimaryPath: primaryPath,
          originalPrimaryTitle: primaryTitle,
        });
      }
    }
  }

  return { primaries, items };
}

export function discoverMenuItems(root: LuCI.ui.menu.MenuNode): PresentationItem[] {
  return discoverMenu(root).items;
}

function defaultCategories(menu: DiscoveredMenu): SavedMenuCategory[] {
  const categories = menu.primaries.map((primary) => ({ id: primaryCategoryId(primary.path), title: primary.title, items: [] as string[] }));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  for (const item of menu.items) {
    categoriesById.get(primaryCategoryId(item.originalPrimaryPath))?.items.push(item.path);
  }

  return categories;
}

export function buildDefaultMenuCategories(root: LuCI.ui.menu.MenuNode): SavedMenuCategory[] {
  return defaultCategories(discoverMenu(root));
}

function copyCategories(categories: readonly SavedMenuCategory[]): SavedMenuCategory[] {
  return categories.map((category) => ({ ...category, items: [...category.items] }));
}

export type MenuDropPosition = "before" | "after";

export function moveMenuItem(categories: readonly SavedMenuCategory[], path: string, targetCategoryId: string, beforePath?: string): SavedMenuCategory[] {
  const nextCategories = copyCategories(categories);
  const targetCategory = nextCategories.find((category) => category.id === targetCategoryId);
  if (!targetCategory || beforePath === path) return nextCategories;

  for (const category of nextCategories) {
    category.items = category.items.filter((itemPath) => itemPath !== path);
  }

  const targetIndex = beforePath ? targetCategory.items.indexOf(beforePath) : -1;
  if (targetIndex >= 0) targetCategory.items.splice(targetIndex, 0, path);
  else targetCategory.items.push(path);
  return nextCategories;
}

export function moveMenuCategory(categories: readonly SavedMenuCategory[], sourceId: string, targetId: string, position: MenuDropPosition = "before"): SavedMenuCategory[] {
  const nextCategories = copyCategories(categories);
  const sourceIndex = nextCategories.findIndex((category) => category.id === sourceId);
  if (sourceIndex < 0 || sourceId === targetId || !nextCategories.some((category) => category.id === targetId)) return nextCategories;

  const [source] = nextCategories.splice(sourceIndex, 1);
  const targetIndex = nextCategories.findIndex((category) => category.id === targetId);
  nextCategories.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, source);
  return nextCategories;
}

function moveMenuCategoryBefore(categories: readonly SavedMenuCategory[], sourceId: string, beforeId: string | null): SavedMenuCategory[] {
  if (beforeId) return moveMenuCategory(categories, sourceId, beforeId);

  const nextCategories = copyCategories(categories);
  const sourceIndex = nextCategories.findIndex((category) => category.id === sourceId);
  if (sourceIndex < 0) return nextCategories;
  const [source] = nextCategories.splice(sourceIndex, 1);
  nextCategories.push(source);
  return nextCategories;
}

function followingOriginalSiblingPaths(items: readonly PresentationItem[], itemIndex: number): Set<string> {
  const item = items[itemIndex];
  return new Set(
    items
      .slice(itemIndex + 1)
      .filter((candidate) => candidate.originalPrimaryPath === item.originalPrimaryPath)
      .map((candidate) => candidate.path),
  );
}

export function canRestoreMenuItem(categories: readonly SavedMenuCategory[], items: readonly PresentationItem[], path: string): boolean {
  const itemIndex = items.findIndex((item) => item.path === path);
  if (itemIndex < 0) return false;

  const targetId = primaryCategoryId(items[itemIndex].originalPrimaryPath);
  const targetCategory = categories.find((category) => category.id === targetId);
  if (!targetCategory) return true;

  let occurrenceCount = 0;
  let currentIndex = -1;
  for (const category of categories) {
    for (let index = 0; index < category.items.length; index += 1) {
      if (category.items[index] !== path) continue;
      occurrenceCount += 1;
      if (category.id === targetId) currentIndex = index;
    }
  }
  if (occurrenceCount !== 1 || currentIndex < 0) return true;

  const followingPaths = followingOriginalSiblingPaths(items, itemIndex);
  const followingIndex = targetCategory.items.findIndex((itemPath) => followingPaths.has(itemPath));
  const restoredIndex = followingIndex < 0 ? targetCategory.items.length - 1 : followingIndex > currentIndex ? followingIndex - 1 : followingIndex;
  return restoredIndex !== currentIndex;
}

export function restoreMenuItemToOriginalPosition(categories: readonly SavedMenuCategory[], items: readonly PresentationItem[], path: string): SavedMenuCategory[] {
  const restoredItemIndex = items.findIndex((item) => item.path === path);
  if (restoredItemIndex < 0) return copyCategories(categories);

  const restoredItem = items[restoredItemIndex];
  const targetId = primaryCategoryId(restoredItem.originalPrimaryPath);
  const categoriesWithTarget = categories.some((category) => category.id === targetId) ? categories : [...categories, { id: targetId, title: restoredItem.originalPrimaryTitle, items: [] }];
  const followingOriginalPaths = followingOriginalSiblingPaths(items, restoredItemIndex);
  const targetCategory = categoriesWithTarget.find((category) => category.id === targetId);
  const beforePath = targetCategory?.items.find((itemPath) => followingOriginalPaths.has(itemPath));
  return moveMenuItem(categoriesWithTarget, path, targetId, beforePath);
}

function isPath(value: unknown, segmentCount: number): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  const segments = value.split("/");
  return segments.length === segmentCount && segments.every(Boolean);
}

function categoryRefKey(ref: SavedMenuCategoryRef): string {
  return typeof ref === "number" ? `custom:${ref}` : `primary:${ref}`;
}

function parseCategoryRef(value: unknown, customCount: number): SavedMenuCategoryRef | null {
  if (Number.isInteger(value) && (value as number) >= 0 && (value as number) < customCount) return value as number;
  return isPath(value, 2) ? value : null;
}

function optionalArray(record: Record<string, unknown>, key: string): unknown[] | null {
  const value = record[key];
  return value === undefined ? [] : Array.isArray(value) ? value : null;
}

export function parseMenuLayout(value: string | string[] | null): SavedMenuLayout | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    return null;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  if (record.version !== 1 || Object.keys(record).some((key) => !SAVED_LAYOUT_KEYS.has(key))) return null;

  const customValues = optionalArray(record, "custom");
  const titleValues = optionalArray(record, "titles");
  const categoryMoveValues = optionalArray(record, "categoryMoves");
  const itemMoveValues = optionalArray(record, "itemMoves");
  const hiddenCategoryValues = optionalArray(record, "hiddenCategories");
  const hiddenItemValues = optionalArray(record, "hiddenItems");
  if (!customValues || !titleValues || !categoryMoveValues || !itemMoveValues || !hiddenCategoryValues || !hiddenItemValues) return null;

  const custom: string[] = [];
  const customTitles = new Set<string>();
  for (const value of customValues) {
    if (typeof value !== "string") return null;
    const title = value.trim();
    const normalizedTitle = title.toLocaleLowerCase();
    if (!title || customTitles.has(normalizedTitle)) return null;
    customTitles.add(normalizedTitle);
    custom.push(title);
  }

  const titles: SavedMenuTitle[] = [];
  const titledPrimaries = new Set<string>();
  for (const value of titleValues) {
    if (!Array.isArray(value) || value.length !== 2 || !isPath(value[0], 2) || typeof value[1] !== "string") return null;
    const title = value[1].trim();
    if (!title || titledPrimaries.has(value[0])) return null;
    titledPrimaries.add(value[0]);
    titles.push([value[0], title]);
  }

  const categoryMoves: SavedMenuCategoryMove[] = [];
  const movedCategories = new Set<string>();
  for (const value of categoryMoveValues) {
    if (!Array.isArray(value) || value.length !== 2) return null;
    const source = parseCategoryRef(value[0], custom.length);
    const before = value[1] === null ? null : parseCategoryRef(value[1], custom.length);
    if (source === null || (value[1] !== null && before === null)) return null;
    const sourceKey = categoryRefKey(source);
    if (movedCategories.has(sourceKey) || (before !== null && sourceKey === categoryRefKey(before))) return null;
    movedCategories.add(sourceKey);
    categoryMoves.push([source, before]);
  }

  const itemMoves: SavedMenuItemMove[] = [];
  const movedItems = new Set<string>();
  for (const value of itemMoveValues) {
    if (!Array.isArray(value) || value.length !== 3 || !isPath(value[0], 3)) return null;
    const target = parseCategoryRef(value[1], custom.length);
    const before = value[2] === null ? null : isPath(value[2], 3) ? value[2] : null;
    if (target === null || (value[2] !== null && before === null) || movedItems.has(value[0]) || before === value[0]) return null;
    movedItems.add(value[0]);
    itemMoves.push([value[0], target, before]);
  }

  const hiddenCategories: SavedMenuCategoryRef[] = [];
  const hiddenCategoryKeys = new Set<string>();
  for (const value of hiddenCategoryValues) {
    const ref = parseCategoryRef(value, custom.length);
    if (ref === null || hiddenCategoryKeys.has(categoryRefKey(ref))) return null;
    hiddenCategoryKeys.add(categoryRefKey(ref));
    hiddenCategories.push(ref);
  }

  const hiddenItems: string[] = [];
  const hiddenItemPaths = new Set<string>();
  for (const value of hiddenItemValues) {
    if (!isPath(value, 3) || hiddenItemPaths.has(value)) return null;
    hiddenItemPaths.add(value);
    hiddenItems.push(value);
  }

  return { version: 1, custom, titles, categoryMoves, itemMoves, hiddenCategories, hiddenItems };
}

function emptyPendingLayout(): PendingMenuLayout {
  return { titles: [], categoryMoves: [], itemMoves: [] };
}

function customCategoryId(index: number): string {
  return `${CUSTOM_CATEGORY_PREFIX}${index}`;
}

function categoryIdFromRef(ref: SavedMenuCategoryRef, customIds: readonly string[]): string | null {
  return typeof ref === "number" ? (customIds[ref] ?? null) : primaryCategoryId(ref);
}

export function resolveMenuLayout(root: LuCI.ui.menu.MenuNode, layout: SavedMenuLayout | null): ResolvedMenuLayout {
  const menu = discoverMenu(root);
  let categories = defaultCategories(menu);
  const hiddenCategoryIds = new Set<string>();
  const hiddenItemPaths = new Set<string>();
  const pending = emptyPendingLayout();
  if (!layout) return { categories, hiddenCategoryIds, hiddenItemPaths, pending, configured: false };

  const customIds = layout.custom.map((title, index) => {
    const id = customCategoryId(index);
    categories.push({ id, title, items: [] });
    return id;
  });
  const knownItemPaths = new Set(menu.items.map((item) => item.path));
  let configured = customIds.length > 0;

  for (const [path, title] of layout.titles) {
    const id = primaryCategoryId(path);
    const category = categories.find((candidate) => candidate.id === id);
    if (category) {
      category.title = title;
      configured = true;
    } else {
      pending.titles.push([id, title]);
    }
  }

  for (const [sourceRef, beforeRef] of layout.categoryMoves) {
    const sourceId = categoryIdFromRef(sourceRef, customIds);
    const beforeId = beforeRef === null ? null : categoryIdFromRef(beforeRef, customIds);
    const sourceExists = sourceId !== null && categories.some((category) => category.id === sourceId);
    const beforeExists = beforeId === null || categories.some((category) => category.id === beforeId);
    if (sourceId && sourceExists && beforeExists) {
      categories = moveMenuCategoryBefore(categories, sourceId, beforeId);
      configured = true;
    } else if (sourceId) {
      pending.categoryMoves.push([sourceId, beforeId]);
    }
  }

  for (const [path, targetRef, before] of layout.itemMoves) {
    const targetId = categoryIdFromRef(targetRef, customIds);
    const target = targetId ? categories.find((category) => category.id === targetId) : undefined;
    const anchorExists = before === null || Boolean(target?.items.includes(before));
    if (knownItemPaths.has(path) && targetId && target && anchorExists) {
      categories = moveMenuItem(categories, path, targetId, before ?? undefined);
      configured = true;
    } else if (targetId) {
      pending.itemMoves.push([path, targetId, before]);
    }
  }

  for (const ref of layout.hiddenCategories) {
    const id = categoryIdFromRef(ref, customIds);
    if (!id) continue;
    hiddenCategoryIds.add(id);
    if (categories.some((category) => category.id === id)) configured = true;
  }
  for (const path of layout.hiddenItems) {
    hiddenItemPaths.add(path);
    if (knownItemPaths.has(path)) configured = true;
  }

  return { categories, hiddenCategoryIds, hiddenItemPaths, pending, configured };
}

function stableSubsequence(base: readonly string[], target: readonly string[]): Set<string> {
  const targetIndexes = new Map(target.map((value, index) => [value, index]));
  const sequence = base.flatMap((value) => {
    const index = targetIndexes.get(value);
    return index === undefined ? [] : [{ value, index }];
  });
  const tails: number[] = [];
  const previous = new Array<number>(sequence.length).fill(-1);

  for (let index = 0; index < sequence.length; index += 1) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sequence[tails[middle]].index < sequence[index].index) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tails[low - 1];
    tails[low] = index;
  }

  const stable = new Set<string>();
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]) stable.add(sequence[index].value);
  return stable;
}

function encodeMoves(base: readonly string[], target: readonly string[]): Array<[source: string, before: string | null]> {
  const stable = stableSubsequence(base, target);
  const moves: Array<[string, string | null]> = [];
  for (let index = target.length - 1; index >= 0; index -= 1) {
    if (!stable.has(target[index])) moves.push([target[index], target[index + 1] ?? null]);
  }
  return moves;
}

function categoryRefFromId(id: string, customIndexes: ReadonlyMap<string, number>): SavedMenuCategoryRef | null {
  const primaryPath = primaryPathFromId(id);
  if (primaryPath) return primaryPath;
  return customIndexes.get(id) ?? null;
}

function compareByKnownOrder(left: string, right: string, indexes: ReadonlyMap<string, number>): number {
  const leftIndex = indexes.get(left);
  const rightIndex = indexes.get(right);
  if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
  if (leftIndex !== undefined) return -1;
  if (rightIndex !== undefined) return 1;
  return left.localeCompare(right);
}

export function serializeMenuLayout(
  root: LuCI.ui.menu.MenuNode,
  categories: readonly SavedMenuCategory[],
  hiddenCategoryIds: ReadonlySet<string>,
  hiddenItemPaths: ReadonlySet<string>,
  pending: PendingMenuLayout = emptyPendingLayout(),
): string {
  const menu = discoverMenu(root);
  const defaults = defaultCategories(menu);
  const defaultById = new Map(defaults.map((category) => [category.id, category]));
  const customCategories = categories.filter((category) => !defaultById.has(category.id));
  const customIndexes = new Map(customCategories.map((category, index) => [category.id, index]));
  const custom = customCategories.map((category) => category.title.trim());

  const titles: SavedMenuTitle[] = [];
  const titledIds = new Set<string>();
  for (const category of categories) {
    const original = defaultById.get(category.id);
    const title = category.title.trim();
    if (!original || title === original.title) continue;
    const path = primaryPathFromId(category.id);
    if (!path) continue;
    titles.push([path, title]);
    titledIds.add(category.id);
  }
  for (const [id, title] of pending.titles) {
    if (titledIds.has(id)) continue;
    const path = primaryPathFromId(id);
    if (path) titles.push([path, title]);
  }

  const baseCategoryIds = [...defaults.map((category) => category.id), ...customCategories.map((category) => category.id)];
  const targetCategoryIds = categories.map((category) => category.id);
  const categoryMoves: SavedMenuCategoryMove[] = [];
  const movedCategoryIds = new Set<string>();
  for (const [sourceId, beforeId] of encodeMoves(baseCategoryIds, targetCategoryIds)) {
    const source = categoryRefFromId(sourceId, customIndexes);
    const before = beforeId === null ? null : categoryRefFromId(beforeId, customIndexes);
    if (source === null || (beforeId !== null && before === null)) continue;
    categoryMoves.push([source, before]);
    movedCategoryIds.add(sourceId);
  }
  for (const [sourceId, beforeId] of pending.categoryMoves) {
    if (movedCategoryIds.has(sourceId)) continue;
    const source = categoryRefFromId(sourceId, customIndexes);
    const before = beforeId === null ? null : categoryRefFromId(beforeId, customIndexes);
    if (source !== null && (beforeId === null || before !== null)) categoryMoves.push([source, before]);
  }

  const itemMoves: SavedMenuItemMove[] = [];
  const movedItemPaths = new Set<string>();
  for (const category of categories) {
    const targetRef = categoryRefFromId(category.id, customIndexes);
    if (targetRef === null) continue;
    const baseItems = defaultById.get(category.id)?.items ?? [];
    const stable = stableSubsequence(baseItems, category.items);
    for (let index = category.items.length - 1; index >= 0; index -= 1) {
      const path = category.items[index];
      if (stable.has(path)) continue;
      itemMoves.push([path, targetRef, category.items[index + 1] ?? null]);
      movedItemPaths.add(path);
    }
  }
  for (const [path, targetId, before] of pending.itemMoves) {
    if (movedItemPaths.has(path)) continue;
    const target = categoryRefFromId(targetId, customIndexes);
    if (target !== null) itemMoves.push([path, target, before]);
  }

  const categoryIndexes = new Map(categories.map((category, index) => [category.id, index]));
  const hiddenCategories = [...hiddenCategoryIds]
    .sort((left, right) => compareByKnownOrder(left, right, categoryIndexes))
    .flatMap((id) => {
      const ref = categoryRefFromId(id, customIndexes);
      return ref === null ? [] : [ref];
    });
  const itemIndexes = new Map(menu.items.map((item, index) => [item.path, index]));
  const hiddenItems = [...hiddenItemPaths].sort((left, right) => compareByKnownOrder(left, right, itemIndexes));

  const output: Record<string, unknown> = { version: 1 };
  if (custom.length > 0) output.custom = custom;
  if (titles.length > 0) output.titles = titles;
  if (categoryMoves.length > 0) output.categoryMoves = categoryMoves;
  if (itemMoves.length > 0) output.itemMoves = itemMoves;
  if (hiddenCategories.length > 0) output.hiddenCategories = hiddenCategories;
  if (hiddenItems.length > 0) output.hiddenItems = hiddenItems;
  return Object.keys(output).length === 1 ? "" : JSON.stringify(output);
}

function presentationCategory(category: SavedMenuCategory, primariesByCategoryId: ReadonlyMap<string, PresentationPrimary>, itemsByPath: ReadonlyMap<string, PresentationItem>): PresentationCategory {
  return {
    id: category.id,
    title: category.title,
    primary: primariesByCategoryId.get(category.id) ?? null,
    items: category.items.flatMap((path) => {
      const item = itemsByPath.get(path);
      return item ? [item] : [];
    }),
  };
}

export function buildMenuPresentation(root: LuCI.ui.menu.MenuNode, value: string | string[] | null): MenuPresentation {
  const menu = discoverMenu(root);
  const parsed = parseMenuLayout(value);
  const resolved = resolveMenuLayout(root, parsed);
  const itemsByPath = new Map(menu.items.map((item) => [item.path, item]));
  const primariesByCategoryId = new Map(menu.primaries.map((primary) => [primaryCategoryId(primary.path), primary]));
  const hiddenPaths = new Set(resolved.hiddenItemPaths);
  for (const id of resolved.hiddenCategoryIds) {
    const path = primaryPathFromId(id);
    if (path) hiddenPaths.add(path);
    const category = resolved.categories.find((candidate) => candidate.id === id);
    if (category) {
      for (const itemPath of category.items) hiddenPaths.add(itemPath);
    }
  }

  return {
    categories: resolved.categories.map((category) => presentationCategory(category, primariesByCategoryId, itemsByPath)),
    hiddenCategoryIds: resolved.hiddenCategoryIds,
    hiddenPaths,
    configured: resolved.configured,
  };
}
