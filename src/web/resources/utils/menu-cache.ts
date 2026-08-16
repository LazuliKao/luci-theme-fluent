type MenuNode = LuCI.ui.menu.MenuNode;

const MENU_CACHE_KEY = "fluent_menu_cache";
const SIDEBAR_HTML_CACHE_KEY = "fluent_sidebar_html";
const TABMENU_HTML_CACHE_KEY = "fluent_tabmenu_html";

function getScopedCacheKey(cacheKey: string): string | null {
  const scope = document.body?.getAttribute("data-menu-cache-scope");
  return scope ? `${cacheKey}_${scope}` : null;
}

/**
 * Read cached menu node tree from sessionStorage synchronously
 */
export function getCachedMenu(): { tree: MenuNode; raw: string } | null {
  try {
    const cacheKey = getScopedCacheKey(MENU_CACHE_KEY);
    if (!cacheKey) return null;
    const raw = sessionStorage.getItem(cacheKey);
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
    const cacheKey = getScopedCacheKey(MENU_CACHE_KEY);
    if (!cacheKey) return null;
    const raw = JSON.stringify(data);
    sessionStorage.setItem(cacheKey, raw);
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
    const sidebarCacheKey = getScopedCacheKey(SIDEBAR_HTML_CACHE_KEY);
    if (mainmenu && sidebarCacheKey) {
      sessionStorage.setItem(sidebarCacheKey, mainmenu.innerHTML);
    }
    const tabmenu = document.querySelector("#tabmenu");
    const tabCacheKey = getScopedCacheKey(TABMENU_HTML_CACHE_KEY);
    const pathKey = Array.isArray(L?.env?.dispatchpath) ? JSON.stringify(L.env.dispatchpath) : "";
    if (tabmenu && tabmenu.children.length > 0 && tabCacheKey && pathKey) {
      sessionStorage.setItem(`${tabCacheKey}_${pathKey}`, tabmenu.innerHTML);
    }
  } catch (_) {}
}

/**
 * Resolve menu layout configuration synchronously from the server-rendered DOM attribute.
 */
export function getResolvedMenuLayout(): string | string[] | null | undefined {
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
