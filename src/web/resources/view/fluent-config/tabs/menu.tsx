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
  itemTitles: Map<string, string>;
  pending: PendingMenuLayout;
}

type TouchDragSource = { kind: "category"; categoryId: string } | { kind: "item"; path: string };

type TouchDropTarget =
  | { kind: "category"; categoryId: string; element: HTMLElement; position: MenuDropPosition }
  | { kind: "item"; categoryId: string; element: HTMLElement; path: string; position: MenuDropPosition }
  | { kind: "item-category"; categoryId: string; element: HTMLElement; position: MenuDropPosition }
  | { kind: "item-list"; categoryId: string; element: HTMLElement };

interface ActiveTouchDrag {
  handle: HTMLElement;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  preview: HTMLElement;
  source: TouchDragSource;
  sourceElement: HTMLElement;
}

const CATEGORY_DRAG_TYPE = "application/x-fluent-menu-category";
const ITEM_DRAG_TYPE = "application/x-fluent-menu-item";

function dropPosition(event: Pick<MouseEvent, "clientY">, target: HTMLElement): MenuDropPosition {
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
      itemTitles: new Map(),
      pending: { titles: [], itemTitles: [], categoryMoves: [], itemMoves: [] },
    };
  }

  const resolved = resolveMenuLayout(tree, parsed);
  return {
    categories: resolved.categories,
    hiddenCategoryIds: resolved.hiddenCategoryIds,
    hiddenItemPaths: resolved.hiddenItemPaths,
    itemTitles: new Map(resolved.itemTitles),
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
      let activeTouchDrag: ActiveTouchDrag | null = null;
      let activeTouchDropList: HTMLElement | null = null;
      let activeTouchDropTarget: TouchDropTarget | null = null;
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

      const syncValue = (value = serializeMenuLayout(tree, state.categories, state.hiddenCategoryIds, state.hiddenItemPaths, state.pending, state.itemTitles)): void => {
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
      const clearTouchDropTarget = (): void => {
        clearDropIndicator();
        activeTouchDropList?.classList.remove("is-drag-over");
        activeTouchDropList = null;
        activeTouchDropTarget = null;
      };

      const clearTouchDrag = (): void => {
        const drag = activeTouchDrag;
        if (!drag) return;

        activeTouchDrag = null;
        drag.sourceElement.classList.remove("is-dragging");
        drag.preview.remove();
        clearTouchDropTarget();
        if (drag.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
      };

      const setTouchDropTarget = (target: TouchDropTarget): void => {
        clearTouchDropTarget();
        activeTouchDropTarget = target;
        if (target.kind === "item-list") {
          activeTouchDropList = target.element;
          target.element.classList.add("is-drag-over");
          return;
        }

        showDropIndicator(target.element, target.position);
      };

      const updateTouchDropTarget = (source: TouchDragSource, event: PointerEvent): void => {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element) {
          clearTouchDropTarget();
          return;
        }

        if (source.kind === "category") {
          const category = element.closest<HTMLElement>(".fluent-menu-editor__category");
          const categoryId = category?.dataset.categoryId;
          if (!category || !categoryId || categoryId === source.categoryId) {
            clearTouchDropTarget();
            return;
          }

          setTouchDropTarget({ kind: "category", categoryId, element: category, position: dropPosition(event, category) });
          return;
        }

        const item = element.closest<HTMLElement>(".fluent-menu-editor__item");
        const path = item?.dataset.itemPath;
        const itemList = item?.closest<HTMLElement>(".fluent-menu-editor__items");
        const itemCategoryId = itemList?.dataset.categoryId;
        if (item && path && itemList && itemCategoryId) {
          if (path === source.path) {
            clearTouchDropTarget();
            return;
          }

          setTouchDropTarget({ kind: "item", categoryId: itemCategoryId, element: item, path, position: dropPosition(event, item) });
          return;
        }

        const list = element.closest<HTMLElement>(".fluent-menu-editor__items");
        const categoryId = list?.dataset.categoryId;
        if (list && categoryId) {
          setTouchDropTarget({ kind: "item-list", categoryId, element: list });
          return;
        }

        const category = element.closest<HTMLElement>(".fluent-menu-editor__category");
        const targetCategoryId = category?.dataset.categoryId;
        if (category && targetCategoryId) {
          setTouchDropTarget({ kind: "item-category", categoryId: targetCategoryId, element: category, position: "after" });
        } else {
          clearTouchDropTarget();
        }
      };

      const completeTouchDrag = (): void => {
        const drag = activeTouchDrag;
        const target = activeTouchDropTarget;
        clearTouchDrag();
        if (!drag || !target) return;
        const source = drag.source;

        if (source.kind === "item") {
          if (target.kind === "item") {
            const category = state.categories.find((candidate) => candidate.id === target.categoryId);
            if (!category) return;

            const targetIndex = category.items.indexOf(target.path);
            if (targetIndex < 0) return;
            const beforePath = target.position === "before" ? target.path : category.items[targetIndex + 1];
            moveItem(source.path, target.categoryId, beforePath);
          } else if (target.kind === "item-category" || target.kind === "item-list") {
            moveItem(source.path, target.categoryId);
          }
          return;
        }

        if (source.kind !== "category" || target.kind !== "category") return;
        state.pending.categoryMoves = state.pending.categoryMoves.filter(([sourceId]) => sourceId !== source.categoryId);
        state.categories = moveMenuCategory(state.categories, source.categoryId, target.categoryId, target.position);
        syncValue();
        renderCategories();
      };

      const beginTouchDrag = (event: PointerEvent, source: TouchDragSource, sourceElement: HTMLElement, handle: HTMLElement): void => {
        if (event.pointerType !== "touch" || activeTouchDrag) return;

        event.preventDefault();
        event.stopPropagation();
        const bounds = sourceElement.getBoundingClientRect();
        const preview = sourceElement.cloneNode(true) as HTMLElement;
        preview.classList.add("fluent-menu-editor__drag-preview");
        preview.setAttribute("aria-hidden", "true");
        if (source.kind === "category") {
          preview.querySelector(".fluent-menu-editor__category-error")?.remove();
          preview.querySelector(".fluent-menu-editor__items")?.remove();
        }
        preview.style.width = `${bounds.width}px`;
        document.body.append(preview);

        const drag: ActiveTouchDrag = {
          handle,
          offsetX: event.clientX - bounds.left,
          offsetY: event.clientY - bounds.top,
          pointerId: event.pointerId,
          preview,
          source,
          sourceElement,
        };
        activeTouchDrag = drag;
        sourceElement.classList.add("is-dragging");
        preview.style.left = `${event.clientX - drag.offsetX}px`;
        preview.style.top = `${event.clientY - drag.offsetY}px`;
        handle.setPointerCapture(event.pointerId);
      };

      const moveTouchDrag = (event: PointerEvent): void => {
        const drag = activeTouchDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.preventDefault();
        drag.preview.style.left = `${event.clientX - drag.offsetX}px`;
        drag.preview.style.top = `${event.clientY - drag.offsetY}px`;
        updateTouchDropTarget(drag.source, event);
      };

      const endTouchDrag = (event: PointerEvent, shouldCommit: boolean): void => {
        const drag = activeTouchDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.preventDefault();
        if (shouldCommit) {
          updateTouchDropTarget(drag.source, event);
          completeTouchDrag();
        } else {
          clearTouchDrag();
        }
      };

      const bindTouchDrag = (handle: HTMLElement, source: TouchDragSource, sourceElement: HTMLElement): void => {
        handle.addEventListener("pointerdown", (event) => beginTouchDrag(event, source, sourceElement, handle));
        handle.addEventListener("pointermove", moveTouchDrag);
        handle.addEventListener("pointerup", (event) => endTouchDrag(event, true));
        handle.addEventListener("pointercancel", (event) => endTouchDrag(event, false));
        handle.addEventListener("lostpointercapture", () => {
          if (activeTouchDrag?.handle === handle) clearTouchDrag();
        });
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
        const dragHandle = (<span class="fluent-menu-editor__drag-handle" title={_("Drag to move second-level menu")} />) as HTMLElement;
        const visibility = (<input type="checkbox" checked={!state.hiddenItemPaths.has(path)} aria-label={_("Show %s in the menu").format(item.title)} />) as HTMLInputElement;
        dragHandle.draggable = true;

        dragHandle.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData(ITEM_DRAG_TYPE, path);
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            const rect = row.getBoundingClientRect();
            event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top);
          }
          row.classList.add("is-dragging");
        });
        dragHandle.addEventListener("dragend", () => {
          row.classList.remove("is-dragging");
          clearDropIndicator();
        });
        bindTouchDrag(dragHandle, { kind: "item", path }, row);
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

        const displayTitle = state.itemTitles.get(path) ?? item.title;
        const editItemTitleLabel = _("Edit");
        const editItemTitleButton = (<button class="fluent-menu-editor__category-edit" type="button" aria-label={editItemTitleLabel} title={editItemTitleLabel} />) as HTMLButtonElement;

        editItemTitleButton.addEventListener("click", () => {
          const currentTitle = state.itemTitles.get(path) ?? item.title;
          const titleInputId = `${this.cbid(sectionId)}-item-${path.replace(/\//g, "-")}-title`;
          const titleInput = (<input id={titleInputId} class="cbi-input-text" type="text" value={currentTitle} aria-label={_("Second-level menu title")} />) as HTMLInputElement;
          const validation = (<p class="cbi-value-description" role="alert" hidden />) as HTMLParagraphElement;
          let saveButton: HTMLButtonElement | null = null;

          const validateTitle = (): boolean => {
            const title = titleInput.value.trim();
            const message = title ? "" : _("Menu title cannot be empty.");
            validation.textContent = message;
            validation.hidden = !message;
            titleInput.classList.toggle("cbi-input-invalid", Boolean(message));
            if (saveButton) saveButton.disabled = Boolean(message);
            return !message;
          };

          titleInput.addEventListener("input", validateTitle);
          saveButton = (
            <button
              type="button"
              class="btn cbi-button-save"
              onclick={() => {
                if (!validateTitle()) return;
                const newTitle = titleInput.value.trim();
                if (newTitle === item.title) state.itemTitles.delete(path);
                else state.itemTitles.set(path, newTitle);
                syncValue();
                renderCategories();
                L.ui.hideModal();
              }}
            >
              {_("Save")}
            </button>
          ) as HTMLButtonElement;

          const restoreOriginalLabel = _("Restore to original title");
          const restoreOriginalButton = (
            <button
              class="fluent-menu-editor__item-reset"
              type="button"
              aria-label={restoreOriginalLabel}
              title={restoreOriginalLabel}
              onclick={() => {
                titleInput.value = item.title;
                validateTitle();
                titleInput.focus();
              }}
            />
          );

          L.ui.showModal(
            _("Second-level menu title"),
            <div class="fluent-menu-editor__rename-dialog">
              <label htmlFor={titleInputId}>{_("Second-level menu title")}</label>
              <div class="fluent-menu-editor__rename-control">
                {titleInput}
                {restoreOriginalButton}
              </div>
              {validation}
              <div class="right">
                <button type="button" class="btn" onclick={() => L.ui.hideModal()}>
                  {_("Cancel")}
                </button>
                {saveButton}
              </div>
            </div>,
          );
          validateTitle();
          requestAnimationFrame(() => {
            titleInput.focus();
            titleInput.select();
          });
        });

        const label = (
          <span class="fluent-menu-editor__item-label">
            <strong>{displayTitle}</strong>
            <small>{item.path}</small>
          </span>
        );
        row.append(dragHandle, editItemTitleButton, label);
        if (canRestoreMenuItem(state.categories, items, path)) {
          const restoreLabel = _("Restore %s to its original menu position").format(item.title);
          const restoreButton = (<button class="fluent-menu-editor__item-reset" type="button" aria-label={restoreLabel} title={restoreLabel} />) as HTMLButtonElement;
          restoreButton.addEventListener("click", () => restoreItem(path));
          row.append(restoreButton);
        }
        row.append(visibility);
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
        const categoryTitle = (<span class="fluent-menu-editor__category-name">{category.title}</span>) as HTMLElement;
        const editTitleLabel = _("Edit");
        const editTitleButton = (<button class="fluent-menu-editor__category-edit" type="button" aria-label={editTitleLabel} title={editTitleLabel} />) as HTMLButtonElement;

        const openRenameDialog = (): void => {
          const titleInputId = `${this.cbid(sectionId)}-${category.id}-title`;
          const titleInput = (<input id={titleInputId} class="cbi-input-text" type="text" value={category.title} aria-label={_("Primary menu title")} />) as HTMLInputElement;
          const validation = (<p class="cbi-value-description" role="alert" hidden />) as HTMLParagraphElement;
          let saveButton: HTMLButtonElement | null = null;

          const validateTitle = (): boolean => {
            const title = titleInput.value.trim();
            const categories = state.categories.map((candidate) => (candidate.id === category.id ? { ...candidate, title } : candidate));
            const message = titleErrors(categories).get(category.id) ?? "";
            validation.textContent = message;
            validation.hidden = !message;
            titleInput.classList.toggle("cbi-input-invalid", Boolean(message));
            if (saveButton) saveButton.disabled = Boolean(message);
            return !message;
          };

          titleInput.addEventListener("input", validateTitle);
          saveButton = (
            <button
              type="button"
              class="btn cbi-button-save"
              onclick={() => {
                if (!validateTitle()) return;
                category.title = titleInput.value.trim();
                syncValue();
                renderCategories();
                L.ui.hideModal();
              }}
            >
              {_("Save")}
            </button>
          ) as HTMLButtonElement;

          const restoreTitleLabel = originalCategory ? _("Restore %s to its original menu name").format(originalCategory.title) : "";
          const restoreTitleButton = originalCategory ? (
            <button
              class="fluent-menu-editor__item-reset"
              type="button"
              aria-label={restoreTitleLabel}
              title={restoreTitleLabel}
              onclick={() => {
                titleInput.value = originalCategory.title;
                validateTitle();
                titleInput.focus();
              }}
            />
          ) : null;

          L.ui.showModal(
            _("Primary menu title"),
            <>
              <div class="fluent-menu-editor__rename-dialog">
                <label htmlFor={titleInputId}>{_("Primary menu title")}</label>
                <div class="fluent-menu-editor__rename-control">
                  {titleInput}
                  {restoreTitleButton}
                </div>
                {validation}
              </div>
              <div class="right">
                <button type="button" class="btn" onclick={() => L.ui.hideModal()}>
                  {_("Cancel")}
                </button>
                {saveButton}
              </div>
            </>,
          );
          validateTitle();
          requestAnimationFrame(() => {
            titleInput.focus();
            titleInput.select();
          });
        };

        editTitleButton.addEventListener("click", openRenameDialog);

        visibility.addEventListener("change", () => {
          if (visibility.checked) state.hiddenCategoryIds.delete(category.id);
          else state.hiddenCategoryIds.add(category.id);
          card.classList.toggle("is-hidden", !visibility.checked);
          syncValue();
        });

        if (canReorderCategories) {
          const dragHandle = (<span class="fluent-menu-editor__drag-handle" title={_("Drag to reorder primary menu")} />) as HTMLElement;
          dragHandle.draggable = true;
          dragHandle.addEventListener("dragstart", (event) => {
            event.dataTransfer?.setData(CATEGORY_DRAG_TYPE, category.id);
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
              const rect = card.getBoundingClientRect();
              event.dataTransfer.setDragImage(card, event.clientX - rect.left, event.clientY - rect.top);
            }
            card.classList.add("is-dragging");
          });
          dragHandle.addEventListener("dragend", () => {
            card.classList.remove("is-dragging");
            clearDropIndicator();
          });
          bindTouchDrag(dragHandle, { kind: "category", categoryId: category.id }, card);
          header.append(dragHandle);
        }

        header.append(editTitleButton, categoryTitle, itemCount);
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
        header.append(visibility);

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
        const listScrollPositions = new Map<string, number>();
        for (const list of cards.querySelectorAll<HTMLElement>(".fluent-menu-editor__items")) {
          const categoryId = list.dataset.categoryId;
          if (categoryId) listScrollPositions.set(categoryId, list.scrollTop);
        }
        const pageScrollLeft = window.scrollX;
        const pageScrollTop = window.scrollY;

        categoryElements.clear();
        dom.content(
          cards,
          state.categories.map((category) => renderCategory(category)),
        );
        updateValidation();

        requestAnimationFrame(() => {
          for (const list of cards.querySelectorAll<HTMLElement>(".fluent-menu-editor__items")) {
            const categoryId = list.dataset.categoryId;
            const scrollTop = categoryId ? listScrollPositions.get(categoryId) : undefined;
            if (scrollTop != null) list.scrollTop = scrollTop;
          }
          window.scrollTo(pageScrollLeft, pageScrollTop);
        });
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
          itemTitles: new Map(),
          pending: { titles: [], itemTitles: [], categoryMoves: [], itemMoves: [] },
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
