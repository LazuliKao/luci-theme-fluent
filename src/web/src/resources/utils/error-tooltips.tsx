/**
 * Monitor input elements for validation errors and dynamically
 * display/hide FluentUI-style inline error messages below them.
 */
export function setupErrorTooltips() {
  // 1. Render errors on initial load
  document.querySelectorAll(".cbi-input-invalid").forEach((el) => {
    showFluentError(el as HTMLElement);
  });

  // 2. Observe class and data-tooltip attribute changes to display errors reactively
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        const target = mutation.target as HTMLElement;
        if (mutation.attributeName === "class") {
          if (target.classList.contains("cbi-input-invalid")) {
            showFluentError(target);
          } else {
            hideFluentError(target);
          }
        } else if (mutation.attributeName === "data-tooltip") {
          if (target.classList.contains("cbi-input-invalid")) {
            showFluentError(target);
          }
        }
      } else if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains("cbi-input-invalid")) {
              showFluentError(el);
            }
            el.querySelectorAll(".cbi-input-invalid").forEach((innerEl) => {
              showFluentError(innerEl as HTMLElement);
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["class", "data-tooltip"],
  });
}

/**
 * Find the appropriate parent container wrapper or target itself to insert the error after
 * @param {HTMLElement} target - The input/dropdown element
 */
function getErrorAnchor(target: HTMLElement): HTMLElement {
  const wrapper = target.parentElement?.closest(
    ".control-group, .password-input, .cbi-input-group, .add-item"
  );
  return (wrapper as HTMLElement) || target;
}

/**
 * Create and insert the inline FluentUI error message under an invalid field
 * @param {HTMLElement} target - The invalid input, select, or dropdown container element
 */
function showFluentError(target: HTMLElement) {
  const tooltipText = target.getAttribute("data-tooltip");
  if (!tooltipText) return;

  const anchor = getErrorAnchor(target);

  // Check if error message element already exists for this anchor
  let errorEl = anchor.nextElementSibling as HTMLElement | null;
  if (errorEl?.classList.contains("fluent-error-message")) {
    const textSpan = errorEl.querySelector(".fluent-error-text");
    if (textSpan && textSpan.textContent !== tooltipText) {
      textSpan.textContent = tooltipText;
    }
    errorEl.style.display = "";
    return;
  }

  // Create FluentUI error message container and text element using TSX
  errorEl = (
    <div class="fluent-error-message">
      <span class="fluent-error-text">{tooltipText}</span>
    </div>
  ) as HTMLElement;

  // Insert the SVG element via HTML string since LuCI's JSX types do not support SVG elements natively
  const svgIcon = `<svg fill="currentColor" width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;"><path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1Zm2.12 3.28a.5.5 0 0 1 0 .7L6.7 6.42l1.41 1.41a.5.5 0 1 1-.7.7L6 7.12 4.59 8.53a.5.5 0 0 1-.7-.7L5.3 6.42 3.88 5.01a.5.5 0 0 1 .7-.7L6 5.72l1.41-1.41a.5.5 0 0 1 .71 0Z" fill="currentColor"></path></svg>`;
  errorEl.insertAdjacentHTML("afterbegin", svgIcon);

  // Insert the error message directly after the anchor element
  anchor.parentNode?.insertBefore(errorEl, anchor.nextSibling);
}

/**
 * Remove the inline error message associated with the valid field
 * @param {HTMLElement} target - The valid element
 */
function hideFluentError(target: HTMLElement) {
  const anchor = getErrorAnchor(target);
  const errorEl = anchor.nextElementSibling;
  if (errorEl?.classList.contains("fluent-error-message")) {
    errorEl.remove();
  }
}
