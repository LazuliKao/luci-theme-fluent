import { getEffectiveDocumentDirection, getRectInlineStart, getViewportInlineSize, setInlineCssCustomProperties } from "./direction";

/**
 * Monitor native select elements and dynamically replace/transform them
 * into FluentUI-style custom dropdowns (using standard .cbi-dropdown classes).
 */
let selectDropdownListenersRegistered = false;
let selectsInitialized = false;
const selectLifecycles = new WeakMap<HTMLSelectElement, { dropdown: HTMLElement; dispose: () => void; refreshAncestors: () => void }>();
let nextSelectId = 0;

function updateOpenDropdownPositions() {
  document.querySelectorAll("cbi-dropdown[open], .cbi-dropdown[open], .fluent-custom-select[open]").forEach((dropdown) => {
    if (!(dropdown instanceof HTMLElement)) return;

    if (dropdown.classList.contains("fluent-custom-select")) {
      const selectEl = dropdown.previousElementSibling;
      if (selectEl instanceof HTMLSelectElement) {
        updateDropdownPosition(dropdown, selectEl);
      }
    } else {
      updateNativeDropdownPosition(dropdown);
    }
  });
}

function updateNativeDropdownPosition(dropdown: HTMLElement) {
  const rect = dropdown.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;

  const listbox = dropdown.querySelector("ul.dropdown, ul:not(.preview)") as HTMLElement;
  const itemCount = listbox ? listbox.querySelectorAll("li").length : 8;
  const scrollHeight = listbox ? listbox.scrollHeight : 0;
  const listHeight = Math.min(scrollHeight > 0 ? scrollHeight + 8 : itemCount * 36 + 10, DROPDOWN_MAX_HEIGHT_LIMIT);

  const openUp = spaceBelow < listHeight && spaceAbove > spaceBelow;
  const maxListHeight = openUp ? Math.max(64, spaceAbove - DROPDOWN_VIEWPORT_MARGIN - DROPDOWN_GAP) : Math.max(64, spaceBelow - DROPDOWN_VIEWPORT_MARGIN - DROPDOWN_GAP);

  dropdown.setAttribute("data-open-direction", openUp ? "up" : "down");
  dropdown.style.setProperty("--fluent-dropdown-max-height", `${Math.min(DROPDOWN_MAX_HEIGHT_LIMIT, listHeight, maxListHeight)}px`);
}

function registerSelectDropdownListeners() {
  if (selectDropdownListenersRegistered) return;

  selectDropdownListenersRegistered = true;
  window.addEventListener("scroll", updateOpenDropdownPositions, true);
  window.addEventListener("resize", updateOpenDropdownPositions);
  document.addEventListener(
    "click",
    (event) => {
      document.querySelectorAll<HTMLElement>(".fluent-custom-select[open]").forEach((dropdown) => {
        if (!dropdown.contains(event.target as Node) && event.target !== dropdown.previousElementSibling) closeCustomDropdown(dropdown);
      });
    },
    true,
  );

  const dropdownObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" && mutation.attributeName === "open") {
        const target = mutation.target as HTMLElement;
        if (target.hasAttribute("open")) {
          if (target.classList.contains("fluent-custom-select")) {
            const selectEl = target.previousElementSibling;
            if (selectEl instanceof HTMLSelectElement) {
              updateDropdownPosition(target, selectEl);
            }
          } else if (target.tagName === "CBI-DROPDOWN" || target.classList.contains("cbi-dropdown")) {
            updateNativeDropdownPosition(target);
          }
        }
      }
    });
  });

  dropdownObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["open"],
    subtree: true,
  });
}

