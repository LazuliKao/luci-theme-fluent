/**
 * Sidebar menu search — Ctrl+K / / to focus, type to filter, Enter/click to navigate.
 * Searches the same Fluent presentation model rendered by the sidebar.
 */

import type { MenuPresentation } from "../menu-layout";

export interface SearchResult {
  node: LuCI.ui.menu.MenuNode;
  url: string;
  breadcrumb: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ");
}

function titleMatches(rawTitle: string, translatedTitle: string, query: string): boolean {
  return normalize(translatedTitle).includes(query) || normalize(rawTitle).includes(query);
}

export function searchMenu(presentation: MenuPresentation, query: string): SearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const results: SearchResult[] = [];

  const walk = (node: LuCI.ui.menu.MenuNode, url: string, breadcrumb: string[]): void => {
    for (const child of ui.menu.getChildren(node)) {
      if (!child.satisfied) continue;

      const childUrl = `${url}/${child.name}`;
      const rawTitle = child.title || child.name || "";
      const translatedTitle = rawTitle ? _(rawTitle) : "";
      const childBreadcrumb = rawTitle ? [...breadcrumb, translatedTitle] : breadcrumb;

      if (titleMatches(rawTitle, translatedTitle, normalizedQuery)) {
        results.push({ node: child, url: childUrl, breadcrumb: [...childBreadcrumb] });
      }

      walk(child, childUrl, childBreadcrumb);
    }
  };

  for (const category of presentation.categories) {
    if (presentation.hiddenCategoryIds.has(category.id)) continue;
    if (category.primary && titleMatches(category.primary.rawTitle, category.title, normalizedQuery)) {
      results.push({ node: category.primary.node, url: category.primary.path, breadcrumb: [category.title] });
    }

    for (const item of category.items) {
      if (presentation.hiddenPaths.has(item.path)) continue;

      const breadcrumb = [category.title, item.title];
      if (titleMatches(item.rawTitle, item.title, normalizedQuery)) {
        results.push({ node: item.node, url: item.path, breadcrumb });
      }
      walk(item.node, item.path, breadcrumb);
    }
  }

  return results;
}

// ── UI ──

const SEARCH_BOX_CLASS = "fluent-menu-search";
const OVERLAY_CLASS = "fluent-menu-search-overlay";

let menuSearchKeydownListener: ((event: KeyboardEvent) => void) | undefined;

