/**
 * Setup dynamic positioning and portaling for interface badge tooltips
 * using a single global tooltip instance to avoid DOM clipping and event loops.
 */
let globalTooltip: HTMLElement | null = null;

export function setupIfaceboxTooltips() {
  document.addEventListener("mouseover", (e) => {
    const target = e.target as HTMLElement;
    const container = target.closest(".cbi-tooltip-container") as HTMLElement | null;

    // If mouse moves outside of the tooltip container in the interface column, hide the global tooltip
    if (!container?.closest('td[data-name="_ifacebox"] .ifacebox-body, .td[data-name="_ifacebox"] .ifacebox-body')) {
      if (globalTooltip && globalTooltip.style.display !== "none") {
        globalTooltip.style.display = "none";
        globalTooltip.style.opacity = "0";
      }
      return;
    }

    const localTooltip = container.querySelector(".cbi-tooltip") as HTMLElement | null;
    if (!localTooltip) return;

    // Create the global tooltip element in document.body if it doesn't exist
    if (!globalTooltip) {
      globalTooltip = document.createElement("div");
      globalTooltip.id = "fluent-global-tooltip";
      globalTooltip.className = "cbi-tooltip ifacebadge large";
      globalTooltip.style.position = "absolute";
      globalTooltip.style.zIndex = "10000";
      globalTooltip.style.pointerEvents = "none";
      globalTooltip.style.display = "none";
      document.body.appendChild(globalTooltip);
    }

    // Sync content
    globalTooltip.innerHTML = localTooltip.innerHTML;

    // Temporarily show with opacity 0 to measure dimensions
    globalTooltip.style.display = "block";
    globalTooltip.style.opacity = "0";

    const parentRect = container.getBoundingClientRect();
    const tooltipRect = globalTooltip.getBoundingClientRect();

    // Position calculation
    const top = window.pageYOffset + parentRect.bottom + 6;
    let left = window.pageXOffset + parentRect.left + parentRect.width / 2 - tooltipRect.width / 2;

    // Screen boundary checks
    const padding = 10;
    if (left < padding) {
      left = padding;
    }
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }

    globalTooltip.style.top = `${top}px`;
    globalTooltip.style.left = `${left}px`;

    // Force reflow and animate opacity
    globalTooltip.offsetWidth;
    globalTooltip.style.opacity = "1";

    // Set arrow pointer position dynamically
    const arrowLeft = window.pageXOffset + parentRect.left + parentRect.width / 2 - left;
    globalTooltip.style.setProperty("--arrow-left", `${arrowLeft}px`);

    const handleMouseLeave = () => {
      if (globalTooltip) {
        globalTooltip.style.display = "none";
        globalTooltip.style.opacity = "0";
      }
      container.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("scroll", handleScroll, true);
    };

    const handleScroll = () => {
      if (globalTooltip) {
        globalTooltip.style.display = "none";
        globalTooltip.style.opacity = "0";
      }
      container.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("scroll", handleScroll, true);
    };

    container.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("scroll", handleScroll, true);
  }, true);
}
