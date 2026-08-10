import { buildMenuPresentation, type MenuPresentation } from "./menu-layout";
import { setupApplyChangePreview } from "./utils/apply-change-preview";
import { setupErrorTooltips } from "./utils/error-tooltips";
import { setupIfaceboxTooltips } from "./utils/ifacebox-tooltip";
import { setupLogViewer } from "./utils/log-viewer";
import { setupMacSelector } from "./utils/mac-selector";
import { setupMenuSearch } from "./utils/menu-search";
import { setupSelectionPause } from "./utils/poll-pause";
import { setupFluentSelects } from "./utils/select-dropdown";
import { SlideAnimations } from "./utils/slide-animations";
import { setupTableWrappers } from "./utils/table-wrapper";
import { setupThemeFeatures } from "./utils/theme-features";

interface Module {
  __init__: () => void;
  render: (tree: MenuNode, presentation: MenuPresentation) => void;
  handleMenuExpand: (ev: Event) => void;
  renderMainMenu: (tree: MenuNode, url: string, level?: number) => HTMLElement;
  renderConfiguredMenu: (presentation: MenuPresentation) => HTMLElement;
  renderTabMenu: (tree: MenuNode, url: string, level: number | undefined, hiddenPaths: ReadonlySet<string>) => HTMLElement;
  adjustBrandTextSize: () => void;
  handleSidebarToggle: (ev: Event) => void;
  handleDesktopSidebarToggle: (ev: Event) => void;
}

type MenuNode = LuCI.ui.menu.MenuNode;

function applyDesktopSidebarState(state: "expanded" | "collapsed") {
  document.body.setAttribute("data-sidebar-state", state);
  document.dispatchEvent(new CustomEvent("fluent-sidebar-state-change"));
}

function getDesktopSidebarState(): "expanded" | "collapsed" {
  const storedState = localStorage.getItem("fluent-sidebar-state");

  return storedState === "collapsed" || storedState === "expanded" ? storedState : "expanded";
}
function closeCollapsedPopups() {
  document.querySelectorAll("#mainmenu ul.nav > li > a.menu.popup-open").forEach((node) => {
    node.classList.remove("popup-open");
  });

  document.querySelectorAll("#mainmenu ul.nav > li > ul.slide-menu.popup-open").forEach((node) => {
    const menu = node as HTMLElement;
    menu.classList.remove("popup-open");
    menu.style.display = "none";
    menu.style.top = "";
  });
}

/**
 * Fluent Theme Menu Module
 * Handles rendering and interaction of the main navigation menu and sidebar
 */
