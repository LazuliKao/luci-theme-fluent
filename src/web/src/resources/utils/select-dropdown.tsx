/**
 * Monitor native select elements and dynamically replace/transform them
 * into FluentUI-style custom dropdowns (using standard .cbi-dropdown classes).
 */
export function setupFluentSelects() {
  const isEnabled = document.body.getAttribute("data-theme-custom-select") !== "0";
  if (!isEnabled) return;

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
          } else if (el.tagName === "CBI-DROPDOWN") {
            upgradeDropdownChevron(el);
          } else {
            el.querySelectorAll("select").forEach((select) => {
              transformSelect(select as HTMLSelectElement);
            });
            el.querySelectorAll("cbi-dropdown").forEach((dropdown) => {
              upgradeDropdownChevron(dropdown as HTMLElement);
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
  document.querySelectorAll("cbi-dropdown").forEach((dropdown) => {
    upgradeDropdownChevron(dropdown as HTMLElement);
  });
}

function upgradeDropdownChevron(dropdown: HTMLElement) {
  const openSpan = dropdown.querySelector("span.open") as HTMLElement;
  if (openSpan) {
    if (openSpan.getAttribute("data-chevron-upgraded") !== "true") {
      openSpan.setAttribute("data-chevron-upgraded", "true");
      openSpan.innerHTML =
        '<svg fill="currentColor" class="___9ctc0p0 f1w7gpdv fez10in f1dd5bof" aria-hidden="true" width="1em" height="1em" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.85 7.65c.2.2.2.5 0 .7l-5.46 5.49a.55.55 0 0 1-.78 0L4.15 8.35a.5.5 0 1 1 .7-.7L10 12.8l5.15-5.16c.2-.2.5-.2.7 0Z" fill="currentColor"></path></svg>';
    }
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
  openSpan.innerHTML =
    '<svg fill="currentColor" class="___9ctc0p0 f1w7gpdv fez10in f1dd5bof" aria-hidden="true" width="1em" height="1em" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.85 7.65c.2.2.2.5 0 .7l-5.46 5.49a.55.55 0 0 1-.78 0L4.15 8.35a.5.5 0 1 1 .7-.7L10 12.8l5.15-5.16c.2-.2.5-.2.7 0Z" fill="currentColor"></path></svg>';

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
      customDropdown.removeAttribute("open");
      customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
      e.stopPropagation();
      return;
    }

    // Header click toggle
    const isOpen = customDropdown.hasAttribute("open");
    if (isOpen) {
      customDropdown.removeAttribute("open");
      customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
    } else {
      // Close all other open dropdowns first (including native cbi-dropdown elements and our custom ones)
      document.querySelectorAll("cbi-dropdown[open], .cbi-dropdown[open]").forEach((el) => {
        el.removeAttribute("open");
        el.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
      });

      // Calculate available space to determine open direction dynamically
      const rect = customDropdown.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Approximate height of the options list (32px per option + padding, max 250px)
      const listHeight = Math.min(selectEl.options.length * 32 + 10, 250);

      if (spaceBelow < listHeight && spaceAbove > spaceBelow) {
        customDropdown.setAttribute("data-open-direction", "up");
      } else {
        customDropdown.setAttribute("data-open-direction", "down");
      }

      customDropdown.setAttribute("open", "");
      customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.add("cbi-dropdown-open");

      // Scroll selected item into view
      const selectedItem = listbox.querySelector("li[selected]") as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }
    e.stopPropagation();
  });

  // Close dropdown on click outside
  const clickOutsideHandler = (e: MouseEvent) => {
    if (!customDropdown.contains(e.target as Node)) {
      if (customDropdown.hasAttribute("open")) {
        customDropdown.removeAttribute("open");
        customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
      }
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
          customDropdown.removeAttribute("open");
          customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
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
              opt.scrollIntoView({ block: "nearest" });
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
              opt.scrollIntoView({ block: "nearest" });
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
          customDropdown.removeAttribute("open");
          customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
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
          customDropdown.removeAttribute("open");
          customDropdown.closest(".cbi-value-field, .cbi-value")?.classList.remove("cbi-dropdown-open");
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
