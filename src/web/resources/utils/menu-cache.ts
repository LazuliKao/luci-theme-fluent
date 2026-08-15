type MenuNode = LuCI.ui.menu.MenuNode;

const MENU_CACHE_KEY = "fluent_menu_cache";
const SIDEBAR_HTML_CACHE_KEY = "fluent_sidebar_html";
const TABMENU_HTML_CACHE_KEY = "fluent_tabmenu_html";

/**
 * Read cached menu node tree from sessionStorage synchronously
 */
export function getCachedMenu(): { tree: MenuNode; raw: string } | null {
  try {
    const raw = sessionStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return null;
    const tree = JSON.parse(raw) as MenuNode;
    if (tree && typeof tree === "object") {
      return { tree, raw };
    }
  } catch (_) {}
  return null;
}

/**
 * Save menu node tree into sessionStorage
 */
export function saveMenuCache(data: MenuNode): string | null {
  try {
    const raw = JSON.stringify(data);
    sessionStorage.setItem(MENU_CACHE_KEY, raw);
    return raw;
  } catch (_) {
    return null;
  }
}

/**
 * Persist current rendered innerHTML of mainmenu and tabmenu for instant frame-0 HTML hydration
 */
export function saveRenderedHtmlCache(): void {
  try {
    const mainmenu = document.querySelector("#mainmenu");
    if (mainmenu) {
      sessionStorage.setItem(SIDEBAR_HTML_CACHE_KEY, mainmenu.innerHTML);
    }
    const tabmenu = document.querySelector("#tabmenu");
    const pathKey = Array.isArray(L?.env?.dispatchpath) ? L.env.dispatchpath.slice(0, 2).join("_") : "";
    if (tabmenu && tabmenu.children.length > 0 && pathKey) {
      sessionStorage.setItem(`${TABMENU_HTML_CACHE_KEY}_${pathKey}`, tabmenu.innerHTML);
    }
  } catch (_) {}
}

/**
 * Resolve menu layout configuration synchronously from server-injected window / DOM attributes
 */
export function getResolvedMenuLayout(): string | string[] | null | undefined {
  const win = window as unknown as { _fluent_menu_layout?: string | string[] | null };
  if (win._fluent_menu_layout !== undefined) {
    return win._fluent_menu_layout;
  }

  const bodyLayout = document.body?.getAttribute?.("data-menu-layout");
  if (bodyLayout) {
    try {
      const parsed = JSON.parse(bodyLayout);
      if (typeof parsed === "string" || Array.isArray(parsed) || parsed === null) {
        return parsed;
      }
    } catch (_) {}
  }

  return undefined;
}
