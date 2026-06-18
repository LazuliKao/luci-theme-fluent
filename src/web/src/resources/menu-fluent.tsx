import { setupErrorTooltips } from "./utils/error-tooltips";
import { setupSelectionPause } from "./utils/poll-pause";
import { SlideAnimations } from "./utils/slide-animations";
import { setupFluentSelects } from "./utils/select-dropdown";

interface Module {
  __init__: () => void;
  render: (tree: MenuNode) => void;
  handleMenuExpand: (ev: Event) => void;
  renderMainMenu: (tree: MenuNode, url: string, level?: number) => HTMLElement;
  renderTabMenu: (tree: MenuNode, url: string, level?: number) => HTMLElement;
  adjustBrandTextSize: () => void;
  handleSidebarToggle: (ev: Event) => void;
}

type MenuNode = LuCI.ui.menu.MenuNode;

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
    const data = await ui.menu.load();
    this.render(data);
    setupSelectionPause();
    setupErrorTooltips();
    setupFluentSelects();
  },

  /**
   * Main render function for the menu system
   * @param {Object} tree - Menu tree structure from LuCI
   */
  render(this: Module, tree: MenuNode) {
    let node: MenuNode | undefined = tree;
    let url = "";
    const children = ui.menu.getChildren(tree);

    // Find and render the active main menu item
    for (let i = 0; i < children.length; i++) {
      const isActive = L.env.requestpath.length ? children[i].name === L.env.requestpath[0] : i === 0;

      if (isActive) {
        this.renderMainMenu(children[i], children[i].name);
      }
    }

    // Render tab menu if we're deep enough in the navigation hierarchy
    if (L.env.dispatchpath.length >= 3) {
      for (let i = 0; i < 3 && node; i++) {
        const path = L.env.dispatchpath[i];
        node = node.children?.[path];
        url = url + (url ? "/" : "") + L.env.dispatchpath[i];
      }

      if (node) {
        this.renderTabMenu(node, url);
      }
    }

    // Attach event listeners for sidebar toggle functionality
    const sidebarToggle = document.querySelector("a.showSide");
    const darkMask = document.querySelector(".darkMask");

    if (sidebarToggle) {
      sidebarToggle.addEventListener(
        "click",
        ui.createHandlerFn(this, "handleSidebarToggle") ??
          (() => {
            console.warn("Sidebar toggle handler not found");
          }),
      );
    }
    if (darkMask) {
      darkMask.addEventListener(
        "click",
        ui.createHandlerFn(this, "handleSidebarToggle") ??
          (() => {
            console.warn("Sidebar toggle handler not found");
          }),
      );
    }
    window.addEventListener("resize", L.bind(this.adjustBrandTextSize, this));
  },

  /**
   * Handle menu expand/collapse functionality
   * Manages the sliding animation and active states of menu items
   * @param {Event} ev - Click event from menu item
   */
  handleMenuExpand(ev: Event) {
    const target = ev.target as HTMLElement;
    if (!target) return;
    const slide = target.parentNode as HTMLElement;
    const slideMenu = target.nextElementSibling as HTMLElement | null;
    let shouldCollapse = false;

    // Close all currently active submenus
    const activeMenus = document.querySelectorAll(".main .main-left .nav > li > ul.active");
    activeMenus.forEach((ulNode) => {
      const ul = ulNode as HTMLElement;
      // Stop any running animations and slide up
      SlideAnimations.stop(ul);
      // Remove active classes immediately when starting slideUp animation
      ul.classList.remove("active");
      ul.previousElementSibling?.classList.remove("active");
      SlideAnimations.slideUp(ul, "fast");

      // Check if we're clicking on an already open menu (should collapse it)
      if (!shouldCollapse && ul === slideMenu) {
        shouldCollapse = true;
      }
    });

    // Exit if there's no submenu to show
    if (!slideMenu) {
      return;
    }

    // Open the submenu if it's not already open
    if (!shouldCollapse) {
      // Find the slide menu within the slide element
      const slideMenuElement = slide?.querySelector(".slide-menu") as HTMLElement | null;
      if (slideMenuElement) {
        // Add active classes immediately when starting slideDown animation
        slideMenu.classList.add("active");
        target.classList.add("active");
        SlideAnimations.slideDown(slideMenuElement, "fast");
      }
      target.blur(); // Remove focus from the clicked element
    }

    // Prevent default link behavior and event bubbling
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
    const menuContainer = <ul class={level ? "slide-menu" : "nav"}></ul>;
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
      const menuClass = hasChildren ? "menu" : "food";

      if (isActive) {
        menuContainer.classList.add("active");
        slideClass = slideClass ? `${slideClass} active` : "null active";
      }

      // Create menu item with link and submenu
      const menuItem = (
        <li class={slideClass ?? undefined}>
          <a href={L.url(url, child.name)} onclick={currentLevel === 1 ? ui.createHandlerFn(this, "handleMenuExpand") : null} class={menuClass} data-title={(child.title || "").replace(/ /g, "_")}>
            {_(child.title || "")}
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

  /**
   * Render tab navigation menu
   * Creates horizontal tab menu for deeper navigation levels
   * @param {Object} tree - Menu tree node to render
   * @param {string} url - Base URL for tab items
   * @param {number} level - Current nesting level (0-based)
   * @returns {Element} - Generated tab menu element
   */
  renderTabMenu(this: Module, tree: MenuNode, url: string, level?: number): HTMLElement {
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
      const className = _("tabmenu-item-%s %s").format(child.name, activeClass);

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
        const nestedTabs = this.renderTabMenu(activeNode, `${url}/${activeNode.name}`, currentLevel);
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
    const showSideButton = document.querySelector("a.showSide") as HTMLElement | null;
    const sidebar = document.querySelector("#mainmenu") as HTMLElement | null;
    const darkMask = document.querySelector(".darkMask") as HTMLElement | null;
    const scrollbarArea = document.querySelector(".main-right") as HTMLElement | null;

    // Check if any required elements are missing
    if (!showSideButton || !sidebar || !darkMask || !scrollbarArea) {
      console.warn("Sidebar toggle elements not found");
      return;
    }

    // Toggle sidebar visibility and related states
    if (showSideButton.classList.contains("active")) {
      // Close sidebar
      showSideButton.classList.remove("active");
      sidebar.classList.remove("active");
      scrollbarArea.classList.remove("active");
      darkMask.classList.remove("active");
    } else {
      // Open sidebar
      showSideButton.classList.add("active");
      sidebar.classList.add("active");
      scrollbarArea.classList.add("active");
      darkMask.classList.add("active");
      this.adjustBrandTextSize();
    }
  },
};

export const main = baseclass.extend(module);
