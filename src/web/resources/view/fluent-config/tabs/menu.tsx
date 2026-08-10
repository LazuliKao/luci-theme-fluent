const form = L.form;

import {
  buildDefaultMenuCategories,
  canRestoreMenuItem,
  discoverMenuItems,
  type MenuDropPosition,
  moveMenuCategory,
  moveMenuItem,
  type PendingMenuLayout,
  parseMenuLayout,
  primaryCategoryId,
  resolveMenuLayout,
  restoreMenuItemToOriginalPosition,
  type SavedMenuCategory,
  serializeMenuLayout,
} from "../../../menu-layout";

interface EditorState {
  categories: SavedMenuCategory[];
  hiddenCategoryIds: Set<string>;
  hiddenItemPaths: Set<string>;
  pending: PendingMenuLayout;
}

const CATEGORY_DRAG_TYPE = "application/x-fluent-menu-category";
const ITEM_DRAG_TYPE = "application/x-fluent-menu-item";

function dropPosition(event: DragEvent, target: HTMLElement): MenuDropPosition {
  const bounds = target.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}
let fallbackCategoryId = 0;

function createCategoryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();

  fallbackCategoryId += 1;
  return `category-${Date.now()}-${fallbackCategoryId}`;
}

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase();
}

function titleErrors(categories: SavedMenuCategory[]): Map<string, string> {
  const errors = new Map<string, string>();
  const titleOwners = new Map<string, string>();
  for (const category of categories) {
    const title = category.title.trim();
    const normalized = normalizeTitle(title);
    if (!title) {
      errors.set(category.id, _("Primary menu titles cannot be empty."));
      continue;
    }

    const owner = titleOwners.get(normalized);
    if (owner) {
      errors.set(owner, _("Primary menu titles must be unique."));
      errors.set(category.id, _("Primary menu titles must be unique."));
    } else {
      titleOwners.set(normalized, category.id);
    }
  }

  return errors;
}

function validateEditorValue(tree: LuCI.ui.menu.MenuNode, value: unknown): true | string {
  if (value === "" || value == null) return true;
  if (typeof value !== "string") return _("The stored menu layout is invalid. Restore defaults or edit the layout before saving.");

  const parsed = parseMenuLayout(value);
  if (!parsed) return _("The stored menu layout is invalid. Restore defaults or edit the layout before saving.");

  const message = titleErrors(resolveMenuLayout(tree, parsed).categories).values().next().value;
  return message ?? true;
}

function buildEditorState(tree: LuCI.ui.menu.MenuNode, savedValue: string | string[] | null): EditorState {
  const parsed = parseMenuLayout(savedValue);
  if (!parsed) {
    return {
      categories: buildDefaultMenuCategories(tree),
      hiddenCategoryIds: new Set<string>(),
      hiddenItemPaths: new Set<string>(),
      pending: { titles: [], categoryMoves: [], itemMoves: [] },
    };
  }

  const resolved = resolveMenuLayout(tree, parsed);
  return {
    categories: resolved.categories,
    hiddenCategoryIds: resolved.hiddenCategoryIds,
    hiddenItemPaths: resolved.hiddenItemPaths,
    pending: resolved.pending,
  };
}

