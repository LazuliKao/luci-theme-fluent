/**
 * menu-search.ts
 * Sidebar menu search — Ctrl+K / / to focus, type to filter, Enter/click to navigate.
 * Searches the FULL menu tree (all top-level branches), not just the active one.
 */

interface SearchResult {
  node: LuCI.ui.menu.MenuNode;
  url: string;
  /** Translated breadcrumb trail, e.g. ["Status", "Overview"] */
  breadcrumb: string[];
}

// ── Core search ──

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Recursively walk the entire menu tree and collect matching nodes.
 * Matches on node.title (case-insensitive substring).
 */
function searchMenu(root: LuCI.ui.menu.MenuNode, query: string): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const results: SearchResult[] = [];

  function walk(node: LuCI.ui.menu.MenuNode, url: string, breadcrumb: string[]) {
    const children = ui.menu.getChildren(node);
    for (const child of children) {
      const childUrl = url ? `${url}/${child.name}` : child.name;
      const childBreadcrumb = [...breadcrumb];

      // Check all ancestors' titles for the path display
      const title = child.title || child.name || "";
      const translatedTitle = title ? _(title) : "";
      if (title) {
        childBreadcrumb.push(translatedTitle);
      }

      // Match against translated title (what the user sees) or raw title (fallback)
      if (
        (translatedTitle && normalize(translatedTitle).includes(q)) ||
        (title && normalize(title).includes(q))
      ) {
        results.push({ node: child, url: childUrl, breadcrumb: [...childBreadcrumb] });
      }

      walk(child, childUrl, childBreadcrumb);
    }
  }

  walk(root, "", []);
  return results;
}

// ── UI ──

const SEARCH_BOX_CLASS = "fluent-menu-search";
const OVERLAY_CLASS = "fluent-menu-search-overlay";

function createSearchInput(root: LuCI.ui.menu.MenuNode): { input: HTMLInputElement; overlay: HTMLDivElement } {
  // Container
  const container = document.createElement("div");
  container.className = SEARCH_BOX_CLASS;

  // Search icon (magnifying glass via inline SVG in CSS ::before)
  const input = document.createElement("input");
  input.type = "search";
  input.className = "fluent-menu-search-input";
  input.placeholder = _("Search menu…") + "  Ctrl+K";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", _("Search menu items"));

  // Results overlay
  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  overlay.style.display = "none";

  container.appendChild(input);
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
      more.textContent = _("and {count} more…").replace("{count}", String(results.length - 20));
      list.appendChild(more);
    }

    overlay.appendChild(list);
    overlay.style.display = "";

    // Position overlay below the search input
    const rect = input.getBoundingClientRect();
    overlay.style.left = "0";
    overlay.style.top = rect.height + "px";
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
    const results = searchMenu(root, q);
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

  return { input, overlay };
}

// ── Public API ──

/**
 * Initialize menu search: injects search UI into the sidebar
 * and registers keyboard shortcuts.
 */
export function setupMenuSearch(root: LuCI.ui.menu.MenuNode): void {
  const searchSlot = document.querySelector(".header__search-slot");
  if (!searchSlot) return;

  // Clear existing placeholder or previous search instance
  searchSlot.innerHTML = "";

  const { input, overlay } = createSearchInput(root);

  searchSlot.appendChild(input.closest(`.${SEARCH_BOX_CLASS}`)!);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      input.focus();
      input.select();
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
      input.focus();
      input.select();
      return;
    }

    // Escape to close
    if (e.key === "Escape" && document.activeElement === input) {
      input.blur();
    }
  });
}