import type { MenuPresentation } from "../menu-layout";
import { setupTableWrappers } from "./table-wrapper";
import { setupThemeFeatures } from "./theme-features-lite";

export const setupMenuStartup = (): void => {};

export const setupMenuFeatures = (_presentation?: MenuPresentation): void => {
  setupTableWrappers();
  setupThemeFeatures();
};
