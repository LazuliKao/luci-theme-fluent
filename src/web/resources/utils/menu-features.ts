import type { MenuPresentation } from "../menu-layout";
import { setupApplyChangePreview } from "./apply-change-preview";
import { setupErrorTooltips } from "./error-tooltips";
import { setupIfaceboxTooltips } from "./ifacebox-tooltip";
import { setupLogViewer } from "./log-viewer";
import { setupMacSelector } from "./mac-selector";
import { setupMenuSearch } from "./menu-search";
import { setupSelectionPause } from "./poll-pause";
import { setupFluentSelects } from "./select-dropdown";
import { setupTableWrappers } from "./table-wrapper";
import { setupThemeFeatures } from "./theme-features";

export const setupMenuStartup = (): void => setupApplyChangePreview();

export const setupMenuFeatures = (presentation?: MenuPresentation): void => {
  if (!presentation) {
    setupTableWrappers();
    setupSelectionPause();
    setupErrorTooltips();
    setupFluentSelects();
    setupIfaceboxTooltips();
    setupThemeFeatures();
    setupMacSelector();
    setupLogViewer();
    return;
  }

  setupMenuSearch(presentation);
};
