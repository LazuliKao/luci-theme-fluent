import { getEffectiveDocumentDirection, getRectInlineStart, getViewportInlineSize, setInlineCssCustomProperties } from "./direction";

/**
 * Monitor native select elements and dynamically replace/transform them
 * into FluentUI-style custom dropdowns (using standard .cbi-dropdown classes).
 */
let selectDropdownListenersRegistered = false;

function updateOpenDropdownPositions() {
  document.querySelectorAll(".fluent-custom-select[open]").forEach((dropdown) => {
    if (!(dropdown instanceof HTMLElement)) return;

    const selectEl = dropdown.previousElementSibling;
    if (selectEl instanceof HTMLSelectElement) {
      updateDropdownPosition(dropdown, selectEl);
    }
  });
}

function registerSelectDropdownListeners() {
  if (selectDropdownListenersRegistered) return;

  selectDropdownListenersRegistered = true;
  window.addEventListener("scroll", updateOpenDropdownPositions, true);
  window.addEventListener("resize", updateOpenDropdownPositions);
}

export function setupFluentSelects() {
  const isEnabled = document.body.getAttribute("data-theme-custom-select") !== "0";
  if (!isEnabled) return;
  registerSelectDropdownListeners();

  // 1. Transform existing selects & upgrade native dropdown chevrons
  transformAllSelects();
  upgradeNativeDropdowns();

  // 2. Observe dynamic node additions
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === "SELECT") {
            transformSelect(el as HTMLSelectElement);
          } else if (el.tagName === "CBI-DROPDOWN" || el.classList.contains("cbi-dropdown")) {
            if (!el.classList.contains("fluent-custom-select")) {
              upgradeNativeDropdown(el);
            }
          } else {
            el.querySelectorAll("select").forEach((select) => {
              transformSelect(select as HTMLSelectElement);
            });
            el.querySelectorAll("cbi-dropdown, .cbi-dropdown").forEach((dropdown) => {
              if (!dropdown.classList.contains("fluent-custom-select")) {
                upgradeNativeDropdown(dropdown as HTMLElement);
              }
            });
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function transformAllSelects() {
  document.querySelectorAll("select").forEach((select) => {
    transformSelect(select as HTMLSelectElement);
  });
}

function upgradeNativeDropdowns() {
  document.querySelectorAll("cbi-dropdown, .cbi-dropdown").forEach((dropdown) => {
    if (!dropdown.classList.contains("fluent-custom-select")) {
      upgradeNativeDropdown(dropdown as HTMLElement);
    }
  });
}

function upgradeDropdownChevron(dropdown: HTMLElement) {
  const openSpan = dropdown.querySelector("span.open") as HTMLElement;
  if (openSpan) {
    if (openSpan.getAttribute("data-chevron-upgraded") !== "true") {
      openSpan.setAttribute("data-chevron-upgraded", "true");
      openSpan.innerHTML = "";
    }
  }
}

function upgradeNativeDropdown(dropdown: HTMLElement) {
  upgradeDropdownChevron(dropdown);
}

function isSelectElementHidden(selectEl: HTMLSelectElement): boolean {
  // 1. Check inline style attribute
  const styleAttr = selectEl.getAttribute("style") || "";
  if (/\bdisplay\s*:\s*none/i.test(styleAttr)) {
    return true;
  }

  // 2. Check inline style property
  if (selectEl.style.display === "none") {
    return true;
  }

  // 3. If element is not connected to the DOM, we can only check inline styles
  if (!selectEl.isConnected) {
    return false;
  }

  // 4. Check computed style
  try {
    const computedStyle = window.getComputedStyle(selectEl);
    if (computedStyle.display === "none") {
      // If computed display is none, it might be hidden because of an ancestor (like an inactive tab).
      // Let's traverse up the parent chain to see if any parent is display: none.
      let parent = selectEl.parentElement;
      let parentIsHidden = false;
      while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === "none") {
          parentIsHidden = true;
          break;
        }
        parent = parent.parentElement;
      }

      if (!parentIsHidden) {
        // Parent is visible, but the select itself is display: none.
        return true;
      }

      // Parent is hidden (e.g. inactive tab). Check if the select itself is hidden by CSS rules.
      const clone = selectEl.cloneNode(false) as HTMLSelectElement;
      clone.style.display = ""; // Clear inline display if any
      document.body.appendChild(clone);
      const cloneStyle = window.getComputedStyle(clone);
      const isCloneHidden = cloneStyle.display === "none";
      document.body.removeChild(clone);
      return isCloneHidden;
    }
  } catch (_e) {
    return false;
  }

  return false;
}