function createSearchInput(presentation: MenuPresentation): { container: HTMLDivElement; input: HTMLInputElement; overlay: HTMLDivElement } {
  // Container
  const container = document.createElement("div");
  container.className = SEARCH_BOX_CLASS;

  // Search icon (magnifying glass via inline SVG in CSS ::before)
  const input = document.createElement("input");
  input.type = "search";
  input.className = "fluent-menu-search-input";
  input.placeholder = _("Search menu...");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", _("Search menu items"));

  // Hotkey hint
  const hotkey = document.createElement("span");
  hotkey.className = "fluent-menu-search-hotkey";
  hotkey.textContent = "Ctrl+K";

  // Results overlay
  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.style.display = "none";

  container.appendChild(input);
  container.appendChild(hotkey);
  container.appendChild(overlay);

  // ── State ──
  let selectedIndex = -1;
  let lastResults: SearchResult[] = [];

  function closeOverlay() {
    overlay.style.display = "none";
    overlay.innerHTML = "";
    selectedIndex = -1;
    lastResults = [];
  }

  function renderResults(results: SearchResult[]) {
    lastResults = results;
    overlay.innerHTML = "";
    selectedIndex = -1;

    if (results.length === 0) {
      overlay.style.display = "none";
      return;
    }

    const list = document.createElement("ul");
    list.className = "fluent-menu-search-list";
    list.setAttribute("role", "listbox");

    // Limit to first 20 for performance
    const maxResults = Math.min(results.length, 20);

    for (let i = 0; i < maxResults; i++) {
      const r = results[i];
      const item = document.createElement("li");
      item.className = "fluent-menu-search-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-index", String(i));

      // Main label
      const label = document.createElement("span");
      label.className = "fluent-menu-search-label";
      label.textContent = _(r.node.title || r.node.name || "");

      // Breadcrumb path
      if (r.breadcrumb.length > 1) {
        const path = document.createElement("span");
        path.className = "fluent-menu-search-path";
        path.textContent = r.breadcrumb.slice(0, -1).join(" → ");
        item.appendChild(path);
      }

      item.appendChild(label);

      // Click handler
      item.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent blur before navigation
        navigateTo(r);
      });

      item.addEventListener("click", () => navigateTo(r));

      list.appendChild(item);
    }

    if (results.length > 20) {
      const more = document.createElement("li");
      more.className = "fluent-menu-search-more";
      more.textContent = _("and %d more...").format(results.length - 20);
      list.appendChild(more);
    }

    overlay.appendChild(list);
    overlay.style.display = "";

    // Position overlay below the search input
    const rect = input.getBoundingClientRect();
    overlay.style.left = "0";
    overlay.style.top = `${rect.height}px`;
  }

  function navigateTo(result: SearchResult) {
    closeOverlay();
    input.blur();
    window.location.href = L.url(result.url);
  }

  function updateSelection(direction: 1 | -1) {
    const items = overlay.querySelectorAll<HTMLElement>(".fluent-menu-search-item");
    if (items.length === 0) return;

    // Remove previous
    if (selectedIndex >= 0 && items[selectedIndex]) {
      items[selectedIndex].classList.remove("selected");
      items[selectedIndex].removeAttribute("aria-selected");
    }

    selectedIndex += direction;
    if (selectedIndex < 0) selectedIndex = items.length - 1;
    if (selectedIndex >= items.length) selectedIndex = 0;

    items[selectedIndex].classList.add("selected");
    items[selectedIndex].setAttribute("aria-selected", "true");
    items[selectedIndex].scrollIntoView({ block: "nearest" });
  }

  // ── Event handlers ──

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (!q) {
      closeOverlay();
      return;
    }
    const results = searchMenu(presentation, q);
    renderResults(results);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeOverlay();
      input.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      updateSelection(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      updateSelection(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const items = overlay.querySelectorAll<HTMLElement>(".fluent-menu-search-item");
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].click();
      } else if (lastResults.length > 0) {
        navigateTo(lastResults[0]);
      }
      return;
    }
  });

  // Close on blur (with delay for click)
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!overlay.contains(document.activeElement)) {
        closeOverlay();
      }
    }, 150);
  });

  // Prevent overlay close when clicking inside overlay
  overlay.addEventListener("mousedown", (e) => e.preventDefault());

  return { container, input, overlay };
}

// ── Public API ──

/**
 * Initialize menu search: injects search UI into the sidebar
 * and registers keyboard shortcuts.
 */
export function setupMenuSearch(presentation: MenuPresentation): void {
  if (menuSearchKeydownListener) {
    document.removeEventListener("keydown", menuSearchKeydownListener);
    menuSearchKeydownListener = undefined;
  }

  const inputs: HTMLInputElement[] = [];

  const setupSlot = (selector: string) => {
    const slot = document.querySelector(selector);
    if (!slot) return;

    slot.innerHTML = "";
    const { container, input } = createSearchInput(presentation);
    slot.appendChild(container);
    inputs.push(input);
  };

  setupSlot(".header__search-slot");
  setupSlot(".sidebar__search-slot");

  if (inputs.length === 0) return;

  // Keyboard shortcuts
  menuSearchKeydownListener = (e) => {
    // Helper to focus the first visible input
    const focusVisibleInput = () => {
      for (const input of inputs) {
        if (input.offsetParent !== null) {
          input.focus();
          input.select();
          return;
        }
      }
    };

    // Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      focusVisibleInput();
      return;
    }

    // `/` to focus (not in a text input / contenteditable)
    if (
      e.key === "/" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      document.activeElement?.tagName !== "INPUT" &&
      document.activeElement?.tagName !== "TEXTAREA" &&
      !document.activeElement?.getAttribute("contenteditable")
    ) {
      e.preventDefault();
      focusVisibleInput();
      return;
    }

    // Escape to close
    const activeInput = inputs.find((input) => document.activeElement === input);
    if (e.key === "Escape" && activeInput) {
      activeInput.blur();
    }
  };

  document.addEventListener("keydown", menuSearchKeydownListener);
}