const module: Module = {
  /**
   * Initialize the menu module
   * Load menu data and trigger rendering
   */
  async __init__(this: Module) {
    setupApplyChangePreview();
    const [data] = await Promise.all([ui.menu.load(), L.uci.load("fluent")]);
    const configuredValue = L.uci.get_first("fluent", "global", "menu_layout");
    const layoutValue = typeof configuredValue === "string" || Array.isArray(configuredValue) ? configuredValue : null;
    const presentation = buildMenuPresentation(data, layoutValue);
    this.render(data, presentation);
    setupTableWrappers();
    setupSelectionPause();
    setupErrorTooltips();
    setupFluentSelects();
    setupIfaceboxTooltips();
    setupThemeFeatures();
    setupMenuSearch(presentation);
    setupMacSelector();
    setupLogViewer();
  },

  /**
   * Main render function for the menu system
   * @param {Object} tree - Menu tree structure from LuCI
   */
  render(this: Module, tree: MenuNode, presentation: MenuPresentation) {
    let node: MenuNode | undefined = tree;
    let url = "";

    if (presentation.configured) {
      this.renderConfiguredMenu(presentation);
    } else {
      const children = ui.menu.getChildren(tree);

      // Preserve LuCI's active-root sidebar when no Fluent layout is configured.
      for (let i = 0; i < children.length; i++) {
        const isActive = L.env.requestpath.length ? children[i].name === L.env.requestpath[0] : i === 0;

        if (isActive) {
          this.renderMainMenu(children[i], children[i].name);
        }
      }
    }

    // Render tab menu if we're deep enough in the navigation hierarchy.
    if (L.env.dispatchpath.length >= 3) {
      for (let i = 0; i < 3 && node; i++) {
        const path = L.env.dispatchpath[i];
        node = node.children?.[path];
        url = url + (url ? "/" : "") + path;
      }

      if (node) {
        this.renderTabMenu(node, url, undefined, presentation.hiddenPaths);
      }
    }

    // Attach event listeners for sidebar toggle functionality.
    const sidebarToggles = document.querySelectorAll("a.showSide");
    const darkMask = document.querySelector(".darkMask");
    const desktopSidebarToggle = document.querySelector(".sidebar-collapse-toggle");
    const mobileToggleHandler =
      ui.createHandlerFn(this, "handleSidebarToggle") ??
      (() => {
        console.warn("Fluent menu: missing sidebar toggle handler");
      });
    const desktopToggleHandler =
      ui.createHandlerFn(this, "handleDesktopSidebarToggle") ??
      (() => {
        console.warn("Fluent menu: missing desktop sidebar toggle handler");
      });

    sidebarToggles.forEach((toggle) => {
      toggle.addEventListener("click", mobileToggleHandler);
    });
    if (darkMask) {
      darkMask.addEventListener("click", mobileToggleHandler);
    }
    if (desktopSidebarToggle) {
      desktopSidebarToggle.addEventListener("click", desktopToggleHandler);
    }

    if (window.innerWidth > 768) {
      applyDesktopSidebarState(getDesktopSidebarState());
    } else {
      document.body.setAttribute("data-sidebar-state", "expanded");
    }

    window.addEventListener("resize", () => {
      this.adjustBrandTextSize();

      if (window.innerWidth > 768) {
        applyDesktopSidebarState(getDesktopSidebarState());
      } else {
        document.body.setAttribute("data-sidebar-state", "expanded");
      }
    });
    document.addEventListener("click", (event) => {
      if (window.innerWidth <= 768 || document.body.getAttribute("data-sidebar-state") !== "collapsed") {
        return;
      }

      const target = event.target as Node | null;
      const sidebar = document.querySelector("#mainmenu");
      if (target && sidebar?.contains(target)) {
        return;
      }

      closeCollapsedPopups();
    });
  },

  /**
   * Handle menu expand/collapse functionality
   * Manages the sliding animation and active states of menu items
   * @param {Event} ev - Click event from menu item
   */
  handleMenuExpand(ev: Event) {
    const target = ev.currentTarget as HTMLElement | null;
    if (!target) return;

    const slide = target.parentNode as HTMLElement;
    const slideMenu = target.nextElementSibling as HTMLElement | null;
    const isCollapsedDesktop = window.innerWidth > 768 && document.body.getAttribute("data-sidebar-state") === "collapsed";
    let shouldCollapse = false;

    const openMenus = document.querySelectorAll(isCollapsedDesktop ? ".main .main-left .nav > li > ul.slide-menu.popup-open" : ".main .main-left .nav > li > ul.slide-menu.active");
    openMenus.forEach((ulNode) => {
      const ul = ulNode as HTMLElement;

      if (!shouldCollapse && ul === slideMenu) {
        shouldCollapse = true;
      }

      ul.classList.remove("popup-open", "active");
      ul.previousElementSibling?.classList.remove("popup-open", "active");

      SlideAnimations.stop(ul);

      if (isCollapsedDesktop) {
        ul.style.display = "none";
        ul.style.top = "";
      } else {
        SlideAnimations.slideUp(ul, "fast");
      }
    });

    if (!slideMenu) {
      return;
    }

    if (!shouldCollapse) {
      const slideMenuElement = slide?.querySelector(".slide-menu") as HTMLElement | null;
      if (slideMenuElement) {
        slideMenu.classList.add(isCollapsedDesktop ? "popup-open" : "active");
        target.classList.add(isCollapsedDesktop ? "popup-open" : "active");

        if (isCollapsedDesktop) {
          SlideAnimations.stop(slideMenuElement);
          slideMenuElement.style.display = "block";

          const targetRect = target.getBoundingClientRect();
          const popupHeight = slideMenuElement.offsetHeight;
          const viewportPadding = 8;
          const maxTop = Math.max(viewportPadding, window.innerHeight - popupHeight - viewportPadding);
          const alignedTop = targetRect.top - 8;

          slideMenuElement.style.top = `${Math.min(maxTop, Math.max(viewportPadding, alignedTop))}px`;
        } else {
          slideMenuElement.style.top = "";
          SlideAnimations.slideDown(slideMenuElement, "fast");
        }

        slideMenuElement.querySelectorAll("li > a").forEach((node) => {
          const link = node as HTMLAnchorElement;
          link.addEventListener(
            "click",
            () => {
              closeCollapsedPopups();
            },
            { once: true },
          );
        });
      }

      target.blur();
    }

    document.dispatchEvent(new CustomEvent("fluent-menu-expand"));

    ev.preventDefault();
    ev.stopPropagation();
  },

  /**
   * Render the main navigation menu
   * Creates hierarchical menu structure with active states and click handlers
   * @param {Object} tree - Menu tree node to render
   * @param {string} url - Base URL for menu items
   * @param {number} level - Current nesting level (0-based)
   * @returns {Element} - Generated menu element
   */
  renderMainMenu(this: Module, tree: MenuNode, url: string, level?: number): HTMLElement {
    const currentLevel = (level || 0) + 1;
    const parentTitle = level && tree.title ? tree.title.replace(/ /g, "_") : undefined;
    const menuContainer = <ul class={level ? "slide-menu" : "nav"} data-parent={parentTitle || undefined}></ul>;
    const children = ui.menu.getChildren(tree);

    // Don't render empty menus or menus deeper than 2 levels
    if (children.length === 0 || currentLevel > 2) {
      // biome-ignore lint/complexity/noUselessFragments: LuCI TSX requires DocumentFragment for empty returns
      return <></>;
    }

    // Generate menu items for each child
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isActive = L.env.dispatchpath[currentLevel] === child.name && L.env.dispatchpath[currentLevel - 1] === tree.name;

      // Recursively render submenu
      const submenu = this.renderMainMenu(child, `${url}/${child.name}`, currentLevel);
      const hasChildren = submenu.children.length > 0;

      // Determine CSS classes based on state
      let slideClass: string | null = hasChildren ? "slide" : null;
      const menuClass = hasChildren ? "menu" : "item";

      if (isActive) {
        menuContainer.classList.add("active");
        slideClass = slideClass ? `${slideClass} active` : "null active";
      }

      const menuClassCombined = isActive ? `${menuClass} active` : menuClass;

      // Create menu item with link and submenu
      const menuItem = (
        <li class={slideClass ?? undefined}>
          <a
            href={L.url(url, child.name)}
            onclick={currentLevel === 1 ? ui.createHandlerFn(this, "handleMenuExpand") : null}
            class={menuClassCombined}
            data-title={(child.title || "").replace(/ /g, "_")}
          >
            {currentLevel === 1 || currentLevel === 2 ? <span class="menu-icon"></span> : null}
            <span class="menu-label">{_(child.title || "")}</span>
          </a>
          {submenu}
        </li>
      );

      menuContainer.appendChild(menuItem);
    }

    // Append to main menu container if this is the top level
    if (currentLevel === 1) {
      const mainMenuElement = document.querySelector("#mainmenu");
      if (mainMenuElement) {
        (mainMenuElement as HTMLElement).appendChild(menuContainer);
        (mainMenuElement as HTMLElement).style.display = "";
        this.adjustBrandTextSize();
      }
    }

    return menuContainer;
  },

  renderConfiguredMenu(this: Module, presentation: MenuPresentation): HTMLElement {
    const menuContainer = (<ul class="nav"></ul>) as HTMLElement;

    for (const category of presentation.categories) {
      if (presentation.hiddenCategoryIds.has(category.id)) continue;
      const visibleItems = category.items.filter((item) => !presentation.hiddenPaths.has(item.path));
      if (!category.primary && visibleItems.length === 0) continue;

      const submenu = (<ul class="slide-menu" data-parent={category.title.replace(/ /g, "_")} />) as HTMLElement;
      let isActive = false;
      for (const item of visibleItems) {
        const itemIsActive = item.pathSegments.every((segment, index) => L.env.dispatchpath[index] === segment);
        isActive ||= itemIsActive;
        submenu.appendChild(
          <li class={itemIsActive ? "active" : undefined}>
            <a href={L.url(item.path)} class={`item${itemIsActive ? " active" : ""}`} data-title={item.rawTitle.replace(/ /g, "_")}>
              <span class="menu-icon"></span>
              <span class="menu-label">{item.title}</span>
            </a>
          </li>,
        );
      }
      if (isActive) submenu.classList.add("active");

      if (category.primary && L.env.dispatchpath.length <= 2) {
        isActive ||= category.primary.pathSegments.every((segment, index) => L.env.dispatchpath[index] === segment);
      }

      const hasChildren = visibleItems.length > 0;
      const href = category.primary?.path ?? visibleItems[0]?.path ?? "#";
      const rawTitle = category.primary?.rawTitle ?? category.title;
      const itemClass = `${hasChildren ? "slide" : ""}${isActive ? " active" : ""}`.trim() || undefined;
      menuContainer.appendChild(
        <li class={itemClass}>
          <a
            href={href === "#" ? href : L.url(href)}
            onclick={hasChildren ? ui.createHandlerFn(this, "handleMenuExpand") : null}
            class={`${hasChildren ? "menu" : "item"}${isActive ? " active" : ""}`}
            data-title={rawTitle.replace(/ /g, "_")}
          >
            <span class="menu-icon"></span>
            <span class="menu-label">{category.title}</span>
          </a>
          {hasChildren ? submenu : null}
        </li>,
      );
    }

    const mainMenuElement = document.querySelector("#mainmenu") as HTMLElement | null;
    if (mainMenuElement) {
      mainMenuElement.appendChild(menuContainer);
      mainMenuElement.style.display = "";
      this.adjustBrandTextSize();
    }

    return menuContainer;
  },

  /**
   * Render tab navigation menu
   * Creates horizontal tab menu for deeper navigation levels
   * @param {Object} tree - Menu tree node to render
   * @param {string} url - Base URL for tab items
   * @param {number} level - Current nesting level (0-based)
   * @returns {Element} - Generated tab menu element
   */
  renderTabMenu(this: Module, tree: MenuNode, url: string, level: number | undefined, hiddenPaths: ReadonlySet<string>): HTMLElement {
    const primaryPath = L.env.dispatchpath.slice(0, 2).join("/");
    const itemPath = L.env.dispatchpath.slice(0, 3).join("/");
    if (hiddenPaths.has(primaryPath) || hiddenPaths.has(itemPath)) {
      // biome-ignore lint/complexity/noUselessFragments: LuCI TSX requires DocumentFragment for empty returns
      return <></>;
    }
    const container = document.querySelector("#tabmenu") as HTMLElement | null;
    const currentLevel = (level || 0) + 1;
    const tabContainer = <ul class="tabs"></ul>;
    const children = ui.menu.getChildren(tree);
    let activeNode: MenuNode | null = null;

    // Don't render empty tab menus
    if (children.length === 0) {
      // biome-ignore lint/complexity/noUselessFragments: LuCI TSX requires DocumentFragment for empty returns
      return <></>;
    }

    // Generate tab items for each child
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const isActive = L.env.dispatchpath[currentLevel + 2] === child.name;
      const activeClass = isActive ? " active" : "";
      const className = `tabmenu-item-${child.name}${activeClass}`;

      const tabItem = (
        <li class={className}>
          <a href={L.url(url, child.name)}>{_(child.title || "")}</a>
        </li>
      );

      tabContainer.appendChild(tabItem);

      // Store reference to active node for recursive rendering
      if (isActive) {
        activeNode = child;
      }
    }

    // Append tab container to main tab menu element
    if (container) {
      container.appendChild(tabContainer);
      container.style.display = "";

      // Recursively render nested tab menus if there's an active node
      if (activeNode) {
        const nestedTabs = this.renderTabMenu(activeNode, `${url}/${activeNode.name}`, currentLevel, hiddenPaths);
        if (nestedTabs.children.length > 0) {
          container.appendChild(nestedTabs);
        }
      }
    }

    return tabContainer;
  },

  /**
   * Adjust brand text font size to fit container (prevent overflow)
   */
  adjustBrandTextSize() {
    const brandText = document.querySelector(".sidenav-header .brand-text") as HTMLElement | null;
    if (brandText) {
      const container = brandText.parentElement as HTMLElement | null;
      if (container) {
        const maxW = container.clientWidth - 32; // subtract icon + gap
        if (maxW > 0) {
          let fontSize = 16;
          brandText.style.fontSize = `${fontSize}px`;
          while (brandText.scrollWidth > maxW && fontSize > 9) {
            fontSize -= 0.5;
            brandText.style.fontSize = `${fontSize}px`;
          }
        }
      }
    }
  },

  /**
   * Handle sidebar toggle functionality
   * Toggles the mobile/responsive sidebar menu visibility
   * @param {Event} _ev - Click event from sidebar toggle button or dark mask
   */
  handleSidebarToggle(this: Module, _ev: Event) {
    const showSideButtons = document.querySelectorAll("a.showSide");
    const sidebar = document.querySelector("#mainmenu") as HTMLElement | null;
    const darkMask = document.querySelector(".darkMask") as HTMLElement | null;
    const scrollbarArea = document.querySelector(".main-right") as HTMLElement | null;

    // Check if any required elements are missing
    if (showSideButtons.length === 0 || !sidebar || !darkMask || !scrollbarArea) {
      console.warn("Fluent menu: sidebar toggle elements are unavailable");
      return;
    }

    const isActive = Array.from(showSideButtons).some((button) => button.classList.contains("active"));

    if (isActive) {
      showSideButtons.forEach((button) => {
        button.classList.remove("active");
      });
      sidebar.classList.remove("active");
      scrollbarArea.classList.remove("active");
      darkMask.classList.remove("active");
    } else {
      showSideButtons.forEach((button) => {
        button.classList.add("active");
      });
      sidebar.classList.add("active");
      scrollbarArea.classList.add("active");
      darkMask.classList.add("active");
      this.adjustBrandTextSize();
    }
  },

  handleDesktopSidebarToggle(this: Module, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();

    if (window.innerWidth <= 768) {
      return;
    }

    const currentState = document.body.getAttribute("data-sidebar-state") === "collapsed" ? "collapsed" : "expanded";
    const nextState = currentState === "collapsed" ? "expanded" : "collapsed";

    closeCollapsedPopups();

    localStorage.setItem("fluent-sidebar-state", nextState);
    applyDesktopSidebarState(nextState);

    if (nextState === "expanded") {
      this.adjustBrandTextSize();
    }
  },
};

export const main = baseclass.extend(module);