const DROPDOWN_VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 2;

function scrollOptionIntoDropdown(listbox: HTMLElement, item: HTMLElement) {
  const itemTop = item.offsetTop;
  const itemBottom = itemTop + item.offsetHeight;
  const visibleTop = listbox.scrollTop;
  const visibleBottom = visibleTop + listbox.clientHeight;

  if (itemTop < visibleTop) {
    listbox.scrollTop = itemTop;
  } else if (itemBottom > visibleBottom) {
    listbox.scrollTop = itemBottom - listbox.clientHeight;
  }
}

function updateDropdownPosition(customDropdown: HTMLElement, selectEl: HTMLSelectElement) {
  const rect = customDropdown.getBoundingClientRect();
  const direction = getEffectiveDocumentDirection();
  const viewportInlineSize = getViewportInlineSize();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const listHeight = Math.min(selectEl.options.length * 32 + 10, 320);

  if (spaceBelow < listHeight && spaceAbove > spaceBelow) {
    customDropdown.setAttribute("data-open-direction", "up");
  } else {
    customDropdown.setAttribute("data-open-direction", "down");
  }

  const isModalOrOverlay = !!customDropdown.closest("#modal_overlay .modal, .fluent-mac-overlay-card, [class*='overlay']");
  if (!isModalOrOverlay) {
    customDropdown.removeAttribute("data-fluent-floating");
    return;
  }

  const maxListHeight = Math.min(selectEl.options.length * 32 + 10, 320, viewportHeight * 0.45);
  const openUp = spaceBelow < maxListHeight && spaceAbove > spaceBelow;
  const availableHeight = Math.max(64, openUp ? spaceAbove - DROPDOWN_VIEWPORT_MARGIN - DROPDOWN_GAP : spaceBelow - DROPDOWN_VIEWPORT_MARGIN - DROPDOWN_GAP);
  const dropdownHeight = Math.min(maxListHeight, availableHeight);
  const dropdownInlineSize = Math.min(rect.width, viewportInlineSize - DROPDOWN_VIEWPORT_MARGIN * 2);
  const triggerInlineStart = getRectInlineStart(rect, direction, viewportInlineSize);
  const dropdownInlineStart = Math.min(Math.max(DROPDOWN_VIEWPORT_MARGIN, triggerInlineStart), viewportInlineSize - dropdownInlineSize - DROPDOWN_VIEWPORT_MARGIN);
  const dropdownTop = openUp
    ? Math.max(DROPDOWN_VIEWPORT_MARGIN, rect.top - dropdownHeight - DROPDOWN_GAP)
    : Math.min(viewportHeight - DROPDOWN_VIEWPORT_MARGIN - dropdownHeight, rect.bottom + DROPDOWN_GAP);

  customDropdown.setAttribute("data-open-direction", openUp ? "up" : "down");
  customDropdown.setAttribute("data-fluent-floating", "modal");
  setInlineCssCustomProperties(
    customDropdown.style,
    {
      inlineStart: dropdownInlineStart,
      inlineSize: dropdownInlineSize,
    },
    direction,
    viewportInlineSize,
    {
      inlineStart: "--fluent-dropdown-left",
      inlineSize: "--fluent-dropdown-width",
    },
  );
  customDropdown.style.setProperty("--fluent-dropdown-top", `${dropdownTop}px`);
  customDropdown.style.setProperty("--fluent-dropdown-max-height", `${dropdownHeight}px`);
}