export function setupFluentSelects() {
  registerSelectDropdownListeners();
  const isEnabled = document.body.getAttribute("data-theme-custom-select") !== "0";
  if (!isEnabled || selectsInitialized) return;
  selectsInitialized = true;

  // 1. Transform existing selects & upgrade native dropdown chevrons
  transformAllSelects();
  upgradeNativeDropdowns();

  // 2. Discover additions and dispose removed subtrees after connected moves settle.
  const observer = new MutationObserver((mutations) => {
    const removedSelects = new Set<HTMLSelectElement>();
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node instanceof HTMLSelectElement) removedSelects.add(node);
        else if (node instanceof Element) {
          node.querySelectorAll("select").forEach((select) => {
            removedSelects.add(select);
          });
        }
      });
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
    removedSelects.forEach((select) => {
      const lifecycle = selectLifecycles.get(select);
      if (!lifecycle) return;
      if (!select.isConnected) lifecycle.dispose();
      else {
        if (select.nextElementSibling !== lifecycle.dropdown) {
          closeCustomDropdown(lifecycle.dropdown);
          select.after(lifecycle.dropdown);
        }
        lifecycle.refreshAncestors();
      }
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
  const listbox = dropdown.querySelector("ul:not(.preview)") as HTMLElement;
  if (listbox && !listbox.classList.contains("dropdown")) {
    listbox.classList.add("dropdown");
  }
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

const DROPDOWN_MAX_HEIGHT_LIMIT = 350;
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
  const listHeight = Math.min(selectEl.options.length * 32 + 10, DROPDOWN_MAX_HEIGHT_LIMIT);

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

  const maxListHeight = Math.min(selectEl.options.length * 32 + 10, DROPDOWN_MAX_HEIGHT_LIMIT, viewportHeight * 0.45);
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
  customDropdown.setAttribute("aria-expanded", "false");
  customDropdown.removeAttribute("aria-activedescendant");
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
  if (selectEl?.tagName !== "SELECT" || !selectEl.isConnected) return;
  if (selectEl.getAttribute("data-fluent-transformed") === "true") return;
  if (selectEl.closest(".cbi-dropdown")) return;
  if (selectEl.multiple) return; // Only transform single-select dropdowns
  if (isSelectElementHidden(selectEl)) return;

  // Copy style/classes if applicable (read before hiding to avoid copying our own display: none)
  const nativeStyle = selectEl.getAttribute("style");
  const nativeDisplay = selectEl.style.getPropertyValue("display");
  const nativeDisplayPriority = selectEl.style.getPropertyPriority("display");

  // Mark native select as transformed and hide it
  selectEl.setAttribute("data-fluent-transformed", "true");
  selectEl.style.setProperty("display", "none", "important");

  // Create custom dropdown DOM structure using TSX
  const previewLi = (<li></li>) as HTMLElement;
  previewLi.setAttribute("selected", "");
  const listbox = (<ul class="dropdown"></ul>) as HTMLElement;
  listbox.id = `fluent-select-list-${++nextSelectId}`;
  listbox.setAttribute("role", "listbox");

  // Insert the SVG element via HTML string since LuCI's JSX types do not support SVG elements natively
  const openSpan = (<span class="open"></span>) as HTMLElement;

  const customDropdown = (
    <div class="fluent-custom-select">
      <ul>{previewLi}</ul>
      {openSpan}
      {listbox}
    </div>
  ) as HTMLElement;
  customDropdown.setAttribute("tabindex", "0");
  customDropdown.setAttribute("role", "combobox");
  customDropdown.setAttribute("aria-haspopup", "listbox");
  customDropdown.setAttribute("aria-controls", listbox.id);
  customDropdown.setAttribute("aria-expanded", "false");
  customDropdown.setAttribute("aria-required", String(selectEl.required));
  customDropdown.querySelector("ul:not(.dropdown)")?.setAttribute("aria-hidden", "true");
  openSpan.setAttribute("aria-hidden", "true");

  if (nativeStyle) {
    const cleanStyle = nativeStyle.replace(/\bdisplay\s*:\s*[^;]+(;|$)/gi, "").trim();
    if (cleanStyle) {
      customDropdown.setAttribute("style", cleanStyle);
    }
  }
  let items = new Map<HTMLOptionElement, HTMLElement>();
  let active: HTMLOptionElement | null = null;
  let openFrame = 0;
  let resetTimer = 0;
  let typeahead = "";
  let typeaheadTimer = 0;
  let form: HTMLFormElement | null = null;
  let labels: HTMLLabelElement[] = [];
  let fieldsets: HTMLFieldSetElement[] = [];

  const isDisabled = () => selectEl.matches(":disabled");
  const usable = (option: HTMLOptionElement) => !option.hidden && !option.closest("[hidden]") && !option.matches(":disabled");
  const available = () => Array.from(selectEl.options).filter((option) => usable(option));
  const setActive = (option: HTMLOptionElement | null) => {
    active = option && items.has(option) && usable(option) ? option : null;
    if (active && customDropdown.hasAttribute("open")) {
      const item = items.get(active);
      if (item) {
        customDropdown.setAttribute("aria-activedescendant", item.id);
        scrollOptionIntoDropdown(listbox, item);
      }
    } else customDropdown.removeAttribute("aria-activedescendant");
  };
  const sync = () => {
    const disabled = isDisabled();
    customDropdown.toggleAttribute("disabled", disabled);
    customDropdown.setAttribute("aria-disabled", String(disabled));
    customDropdown.setAttribute("aria-required", String(selectEl.required));
    if (disabled) {
      customDropdown.removeAttribute("tabindex");
      closeCustomDropdown(customDropdown);
    } else customDropdown.setAttribute("tabindex", "0");

    const labelIds = labels.map((label) => label.id).filter(Boolean);
    const labelledBy = selectEl.getAttribute("aria-labelledby");
    if (labelledBy || labelIds.length) {
      customDropdown.setAttribute("aria-labelledby", labelledBy || labelIds.join(" "));
      customDropdown.removeAttribute("aria-label");
    } else {
      customDropdown.removeAttribute("aria-labelledby");
      const name =
        selectEl.getAttribute("aria-label") ||
        labels
          .map((label) => label.textContent?.trim())
          .filter(Boolean)
          .join(" ") ||
        selectEl.title;
      if (name) customDropdown.setAttribute("aria-label", name);
      else customDropdown.removeAttribute("aria-label");
    }
    const selected = selectEl.options[selectEl.selectedIndex];
    previewLi.textContent = selected?.text ?? "";
    for (const [option, item] of items) {
      const chosen = option === selected;
      item.toggleAttribute("selected", chosen);
      item.setAttribute("aria-selected", String(chosen));
      const unavailable = !usable(option);
      item.toggleAttribute("disabled", unavailable);
      item.setAttribute("aria-disabled", String(unavailable));
    }
    if (active && !usable(active)) setActive(selected && usable(selected) ? selected : null);
    if (customDropdown.hasAttribute("open") && !active) setActive(selected && usable(selected) ? selected : available()[0] || null);
  };
  const rebuildOptions = () => {
    const newItems = new Map<HTMLOptionElement, HTMLElement>();
    let group: HTMLOptGroupElement | null = null;
    let groupList: HTMLElement | null = null;
    listbox.replaceChildren();
    Array.from(selectEl.options).forEach((option, index) => {
      const parent = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
      if (parent !== group) {
        group = parent;
        groupList = null;
      }
      if (parent && !groupList) {
        const wrapper = (<li class="fluent-select-group"></li>) as HTMLElement;
        wrapper.setAttribute("role", "group");
        wrapper.setAttribute("aria-label", parent.label);
        wrapper.hidden = parent.hidden;
        const heading = (<span class="fluent-select-group__label"></span>) as HTMLElement;
        heading.textContent = parent.label;
        heading.setAttribute("aria-hidden", "true");
        groupList = (<ul></ul>) as HTMLElement;
        groupList.setAttribute("role", "presentation");
        wrapper.append(heading, groupList);
        listbox.append(wrapper);
      }
      const item = (<li></li>) as HTMLElement;
      item.id = `${listbox.id}-option-${index}`;
      item.textContent = option.text;
      item.setAttribute("role", "option");
      item.hidden = option.hidden || !!parent?.hidden;
      (groupList || listbox).append(item);
      newItems.set(option, item);
    });
    items = newItems;
    if (active && !items.has(active)) active = null;
    sync();
  };

  const selectOption = (option: HTMLOptionElement) => {
    if (isDisabled() || !usable(option)) return;
    selectEl.selectedIndex = Array.from(selectEl.options).indexOf(option);
    sync();
    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const onLabelClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) return;
    if (!isDisabled()) customDropdown.focus();
  };
  const onReset = () => {
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (selectEl.isConnected) {
        rebuildOptions();
        setActive(null);
      }
    }, 0);
  };
  const ancestorObserver = new MutationObserver(() => sync());
  const refreshAncestors = () => {
    ancestorObserver.disconnect();
    fieldsets = Array.from(
      (function* () {
        let parent = selectEl.parentElement;
        while (parent) {
          if (parent instanceof HTMLFieldSetElement) yield parent;
          parent = parent.parentElement;
        }
      })(),
    );
    fieldsets.forEach((fieldset) => {
      ancestorObserver.observe(fieldset, { attributes: true, attributeFilter: ["disabled"] });
    });
    const nextForm = selectEl.form;
    if (form !== nextForm) {
      form?.removeEventListener("reset", onReset);
      form = nextForm;
      form?.addEventListener("reset", onReset);
    }
    const nextLabels = Array.from(selectEl.labels || []);
    labels.forEach((label) => {
      label.removeEventListener("click", onLabelClick);
    });
    labels = nextLabels;
    labels.forEach((label) => {
      label.addEventListener("click", onLabelClick);
    });
    sync();
  };
  rebuildOptions();

  // Insert custom dropdown into DOM right next to native select
  selectEl.parentNode?.insertBefore(customDropdown, selectEl.nextSibling);

  // --- INTERACTION HANDLERS ---

  // Handle dropdown click toggle & option selection
  customDropdown.addEventListener("click", (e) => {
    if (customDropdown.hasAttribute("disabled")) return;

    const targetLi = (e.target as HTMLElement).closest('[role="option"]');
    if (targetLi && listbox.contains(targetLi)) {
      const option = Array.from(items).find(([, item]) => item === targetLi)?.[0];
      if (option && usable(option)) selectOption(option);
      closeCustomDropdown(customDropdown);
      e.stopPropagation();
      return;
    }

    if ((e.target as HTMLElement).closest('[role="group"]')) return;
    // Header click toggle
    const isOpen = customDropdown.hasAttribute("open");
    if (isOpen) {
      closeCustomDropdown(customDropdown);
    } else {
      // Close all other open dropdowns first (including native cbi-dropdown elements and our custom ones)
      document.querySelectorAll("cbi-dropdown[open], .cbi-dropdown[open], .fluent-custom-select[open]").forEach((el) => {
        if (el instanceof HTMLElement && el.classList.contains("fluent-custom-select")) {
          closeCustomDropdown(el);
        } else {
          el.removeAttribute("open");
          el.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
        }
      });

      rebuildOptions();
      updateDropdownPosition(customDropdown, selectEl);
      customDropdown.setAttribute("open", "");
      customDropdown.setAttribute("aria-expanded", "true");
      customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.add("cbi-dropdown-open");
      setActive(usable(selectEl.options[selectEl.selectedIndex]) ? selectEl.options[selectEl.selectedIndex] : available()[0] || null);
      const watchOpen = () => {
        if (!customDropdown.hasAttribute("open")) {
          openFrame = 0;
          return;
        }
        sync();
        openFrame = requestAnimationFrame(watchOpen);
      };
      if (!openFrame) openFrame = requestAnimationFrame(watchOpen);
    }
    e.stopPropagation();
  });

  // Keyboard navigation
  customDropdown.addEventListener("keydown", (e) => {
    if (customDropdown.hasAttribute("disabled")) return;

    const isOpen = customDropdown.hasAttribute("open");
    const options = available();
    const activeIndex = active ? options.indexOf(active) : -1;

    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (!isOpen) {
          customDropdown.click();
        } else {
          if (active) {
            selectOption(active);
            closeCustomDropdown(customDropdown);
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
          setActive(options[(activeIndex + 1) % options.length]);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) {
          customDropdown.click();
        } else if (options.length > 0) {
          setActive(options[(activeIndex - 1 + options.length) % options.length]);
        }
        break;
      case "Home":
      case "End":
        e.preventDefault();
        if (!isOpen) customDropdown.click();
        setActive(e.key === "Home" ? options[0] || null : options[options.length - 1] || null);
        break;
      case "Tab":
        if (isOpen) {
          closeCustomDropdown(customDropdown);
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          typeahead += e.key.toLocaleLowerCase();
          window.clearTimeout(typeaheadTimer);
          typeaheadTimer = window.setTimeout(() => {
            typeahead = "";
          }, 700);
          const match = options.find((option) => option.text.trim().toLocaleLowerCase().startsWith(typeahead));
          if (match) {
            if (!isOpen) customDropdown.click();
            setActive(match);
          }
        }
    }
  });

  // --- STATE SYNCHRONIZATION FROM NATIVE SELECT ---

  const syncSelection = () => {
    sync();
    setActive(null);
  };
  selectEl.addEventListener("change", syncSelection);
  selectEl.addEventListener("input", syncSelection);
  customDropdown.addEventListener("focus", () => {
    refreshAncestors();
    rebuildOptions();
  });
  const optionObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === "childList" || mutation.target !== selectEl)) rebuildOptions();
    else sync();
    if (mutations.some((mutation) => mutation.attributeName === "form" || mutation.attributeName === "id")) refreshAncestors();
  });
  optionObserver.observe(selectEl, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["disabled", "hidden", "label", "selected", "value", "required", "aria-label", "aria-labelledby", "id", "form"],
  });
  refreshAncestors();

  selectLifecycles.set(selectEl, {
    dropdown: customDropdown,
    refreshAncestors,
    dispose: () => {
      closeCustomDropdown(customDropdown);
      if (openFrame) cancelAnimationFrame(openFrame);
      window.clearTimeout(resetTimer);
      window.clearTimeout(typeaheadTimer);
      optionObserver.disconnect();
      ancestorObserver.disconnect();
      form?.removeEventListener("reset", onReset);
      labels.forEach((label) => {
        label.removeEventListener("click", onLabelClick);
      });
      selectEl.removeEventListener("change", syncSelection);
      selectEl.removeEventListener("input", syncSelection);
      customDropdown.remove();
      selectEl.removeAttribute("data-fluent-transformed");
      if (nativeDisplay) selectEl.style.setProperty("display", nativeDisplay, nativeDisplayPriority);
      else selectEl.style.removeProperty("display");
      selectLifecycles.delete(selectEl);
    },
  });
}
