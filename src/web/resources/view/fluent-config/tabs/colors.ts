const form = L.form;

import { FLUENT_DEFAULTS } from "../../../fluent-defaults";
import { configureHexColorValue, createModeSubtabs } from "../shared";

export const registerColorsTab = (section: LuCI.form.TypedSection): void => {
  section.tab("colors", _("Colors"));

  const modeSection = createModeSubtabs(section, "colors", "colors_mode_tabs");

  {
    const option = modeSection.taboption("light", form.Value, "primary", _("Accent color"), _("HEX color used as the primary Fluent accent when the interface is rendered in light mode."));
    option.default = FLUENT_DEFAULTS.primary;
    configureHexColorValue(option, "primary");
  }

  {
    const option = modeSection.taboption(
      "light",
      form.Value,
      "progressbar_font",
      _("Progress bar text color"),
      _("HEX color used for progress-bar labels while the interface is rendered in light mode."),
    );
    option.default = FLUENT_DEFAULTS.progressbar_font;
    configureHexColorValue(option, "progressbar_font");
  }

  {
    const option = modeSection.taboption("light", form.Value, "page_bg", _("Page background"), _("HEX color used for the main page background in light mode."));
    option.default = FLUENT_DEFAULTS.page_bg;
    configureHexColorValue(option, "page_bg");
  }

  {
    const option = modeSection.taboption("light", form.Value, "card_bg", _("Card background"), _("HEX color used for container/card elements in light mode."));
    option.default = FLUENT_DEFAULTS.card_bg;
    configureHexColorValue(option, "card_bg");
  }

  {
    const option = modeSection.taboption("light", form.Value, "sidebar_bg", _("Sidebar background"), _("HEX color used for the navigation sidebar in light mode."));
    option.default = FLUENT_DEFAULTS.sidebar_bg;
    configureHexColorValue(option, "sidebar_bg");
  }

  {
    const option = modeSection.taboption("dark", form.Value, "dark_primary", _("Accent color"), _("HEX color used as the primary Fluent accent when the interface is rendered in dark mode."));
    option.default = FLUENT_DEFAULTS.dark_primary;
    configureHexColorValue(option, "dark_primary", true);
  }

  {
    const option = modeSection.taboption(
      "dark",
      form.Value,
      "dark_progressbar_font",
      _("Progress bar text color"),
      _("HEX color used for progress-bar labels while the interface is rendered in dark mode."),
    );
    option.default = FLUENT_DEFAULTS.dark_progressbar_font;
    configureHexColorValue(option, "dark_progressbar_font", true);
  }

  {
    const option = modeSection.taboption("dark", form.Value, "dark_page_bg", _("Page background"), _("HEX color used for the main page background in dark mode."));
    option.default = FLUENT_DEFAULTS.dark_page_bg;
    configureHexColorValue(option, "dark_page_bg", true);
  }

  {
    const option = modeSection.taboption("dark", form.Value, "dark_card_bg", _("Card background"), _("HEX color used for container/card elements in dark mode."));
    option.default = FLUENT_DEFAULTS.dark_card_bg;
    configureHexColorValue(option, "dark_card_bg", true);
  }

  {
    const option = modeSection.taboption("dark", form.Value, "dark_sidebar_bg", _("Sidebar background"), _("HEX color used for the navigation sidebar in dark mode."));
    option.default = FLUENT_DEFAULTS.dark_sidebar_bg;
    configureHexColorValue(option, "dark_sidebar_bg", true);
  }
};