function closeCustomDropdown(customDropdown: HTMLElement) {
  customDropdown.removeAttribute("open");
  customDropdown.removeAttribute("data-fluent-floating");
  customDropdown.style.removeProperty("--fluent-dropdown-left");
  customDropdown.style.removeProperty("--fluent-dropdown-top");
  customDropdown.style.removeProperty("--fluent-dropdown-width");
  customDropdown.style.removeProperty("--fluent-dropdown-max-height");
  customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
  const listbox = customDropdown.querySelector("ul.dropdown");
  if (listbox instanceof HTMLElement && typeof listbox.hidePopover === "function" && listbox.matches(":popover-open")) {
    listbox.hidePopover();
  }
}
function transformSelect(selectEl: HTMLSelectElement) {
  // Safety checks
  if (selectEl?.tagName !== "SELECT") return;
  if (selectEl.getAttribute("data-fluent-transformed") === "true") return;
  if (selectEl.closest(".cbi-dropdown")) return;
  if (selectEl.multiple) return; // Only transform single-select dropdowns
  if (isSelectElementHidden(selectEl)) return;

  // Copy style/classes if applicable (read before hiding to avoid copying our own display: none)
  const nativeStyle = selectEl.getAttribute("style");

  // Mark native select as transformed and hide it
  selectEl.setAttribute("data-fluent-transformed", "true");
  selectEl.style.setProperty("display", "none", "important");

  // Create custom dropdown DOM structure using TSX
  const previewLi = (<li></li>) as HTMLElement;
  previewLi.setAttribute("selected", "");
  const listbox = (<ul class="dropdown"></ul>) as HTMLElement;

  // Insert the SVG element via HTML string since LuCI's JSX types do not support SVG elements natively
  const openSpan = (<span class="open"></span>) as HTMLElement;

  const customDropdown = (
    <div class="cbi-dropdown fluent-custom-select">
      <ul>{previewLi}</ul>
      {openSpan}
      {listbox}
    </div>
  ) as HTMLElement;
  customDropdown.setAttribute("tabindex", "0");

  if (nativeStyle) {
    const cleanStyle = nativeStyle.replace(/\bdisplay\s*:\s*[^;]+(;|$)/gi, "").trim();
    if (cleanStyle) {
      customDropdown.setAttribute("style", cleanStyle);
    }
  }
  // Set initial disabled state
  if (selectEl.disabled) {
    customDropdown.setAttribute("disabled", "");
    customDropdown.removeAttribute("tabindex");
  }

  // Populate choices/options
  const rebuildOptions = () => {
    listbox.innerHTML = "";
    let selectedText = "";
    let hasSelected = false;

    Array.from(selectEl.options).forEach((opt) => {
      const li = (<li>{opt.text}</li>) as HTMLElement;
      li.setAttribute("data-value", opt.value);
      if (opt.selected) {
        li.setAttribute("selected", "");
        selectedText = opt.text;
        hasSelected = true;
      }
      if (opt.disabled) {
        li.setAttribute("disabled", "");
      }
      listbox.appendChild(li);
    });

    // Fallback if no option is explicitly marked selected
    if (!hasSelected && selectEl.options.length > 0) {
      const defaultOpt = selectEl.options[selectEl.selectedIndex >= 0 ? selectEl.selectedIndex : 0];
      selectedText = defaultOpt.text;
      const matchingLi = listbox.querySelector(`li[data-value="${defaultOpt.value}"]`);
      matchingLi?.setAttribute("selected", "");
    }

    previewLi.textContent = selectedText;
  };

  rebuildOptions();

  // Insert custom dropdown into DOM right next to native select
  selectEl.parentNode?.insertBefore(customDropdown, selectEl.nextSibling);

  // --- INTERACTION HANDLERS ---

  // Handle dropdown click toggle & option selection
  customDropdown.addEventListener("click", (e) => {
    if (customDropdown.hasAttribute("disabled")) return;

    const targetLi = (e.target as HTMLElement).closest("ul.dropdown > li");
    if (targetLi) {
      const val = targetLi.getAttribute("data-value");
      if (val !== null && !targetLi.hasAttribute("disabled")) {
        selectEl.value = val;
        // Dispatch standard change events for LuCI to catch the change
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        selectEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      closeCustomDropdown(customDropdown);
      e.stopPropagation();
      return;
    }

    // Header click toggle
    const isOpen = customDropdown.hasAttribute("open");
    if (isOpen) {
      closeCustomDropdown(customDropdown);
    } else {
      // Close all other open dropdowns first (including native cbi-dropdown elements and our custom ones)
      document.querySelectorAll("cbi-dropdown[open], .cbi-dropdown[open]").forEach((el) => {
        if (el instanceof HTMLElement && el.classList.contains("fluent-custom-select")) {
          closeCustomDropdown(el);
        } else {
          el.removeAttribute("open");
          el.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
        }
      });

      updateDropdownPosition(customDropdown, selectEl);
      customDropdown.setAttribute("open", "");
      customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.add("cbi-dropdown-open");
      // Scroll selected item into view
      const selectedItem = listbox.querySelector("li[selected]") as HTMLElement;
      if (selectedItem) {
        scrollOptionIntoDropdown(listbox, selectedItem);
      }
    }
    e.stopPropagation();
  });

  // Close dropdown on click outside
  const clickOutsideHandler = (e: MouseEvent) => {
    if (!customDropdown.contains(e.target as Node) && e.target !== selectEl && customDropdown.hasAttribute("open")) {
      closeCustomDropdown(customDropdown);
    }
  };
  document.addEventListener("click", clickOutsideHandler, true);

  // Keyboard navigation
  customDropdown.addEventListener("keydown", (e) => {
    if (customDropdown.hasAttribute("disabled")) return;

    const isOpen = customDropdown.hasAttribute("open");
    const options = Array.from(listbox.querySelectorAll("li:not([disabled])")) as HTMLElement[];
    const activeIndex = options.findIndex((opt) => opt.hasAttribute("selected"));

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (!isOpen) {
          customDropdown.click();
        } else {
          const currentSelected = options[activeIndex];
          if (currentSelected) {
            currentSelected.click();
          }
        }
        break;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          closeCustomDropdown(customDropdown);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          customDropdown.click();
        } else if (options.length > 0) {
          const nextIndex = (activeIndex + 1) % options.length;
          options.forEach((opt, idx) => {
            if (idx === nextIndex) {
              opt.setAttribute("selected", "");
              scrollOptionIntoDropdown(listbox, opt);
              const val = opt.getAttribute("data-value");
              if (val !== null) {
                selectEl.value = val;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                selectEl.dispatchEvent(new Event("input", { bubbles: true }));
              }
            } else {
              opt.removeAttribute("selected");
            }
          });
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) {
          customDropdown.click();
        } else if (options.length > 0) {
          const prevIndex = (activeIndex - 1 + options.length) % options.length;
          options.forEach((opt, idx) => {
            if (idx === prevIndex) {
              opt.setAttribute("selected", "");
              scrollOptionIntoDropdown(listbox, opt);
              const val = opt.getAttribute("data-value");
              if (val !== null) {
                selectEl.value = val;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                selectEl.dispatchEvent(new Event("input", { bubbles: true }));
              }
            } else {
              opt.removeAttribute("selected");
            }
          });
        }
        break;
      case "Tab":
        if (isOpen) {
          closeCustomDropdown(customDropdown);
        }
        break;
    }
  });

  // --- STATE SYNCHRONIZATION FROM NATIVE SELECT ---

  // 1. Sync value changes programmatically done to the native select
  const syncValueHandler = () => {
    const currentVal = selectEl.value;
    const items = Array.from(listbox.querySelectorAll("li")) as HTMLElement[];
    let selectedText = "";
    items.forEach((li) => {
      if (li.getAttribute("data-value") === currentVal) {
        li.setAttribute("selected", "");
        selectedText = li.textContent || "";
      } else {
        li.removeAttribute("selected");
      }
    });
    previewLi.textContent = selectedText;
  };
  selectEl.addEventListener("change", syncValueHandler);

  // 2. Sync options change (e.g. options added/removed dynamically)
  const childObserver = new MutationObserver(() => {
    rebuildOptions();
  });
  childObserver.observe(selectEl, { childList: true });

  // 3. Sync disabled attribute changes
  const attrObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "disabled") {
        const isDisabled = selectEl.disabled;
        if (isDisabled) {
          customDropdown.setAttribute("disabled", "");
          customDropdown.removeAttribute("tabindex");
          closeCustomDropdown(customDropdown);
        } else {
          customDropdown.removeAttribute("disabled");
          customDropdown.setAttribute("tabindex", "0");
        }
      }
    });
  });
  attrObserver.observe(selectEl, { attributes: true, attributeFilter: ["disabled"] });

  // Cleanup references on DOM removal to avoid leaks
  const disconnectObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === selectEl || node.contains?.(selectEl)) {
          document.removeEventListener("click", clickOutsideHandler, true);
          childObserver.disconnect();
          attrObserver.disconnect();
          disconnectObserver.disconnect();
          customDropdown.remove();
        }
      });
    });
  });
  if (selectEl.parentNode) {
    disconnectObserver.observe(selectEl.parentNode, { childList: true });
  }
}
