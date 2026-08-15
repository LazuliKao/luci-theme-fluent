export function applyDesktopSidebarState(state: "expanded" | "collapsed") {
  document.body.setAttribute("data-sidebar-state", state);
  document.dispatchEvent(new CustomEvent("fluent-sidebar-state-change"));
}

export function getDesktopSidebarState(): "expanded" | "collapsed" {
  try {
    const storedState = localStorage.getItem("fluent-sidebar-state");
    return storedState === "collapsed" || storedState === "expanded" ? storedState : "expanded";
  } catch (_) {
    return "expanded";
  }
}

export function closeCollapsedPopups() {
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
 * Adjust brand text font size to fit container (prevent overflow)
 */
export function adjustBrandTextSize() {
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
}

/**
 * Handle mobile sidebar drawer toggle
 */
export function handleSidebarToggle(_ev?: Event) {
  const showSideButtons = document.querySelectorAll("a.showSide");
  const sidebar = document.querySelector("#mainmenu") as HTMLElement | null;
  const darkMask = document.querySelector(".darkMask") as HTMLElement | null;
  const scrollbarArea = document.querySelector(".main-right") as HTMLElement | null;

  if (showSideButtons.length === 0 || !sidebar || !darkMask || !scrollbarArea) {
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
    adjustBrandTextSize();
  }
}

/**
 * Handle desktop sidebar collapse/expand toggle
 */
export function handleDesktopSidebarToggle(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();

  if (window.innerWidth <= 768) {
    return;
  }

  const currentState = document.body.getAttribute("data-sidebar-state") === "collapsed" ? "collapsed" : "expanded";
  const nextState = currentState === "collapsed" ? "expanded" : "collapsed";

  closeCollapsedPopups();

  try {
    localStorage.setItem("fluent-sidebar-state", nextState);
  } catch (_) {}
  applyDesktopSidebarState(nextState);

  if (nextState === "expanded") {
    adjustBrandTextSize();
  }
}

let sidebarEventsBound = false;

/**
 * Attach global event listeners for sidebar interaction (idempotent, runs once)
 */
export function initSidebarController(handlerTarget: unknown) {
  if (sidebarEventsBound) {
    return;
  }
  sidebarEventsBound = true;

  const sidebarToggles = document.querySelectorAll("a.showSide");
  const darkMask = document.querySelector(".darkMask");
  const desktopSidebarToggle = document.querySelector(".sidebar-collapse-toggle");

  const mobileToggleHandler =
    ui.createHandlerFn(handlerTarget, "handleSidebarToggle") ??
    (() => {
      handleSidebarToggle();
    });

  const desktopToggleHandler =
    ui.createHandlerFn(handlerTarget, "handleDesktopSidebarToggle") ??
    ((ev: Event) => {
      handleDesktopSidebarToggle(ev);
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
    adjustBrandTextSize();

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

    const clickNode = event.target as Node | null;
    const sidebar = document.querySelector("#mainmenu");
    if (clickNode && sidebar?.contains(clickNode)) {
      return;
    }

    closeCollapsedPopups();
  });
}