function createMenuLayoutOption(tree: LuCI.ui.menu.MenuNode) {
  const items = discoverMenuItems(tree);
  const itemsByPath = new Map(items.map((item) => [item.path, item]));
  const defaultCategories = buildDefaultMenuCategories(tree);
  const defaultCategoriesById = new Map(defaultCategories.map((category) => [category.id, category]));
  const inputsBySectionId = new Map<string, HTMLInputElement>();

  return form.Value.extend({
    renderWidget(this: LuCI.form.Value, sectionId: string, _optionIndex: number, cfgvalue: unknown) {
      const savedValue = typeof cfgvalue === "string" || Array.isArray(cfgvalue) ? cfgvalue : null;
      const initialStringValue = typeof cfgvalue === "string" ? cfgvalue : "";
      let state = buildEditorState(tree, savedValue);
      const expandedCategoryIds = new Set<string>();
      const parsedStoredValue = initialStringValue === "" ? null : parseMenuLayout(initialStringValue);
      const invalidStoredValue = initialStringValue !== "" && !parsedStoredValue;
      const hiddenInput = (<input type="hidden" id={this.cbid(sectionId)} value={initialStringValue} />) as HTMLInputElement;
      const cards = (<div class="fluent-menu-editor__categories" />) as HTMLElement;
      const categoryElements = new Map<string, { card: HTMLElement; error?: HTMLElement }>();
      let activeDropTarget: HTMLElement | null = null;
      let activeDropPosition: MenuDropPosition = "before";
      const validationSummary = (<div class="fluent-menu-editor__validation" role="alert" />) as HTMLElement;
      const storedValueNotice = (
        <div class="fluent-menu-editor__notice" hidden={!invalidStoredValue}>
          {_('The stored menu layout is invalid. Choose "Restore defaults" or make an edit before saving.')}
        </div>
      ) as HTMLElement;
      inputsBySectionId.set(sectionId, hiddenInput);

      const updateValidation = (): void => {
        const errors = titleErrors(state.categories);
        for (const [categoryId, elements] of categoryElements) {
          const message = errors.get(categoryId) ?? "";
          elements.card.classList.toggle("is-invalid", Boolean(message));
          if (elements.error) elements.error.textContent = message;
        }
        validationSummary.textContent = errors.size > 0 ? _("Fix primary menu title errors before saving.") : "";
      };

      const syncValue = (value = serializeMenuLayout(tree, state.categories, state.hiddenCategoryIds, state.hiddenItemPaths, state.pending)): void => {
        hiddenInput.value = value;
        storedValueNotice.hidden = true;
        updateValidation();
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const clearDropIndicator = (): void => {
        activeDropTarget?.classList.remove("is-drop-before", "is-drop-after");
        activeDropTarget = null;
      };

      const showDropIndicator = (target: HTMLElement, position: MenuDropPosition): void => {
        if (activeDropTarget !== target || activeDropPosition !== position) clearDropIndicator();
        activeDropTarget = target;
        activeDropPosition = position;
        target.classList.toggle("is-drop-before", position === "before");
        target.classList.toggle("is-drop-after", position === "after");
      };

      const moveItem = (path: string, targetCategoryId: string, beforePath?: string): void => {
        if (!itemsByPath.has(path) || !state.categories.some((category) => category.id === targetCategoryId)) return;

        state.pending.itemMoves = state.pending.itemMoves.filter(([pendingPath]) => pendingPath !== path);
        state.categories = moveMenuItem(state.categories, path, targetCategoryId, beforePath);
        expandedCategoryIds.add(targetCategoryId);
        syncValue();
        renderCategories();
      };

      const restoreItem = (path: string): void => {
        const item = itemsByPath.get(path);
        if (item) expandedCategoryIds.add(primaryCategoryId(item.originalPrimaryPath));
        state.pending.itemMoves = state.pending.itemMoves.filter(([pendingPath]) => pendingPath !== path);
        state.categories = restoreMenuItemToOriginalPosition(state.categories, items, path);
        syncValue();
        renderCategories();
      };

      const renderItem = (path: string, categoryId: string): HTMLElement | null => {
        const item = itemsByPath.get(path);
        const category = state.categories.find((candidate) => candidate.id === categoryId);
        if (!item || !category) return null;

        const row = (<div class={`fluent-menu-editor__item${state.hiddenItemPaths.has(path) ? " is-hidden" : ""}`} data-item-path={path} />) as HTMLElement;
        const dragHandle = (
          <span class="fluent-menu-editor__drag-handle" title={_("Drag to move second-level menu")}>
            ⋮⋮
          </span>
        ) as HTMLElement;
        const visibility = (<input type="checkbox" checked={!state.hiddenItemPaths.has(path)} aria-label={_("Show %s in the menu").format(item.title)} />) as HTMLInputElement;
        dragHandle.draggable = true;

        dragHandle.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData(ITEM_DRAG_TYPE, path);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          row.classList.add("is-dragging");
        });
        dragHandle.addEventListener("dragend", () => {
          row.classList.remove("is-dragging");
          clearDropIndicator();
        });
        visibility.addEventListener("change", () => {
          if (visibility.checked) state.hiddenItemPaths.delete(path);
          else state.hiddenItemPaths.add(path);
          row.classList.toggle("is-hidden", !visibility.checked);
          syncValue();
        });
        row.addEventListener("dragover", (event) => {
          if (!event.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) return;
          event.preventDefault();
          event.stopPropagation();
          showDropIndicator(row, dropPosition(event, row));
        });
        row.addEventListener("dragleave", (event) => {
          if (!row.contains(event.relatedTarget as Node | null) && activeDropTarget === row) clearDropIndicator();
        });
        row.addEventListener("drop", (event) => {
          const pathToMove = event.dataTransfer?.getData(ITEM_DRAG_TYPE);
          if (!pathToMove) return;
          event.preventDefault();
          event.stopPropagation();

          const position = activeDropTarget === row ? activeDropPosition : dropPosition(event, row);
          const targetIndex = category.items.indexOf(path);
          const beforePath = position === "before" ? path : category.items[targetIndex + 1];
          clearDropIndicator();
          moveItem(pathToMove, categoryId, beforePath);
        });

        const label = (
          <span class="fluent-menu-editor__item-label">
            <strong>{item.title}</strong>
            <small>{item.path}</small>
          </span>
        );
        row.append(dragHandle, visibility, label);
        if (canRestoreMenuItem(state.categories, items, path)) {
          const restoreLabel = _("Restore %s to its original menu position").format(item.title);
          const restoreButton = (<button class="fluent-menu-editor__item-reset" type="button" aria-label={restoreLabel} title={restoreLabel} />) as HTMLButtonElement;
          restoreButton.addEventListener("click", () => restoreItem(path));
          row.append(restoreButton);
        }
        return row;
      };

      const renderCategory = (category: SavedMenuCategory): HTMLElement => {
        const card = document.createElement("details");
        card.className = `fluent-menu-editor__category${state.hiddenCategoryIds.has(category.id) ? " is-hidden" : ""}`;
        card.dataset.categoryId = category.id;
        card.open = expandedCategoryIds.has(category.id);
        const header = document.createElement("summary");
        header.className = "fluent-menu-editor__category-header";
        const list = (<div class="fluent-menu-editor__items" data-category-id={category.id} />) as HTMLElement;
        const itemCount = (
          <span class="fluent-menu-editor__category-count" title={_("%d second-level menus").format(category.items.length)}>
            {category.items.length}
          </span>
        );
        const error = (<div class="fluent-menu-editor__category-error" role="alert" />) as HTMLElement;

        let itemsRendered = false;
        const renderItems = (): void => {
          if (itemsRendered) return;

          const renderedItems = category.items.flatMap((path) => {
            const item = renderItem(path, category.id);
            return item ? [item] : [];
          });
          if (renderedItems.length > 0) list.append(...renderedItems);
          else list.appendChild(<div class="fluent-menu-editor__empty">{_("Drop second-level menus here")}</div>);
          itemsRendered = true;
        };
        card.addEventListener("toggle", () => {
          if (card.open) {
            expandedCategoryIds.add(category.id);
            renderItems();
          } else {
            expandedCategoryIds.delete(category.id);
          }
        });
        list.addEventListener("dragover", (event) => {
          if (!event.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) return;
          event.preventDefault();
          list.classList.add("is-drag-over");
        });
        list.addEventListener("dragleave", (event) => {
          if (!list.contains(event.relatedTarget as Node | null)) list.classList.remove("is-drag-over");
        });
        list.addEventListener("drop", (event) => {
          const path = event.dataTransfer?.getData(ITEM_DRAG_TYPE);
          if (!path) return;
          event.preventDefault();
          event.stopPropagation();
          list.classList.remove("is-drag-over");
          moveItem(path, category.id);
        });

        if (card.open) renderItems();

        const canReorderCategories = state.categories.length > 1;
        const originalCategory = defaultCategoriesById.get(category.id);
        const visibility = (<input type="checkbox" checked={!state.hiddenCategoryIds.has(category.id)} aria-label={_("Show %s in the menu").format(category.title)} />) as HTMLInputElement;
        const titleInput = (<input class="fluent-menu-editor__category-title" type="text" value={category.title} aria-label={_("Primary menu title")} />) as HTMLInputElement;

        visibility.addEventListener("change", () => {
          if (visibility.checked) state.hiddenCategoryIds.delete(category.id);
          else state.hiddenCategoryIds.add(category.id);
          card.classList.toggle("is-hidden", !visibility.checked);
          syncValue();
        });

        let titleResetButton: HTMLButtonElement | null = null;
        if (originalCategory) {
          const restoreTitleLabel = _("Restore %s to its original menu name").format(originalCategory.title);
          const button = (<button class="fluent-menu-editor__category-reset" type="button" aria-label={restoreTitleLabel} title={restoreTitleLabel} />) as HTMLButtonElement;
          button.hidden = category.title.trim() === originalCategory.title;
          button.addEventListener("click", () => {
            category.title = originalCategory.title;
            titleInput.value = originalCategory.title;
            button.hidden = true;
            syncValue();
          });
          titleResetButton = button;
        }

        titleInput.addEventListener("input", () => {
          category.title = titleInput.value;
          if (titleResetButton && originalCategory) titleResetButton.hidden = titleInput.value.trim() === originalCategory.title;
          syncValue();
        });
        titleInput.addEventListener("blur", () => {
          category.title = titleInput.value.trim();
          titleInput.value = category.title;
          if (titleResetButton && originalCategory) titleResetButton.hidden = category.title === originalCategory.title;
          syncValue();
        });

        if (canReorderCategories) {
          const dragHandle = (
            <span class="fluent-menu-editor__drag-handle" title={_("Drag to reorder primary menu")}>
              ⋮⋮
            </span>
          ) as HTMLElement;
          dragHandle.draggable = true;
          dragHandle.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData(CATEGORY_DRAG_TYPE, category.id);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
            card.classList.add("is-dragging");
          });
          dragHandle.addEventListener("dragend", () => {
            card.classList.remove("is-dragging");
            clearDropIndicator();
          });
          header.append(dragHandle);
        }

        header.append(visibility, titleInput, itemCount);
        if (titleResetButton) header.append(titleResetButton);
        if (!originalCategory) {
          const deleteButton = (<button class="fluent-menu-editor__category-delete" type="button" aria-label={_("Delete primary menu")} title={_("Delete primary menu")} />) as HTMLButtonElement;
          deleteButton.addEventListener("click", () => {
            const removedItems = [...category.items];
            state.categories = state.categories.filter((candidate) => candidate.id !== category.id);
            state.hiddenCategoryIds.delete(category.id);
            state.pending.categoryMoves = state.pending.categoryMoves.filter(([sourceId, beforeId]) => sourceId !== category.id && beforeId !== category.id);
            state.pending.itemMoves = state.pending.itemMoves.filter(([, targetId]) => targetId !== category.id);
            expandedCategoryIds.delete(category.id);
            for (const path of removedItems) {
              state.pending.itemMoves = state.pending.itemMoves.filter(([pendingPath]) => pendingPath !== path);
              state.categories = restoreMenuItemToOriginalPosition(state.categories, items, path);
            }
            syncValue();
            renderCategories();
          });
          header.append(deleteButton);
        }

        card.addEventListener("dragover", (event) => {
          const isItemDrag = event.dataTransfer?.types.includes(ITEM_DRAG_TYPE);
          const isCategoryDrag = canReorderCategories && event.dataTransfer?.types.includes(CATEGORY_DRAG_TYPE);
          if (isCategoryDrag) {
            event.preventDefault();
            showDropIndicator(card, dropPosition(event, card));
            return;
          }
          if (!isItemDrag || list.contains(event.target as Node | null)) return;

          event.preventDefault();
          showDropIndicator(card, "after");
        });
        card.addEventListener("dragleave", (event) => {
          if (card.contains(event.relatedTarget as Node | null)) return;
          if (activeDropTarget === card) clearDropIndicator();
        });
        card.addEventListener("drop", (event) => {
          const path = event.dataTransfer?.getData(ITEM_DRAG_TYPE);
          if (path) {
            event.preventDefault();
            clearDropIndicator();
            moveItem(path, category.id);
            return;
          }

          const sourceId = event.dataTransfer?.getData(CATEGORY_DRAG_TYPE);
          if (!canReorderCategories || !sourceId || sourceId === category.id) return;
          event.preventDefault();
          const position = activeDropTarget === card ? activeDropPosition : dropPosition(event, card);
          clearDropIndicator();
          state.pending.categoryMoves = state.pending.categoryMoves.filter(([pendingSourceId]) => pendingSourceId !== sourceId);
          state.categories = moveMenuCategory(state.categories, sourceId, category.id, position);
          syncValue();
          renderCategories();
        });

        card.append(header);
        if (error) card.append(error);
        card.append(list);

        const elements: { card: HTMLElement; error?: HTMLElement } = { card };
        if (error) elements.error = error;
        categoryElements.set(category.id, elements);
        return card;
      };

      function renderCategories(): void {
        categoryElements.clear();
        dom.content(
          cards,
          state.categories.map((category) => renderCategory(category)),
        );
        updateValidation();
      }

      const addButton = (
        <button class="btn cbi-button cbi-button-add" type="button">
          {_("Add primary menu")}
        </button>
      ) as HTMLButtonElement;
      const resetButton = (
        <button class="btn cbi-button cbi-button-reset" type="button">
          {_("Restore defaults")}
        </button>
      ) as HTMLButtonElement;

      addButton.addEventListener("click", () => {
        const baseTitle = _("New primary menu");
        const usedTitles = new Set(state.categories.map((category) => normalizeTitle(category.title)));
        let title: string = baseTitle;
        let suffix = 2;
        while (usedTitles.has(normalizeTitle(title))) {
          title = _("New primary menu %d").format(suffix);
          suffix += 1;
        }

        const id = createCategoryId();
        state.categories.push({ id, title, items: [] });
        expandedCategoryIds.add(id);
        syncValue();
        renderCategories();
      });
      resetButton.addEventListener("click", () => {
        state = {
          categories: buildDefaultMenuCategories(tree),
          hiddenCategoryIds: new Set<string>(),
          hiddenItemPaths: new Set<string>(),
          pending: { titles: [], categoryMoves: [], itemMoves: [] },
        };
        expandedCategoryIds.clear();
        syncValue("");
        renderCategories();
      });

      renderCategories();

      return (
        <div class="fluent-menu-editor">
          {hiddenInput}
          {storedValueNotice}
          <div class="fluent-menu-editor__actions">{[addButton, resetButton]}</div>
          {validationSummary}
          {cards}
        </div>
      );
    },

    formvalue(_sectionId: string): string {
      return inputsBySectionId.get(_sectionId)?.value ?? "";
    },

    validate(_sectionId: string, value: unknown): true | string {
      return validateEditorValue(tree, value);
    },
  });
}

export function registerMenuTab(section: LuCI.form.TypedSection, tree: LuCI.ui.menu.MenuNode): void {
  section.tab("menu", _("Menu"));

  const option = section.taboption("menu", createMenuLayoutOption(tree), "menu_layout");
  option.optional = true;
  option.rmempty = true;
}
