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

type MenuDragSource = { kind: "category"; categoryId: string } | { kind: "item"; path: string };

type MenuDropTarget =
  | { kind: "category"; categoryId: string; element: HTMLElement; position: MenuDropPosition }
  | { kind: "item"; categoryId: string; element: HTMLElement; path: string; position: MenuDropPosition }
  | { kind: "item-category"; categoryId: string; element: HTMLElement; position: MenuDropPosition }
  | { kind: "item-list"; categoryId: string; element: HTMLElement };

interface ActiveDragProjection {
  placeholder: HTMLElement;
  source: MenuDragSource;
  sourceElement: HTMLElement;
}

interface ActivePointerDrag {
  handle: HTMLElement;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  preview: HTMLElement;
  source: MenuDragSource;
  sourceElement: HTMLElement;
}

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
      let activeDropIndicator: HTMLElement | null = null;
      let activeDropList: HTMLElement | null = null;
      let activeDropTarget: MenuDropTarget | null = null;
      let activeDragProjection: ActiveDragProjection | null = null;
      let activePointerDrag: ActivePointerDrag | null = null;
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

      const reduceMotion = (): boolean => document.body.dataset.reduceMotion === "true";

      const clearDropDecorations = (): void => {
        activeDropIndicator?.classList.remove("is-drop-before", "is-drop-after");
        activeDropIndicator = null;
        activeDropList?.classList.remove("is-drag-over");
        activeDropList = null;
      };

      const showDropIndicator = (target: HTMLElement, position: MenuDropPosition): void => {
        clearDropDecorations();
        activeDropIndicator = target;
        target.classList.toggle("is-drop-before", position === "before");
        target.classList.toggle("is-drop-after", position === "after");
      };

      const projectionElements = (source: MenuDragSource): HTMLElement[] => {
        const selector = source.kind === "category" ? ".fluent-menu-editor__category" : ".fluent-menu-editor__item";
        return Array.from(cards.querySelectorAll<HTMLElement>(selector)).filter((element) => element !== activeDragProjection?.sourceElement && element.getClientRects().length > 0);
      };

      const animationTiming = (): { duration: number; easing: string } => {
        const styles = getComputedStyle(document.documentElement);
        const durationValue = styles.getPropertyValue("--fluent-duration-fast").trim();
        const parsedDuration = Number.parseFloat(durationValue);
        const duration = Number.isFinite(parsedDuration) ? parsedDuration * (durationValue.endsWith("ms") ? 1 : 1000) : 0;
        return { duration, easing: styles.getPropertyValue("--fluent-easing-standard").trim() };
      };

      const movePlaceholder = (parent: HTMLElement, reference: ChildNode | null): void => {
        const projection = activeDragProjection;
        if (!projection || reduceMotion()) return;
        if (projection.placeholder.parentElement === parent && projection.placeholder.nextSibling === reference) return;

        const elements = projectionElements(projection.source);
        const previousPositions = new Map(elements.map((element) => [element, element.getBoundingClientRect()]));
        parent.insertBefore(projection.placeholder, reference);
        const timing = animationTiming();

        for (const element of elements) {
          const previous = previousPositions.get(element);
          if (!previous || !element.isConnected) continue;
          const current = element.getBoundingClientRect();
          const offsetX = previous.left - current.left;
          const offsetY = previous.top - current.top;
          if (offsetX === 0 && offsetY === 0) continue;
          element.getAnimations().forEach((animation) => {
            animation.cancel();
          });
          element.animate([{ transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: "translate(0, 0)" }], timing);
        }
      };

      const beginDragProjection = (source: MenuDragSource, sourceElement: HTMLElement): void => {
        if (reduceMotion()) return;
        const bounds = sourceElement.getBoundingClientRect();
        const modifier = source.kind === "category" ? "category" : "item";
        const placeholder = document.createElement("div");
        placeholder.className = `fluent-menu-editor__drop-placeholder fluent-menu-editor__drop-placeholder--${modifier}`;
        placeholder.style.height = `${bounds.height}px`;
        placeholder.setAttribute("aria-hidden", "true");
        sourceElement.parentElement?.insertBefore(placeholder, sourceElement);
        const projection = { placeholder, source, sourceElement };
        activeDragProjection = projection;
        sourceElement.classList.add("is-drag-source");
      };

      const clearDragProjection = (): void => {
        const projection = activeDragProjection;
        activeDragProjection = null;
        if (!projection) return;
        projection.placeholder.remove();
        projection.sourceElement.classList.remove("is-drag-source");
      };

      const pointerInsidePlaceholder = (clientX: number, clientY: number): boolean => {
        const placeholder = activeDragProjection?.placeholder;
        if (!placeholder?.isConnected) return false;
        const bounds = placeholder.getBoundingClientRect();
        return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
      };

      const sameDropTarget = (left: MenuDropTarget | null, right: MenuDropTarget): boolean => {
        if (!left || left.kind !== right.kind || left.categoryId !== right.categoryId) return false;
        if (left.kind === "item" && right.kind === "item") return left.path === right.path && left.position === right.position;
        if (left.kind === "category" && right.kind === "category") return left.categoryId === right.categoryId && left.position === right.position;
        return left.kind === "item-list" || (left.kind === "item-category" && right.kind === "item-category" && left.position === right.position);
      };

      const itemDropTargetAtPoint = (list: HTMLElement, clientX: number, clientY: number): MenuDropTarget | null => {
        const categoryId = list.dataset.categoryId;
        if (!categoryId) return null;

        const positionedItems = Array.from(list.querySelectorAll<HTMLElement>(":scope > .fluent-menu-editor__item"))
          .filter((element) => element !== activeDragProjection?.sourceElement && !element.classList.contains("is-dragging") && element.getClientRects().length > 0)
          .map((element) => ({ element, path: element.dataset.itemPath, bounds: element.getBoundingClientRect() }))
          .filter((item): item is { element: HTMLElement; path: string; bounds: DOMRect } => Boolean(item.path));
        if (positionedItems.length === 0) return { kind: "item-list", categoryId, element: list };

        const rows: Array<{ items: typeof positionedItems; top: number; bottom: number }> = [];
        for (const item of positionedItems) {
          const row = rows.at(-1);
          if (!row || item.bounds.top >= row.bottom - 1) {
            rows.push({ items: [item], top: item.bounds.top, bottom: item.bounds.bottom });
          } else {
            row.items.push(item);
            row.top = Math.min(row.top, item.bounds.top);
            row.bottom = Math.max(row.bottom, item.bounds.bottom);
          }
        }

        const itemTarget = (item: (typeof positionedItems)[number], position: MenuDropPosition): MenuDropTarget => ({
          kind: "item",
          categoryId,
          element: item.element,
          path: item.path,
          position,
        });
        const firstItem = positionedItems[0];
        if (clientY < rows[0].top) return itemTarget(firstItem, "before");

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex];
          if (clientY <= row.bottom) {
            if (row.items.length === 1) {
              const item = row.items[0];
              return itemTarget(item, clientY < item.bounds.top + item.bounds.height / 2 ? "before" : "after");
            }

            const closestItem = row.items.reduce((closest, item) =>
              Math.abs(clientX - item.bounds.left - item.bounds.width / 2) < Math.abs(clientX - closest.bounds.left - closest.bounds.width / 2) ? item : closest,
            );
            const itemCenter = closestItem.bounds.left + closestItem.bounds.width / 2;
            const before = getComputedStyle(list).direction === "rtl" ? clientX > itemCenter : clientX < itemCenter;
            return itemTarget(closestItem, before ? "before" : "after");
          }

          const nextRow = rows[rowIndex + 1];
          if (nextRow && clientY < nextRow.top) return itemTarget(nextRow.items[0], "before");
        }

        return { kind: "item-list", categoryId, element: list };
      };

      const projectDropTarget = (target: MenuDropTarget): void => {
        const projection = activeDragProjection;
        if (!projection) return;

        if (target.kind === "category" || target.kind === "item") {
          const reference = target.position === "before" ? target.element : target.element.nextSibling;
          const parent = target.element.parentElement;
          if (parent) movePlaceholder(parent, reference);
          return;
        }

        const list = target.kind === "item-list" ? target.element : target.element.querySelector<HTMLElement>(".fluent-menu-editor__items");
        if (list) movePlaceholder(list, null);
      };

      const resetProjection = (): void => {
        const projection = activeDragProjection;
        const parent = projection?.sourceElement.parentElement;
        if (projection && parent) movePlaceholder(parent, projection.sourceElement);
      };

      const clearDropTarget = (reset = true): void => {
        clearDropDecorations();
        activeDropTarget = null;
        if (reset) resetProjection();
      };

      const setDropTarget = (target: MenuDropTarget): void => {
        if (sameDropTarget(activeDropTarget, target)) return;
        clearDropDecorations();
        activeDropTarget = target;

        if (reduceMotion()) {
          if (target.kind === "item-list") {
            activeDropList = target.element;
            target.element.classList.add("is-drag-over");
          } else {
            showDropIndicator(target.element, target.position);
          }
          return;
        }

        if (target.kind === "item-category") {
          activeDropList = target.element;
          target.element.classList.add("is-drag-over");
        }
        projectDropTarget(target);
      };

      const moveItem = (path: string, targetCategoryId: string, beforePath?: string): void => {
        if (!itemsByPath.has(path) || !state.categories.some((category) => category.id === targetCategoryId)) return;

        state.pending.itemMoves = state.pending.itemMoves.filter(([pendingPath]) => pendingPath !== path);
        state.categories = moveMenuItem(state.categories, path, targetCategoryId, beforePath);
        expandedCategoryIds.add(targetCategoryId);
        syncValue();
        renderCategories();
      };

      const clearPointerDrag = (): void => {
        const drag = activePointerDrag;
        if (!drag) return;

        activePointerDrag = null;
        drag.sourceElement.classList.remove("is-dragging");
        drag.preview.remove();
        clearDropTarget();
        clearDragProjection();
        if (drag.handle.hasPointerCapture(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
      };

      const findNearestCategory = (clientX: number, clientY: number, excludeCategoryId?: string): HTMLElement | null => {
        const categories = Array.from(cards.querySelectorAll<HTMLElement>(".fluent-menu-editor__category")).filter((cat) => {
          const id = cat.dataset.categoryId;
          return id && id !== excludeCategoryId && !cat.classList.contains("is-dragging");
        });

        let nearest: HTMLElement | null = null;
        let minDistance = Number.MAX_VALUE;

        for (const cat of categories) {
          const rect = cat.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distance = Math.hypot(clientX - centerX, clientY - centerY);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = cat;
          }
        }

        return nearest;
      };

      const updatePointerDropTarget = (source: MenuDragSource, event: PointerEvent): void => {
        if (pointerInsidePlaceholder(event.clientX, event.clientY)) return;
        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element) {
          clearDropTarget();
          return;
        }

        if (source.kind === "category") {
          let category = element.closest<HTMLElement>(".fluent-menu-editor__category");
          if (!category) {
            category = findNearestCategory(event.clientX, event.clientY, source.categoryId);
          }
          const categoryId = category?.dataset.categoryId;
          if (!category || !categoryId || categoryId === source.categoryId) {
            clearDropTarget();
            return;
          }

          setDropTarget({ kind: "category", categoryId, element: category, position: dropPosition(event, category) });
          return;
        }

        const item = element.closest<HTMLElement>(".fluent-menu-editor__item");
        const path = item?.dataset.itemPath;
        const itemList = item?.closest<HTMLElement>(".fluent-menu-editor__items");
        const itemCategoryId = itemList?.dataset.categoryId;
        if (item && path && itemList && itemCategoryId) {
          if (path === source.path) {
            clearDropTarget();
            return;
          }

          setDropTarget({ kind: "item", categoryId: itemCategoryId, element: item, path, position: dropPosition(event, item) });
          return;
        }

        const list = element.closest<HTMLElement>(".fluent-menu-editor__items");
        if (list) {
          const target = itemDropTargetAtPoint(list, event.clientX, event.clientY);
          if (target) setDropTarget(target);
          else clearDropTarget();
          return;
        }

        let category = element.closest<HTMLElement>(".fluent-menu-editor__category");
        if (!category) {
          category = findNearestCategory(event.clientX, event.clientY);
        }
        const targetCategoryId = category?.dataset.categoryId;
        if (category && targetCategoryId) {
          setDropTarget({ kind: "item-category", categoryId: targetCategoryId, element: category, position: "after" });
        } else {
          clearDropTarget();
        }
      };

      const commitDrop = (source: MenuDragSource, target: MenuDropTarget): void => {
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

        if (target.kind !== "category") return;
        state.pending.categoryMoves = state.pending.categoryMoves.filter(([sourceId]) => sourceId !== source.categoryId);
        state.categories = moveMenuCategory(state.categories, source.categoryId, target.categoryId, target.position);
        syncValue();
        renderCategories();
      };

      const completePointerDrag = (): void => {
        const drag = activePointerDrag;
        const target = activeDropTarget;
        clearPointerDrag();
        if (drag && target) commitDrop(drag.source, target);
      };

      const beginPointerDrag = (event: PointerEvent, source: MenuDragSource, sourceElement: HTMLElement, handle: HTMLElement): void => {
        if (activePointerDrag || (event.pointerType !== "mouse" && event.pointerType !== "pen" && event.pointerType !== "touch")) return;

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

        const drag: ActivePointerDrag = {
          handle,
          offsetX: event.clientX - bounds.left,
          offsetY: event.clientY - bounds.top,
          pointerId: event.pointerId,
          preview,
          source,
          sourceElement,
        };
        activePointerDrag = drag;
        sourceElement.classList.add("is-dragging");
        beginDragProjection(source, sourceElement);
        preview.style.left = `${event.clientX - drag.offsetX}px`;
        preview.style.top = `${event.clientY - drag.offsetY}px`;
        handle.setPointerCapture(event.pointerId);
      };

      const movePointerDrag = (event: PointerEvent): void => {
        const drag = activePointerDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.preventDefault();
        drag.preview.style.left = `${event.clientX - drag.offsetX}px`;
        drag.preview.style.top = `${event.clientY - drag.offsetY}px`;
        updatePointerDropTarget(drag.source, event);
      };

      const endPointerDrag = (event: PointerEvent, shouldCommit: boolean): void => {
        const drag = activePointerDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;

        event.preventDefault();
        if (shouldCommit) {
          updatePointerDropTarget(drag.source, event);
          completePointerDrag();
        } else {
          clearPointerDrag();
        }
      };

      const bindPointerDrag = (handle: HTMLElement, source: MenuDragSource, sourceElement: HTMLElement): void => {
        handle.addEventListener("pointerdown", (event) => beginPointerDrag(event, source, sourceElement, handle));
        handle.addEventListener("pointermove", movePointerDrag);
        handle.addEventListener("pointerup", (event) => endPointerDrag(event, true));
        handle.addEventListener("pointercancel", (event) => endPointerDrag(event, false));
        handle.addEventListener("lostpointercapture", () => {
          if (activePointerDrag?.handle === handle) clearPointerDrag();
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
        const dragSource: MenuDragSource = { kind: "item", path };
        bindPointerDrag(dragHandle, dragSource, row);
        visibility.addEventListener("change", () => {
          if (visibility.checked) state.hiddenItemPaths.delete(path);
          else state.hiddenItemPaths.add(path);
          row.classList.toggle("is-hidden", !visibility.checked);
          syncValue();
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
          const dragSource: MenuDragSource = { kind: "category", categoryId: category.id };
          const dragHandle = (<span class="fluent-menu-editor__drag-handle" title={_("Drag to reorder primary menu")} />) as HTMLElement;
          bindPointerDrag(dragHandle, dragSource, card);
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

        card.append(header);
        if (error) card.append(error);
        card.append(list);

        const elements: { card: HTMLElement; error?: HTMLElement } = { card };
        if (error) elements.error = error;
        categoryElements.set(category.id, elements);
        return card;
      };

      const getInvalidItemsCount = (): number => {
        let count = state.pending.titles.length + state.pending.itemTitles.length + state.pending.categoryMoves.length + state.pending.itemMoves.length;

        for (const path of state.hiddenItemPaths) {
          if (!itemsByPath.has(path)) count += 1;
        }

        const categoryIds = new Set(state.categories.map((c) => c.id));
        for (const id of state.hiddenCategoryIds) {
          if (!categoryIds.has(id)) count += 1;
        }

        return count;
      };

      const cleanButton = (<button class="btn cbi-button" type="button" />) as HTMLButtonElement;

      const updateCleanButtonState = (): void => {
        const count = getInvalidItemsCount();
        cleanButton.disabled = count === 0;
        if (count > 0) {
          cleanButton.textContent = _("Clean up invalid items (%d)").format(count);
        } else {
          cleanButton.textContent = _("Clean up invalid items");
        }
      };

      cleanButton.addEventListener("click", () => {
        const count = getInvalidItemsCount();
        if (count === 0) return;

        L.ui.showModal(
          _("Clean up invalid items"),
          (
            <div class="fluent-menu-editor__rename-dialog">
              <p>{_("Are you sure you want to clean up %d invalid/uninstalled menu items or rules?").format(count)}</p>
              <div class="right">
                <button type="button" class="btn" onclick={() => L.ui.hideModal()}>
                  {_("Cancel")}
                </button>
                <button
                  type="button"
                  class="btn cbi-button-save"
                  onclick={() => {
                    state.pending = { titles: [], itemTitles: [], categoryMoves: [], itemMoves: [] };

                    const nextHiddenItemPaths = new Set<string>();
                    for (const path of state.hiddenItemPaths) {
                      if (itemsByPath.has(path)) nextHiddenItemPaths.add(path);
                    }
                    state.hiddenItemPaths = nextHiddenItemPaths;

                    const nextHiddenCategoryIds = new Set<string>();
                    const categoryIds = new Set(state.categories.map((c) => c.id));
                    for (const id of state.hiddenCategoryIds) {
                      if (categoryIds.has(id)) nextHiddenCategoryIds.add(id);
                    }
                    state.hiddenCategoryIds = nextHiddenCategoryIds;

                    syncValue();
                    renderCategories();
                    L.ui.hideModal();
                  }}
                >
                  {_("Clean up")}
                </button>
              </div>
            </div>
          ) as HTMLElement,
        );
      });

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
        updateCleanButtonState();

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
          <div class="fluent-menu-editor__actions">{[cleanButton, addButton, resetButton]}</div>
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
