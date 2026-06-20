const form = L.form;

import { configureHexColorValue } from "../shared";

export const registerColorsTab = (section: LuCI.form.TypedSection): void => {
  section.tab(
    "colors",
    _("Colors"),
    _("Set separate accent and progress-bar label colors for light and dark mode."),
  );

  {
    const option = section.taboption(
      "colors",
      form.Value,
      "primary",
      _("Light mode accent color"),
      _("HEX color used as the primary Fluent accent when the interface is rendered in light mode."),
    );
    option.default = "#0078d4";
    configureHexColorValue(option, "primary");
  }

  {
    const option = section.taboption(
      "colors",
      form.Value,
      "dark_primary",
      _("Dark mode accent color"),
      _("HEX color used as the primary Fluent accent when the interface is rendered in dark mode."),
    );
    option.default = "#1a1a2e";
    configureHexColorValue(option, "dark_primary", true);
  }

  {
    const option = section.taboption(
      "colors",
      form.Value,
      "progressbar_font",
      _("Light mode progress bar text color"),
      _("HEX color used for progress-bar labels while the interface is rendered in light mode."),
    );
    option.default = "#2e2b60";
    configureHexColorValue(option, "progressbar_font");
  }

  {
    const option = section.taboption(
      "colors",
      form.Value,
      "dark_progressbar_font",
      _("Dark mode progress bar text color"),
      _("HEX color used for progress-bar labels while the interface is rendered in dark mode."),
    );
    option.default = "#d6d9e5";
    configureHexColorValue(option, "dark_progressbar_font", true);
  }
};
