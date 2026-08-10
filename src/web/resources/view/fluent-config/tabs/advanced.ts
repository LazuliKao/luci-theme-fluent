const form = L.form;

import { FLUENT_DEFAULTS } from "../../../fluent-defaults";
import { omitDefaultValue } from "../shared";

export const registerAdvancedTab = (section: LuCI.form.TypedSection): void => {
  section.tab("advanced", _("Advanced"), _("Adjust layout, typography, transition timing, shadows, and inject custom CSS variables or rules when the built-in controls are not enough."));

  {
    const option = section.taboption(
      "advanced",
      form.Value,
      "font_size",
      _("Base font size"),
      _("Sets the base interface font size in pixels. Most theme text scales from this value through the Fluent CSS variables. Recommended range: 12-18px."),
    );
    option.datatype = "range(12,18)";
    option.default = FLUENT_DEFAULTS.font_size;
    omitDefaultValue(option);
    option.placeholder = FLUENT_DEFAULTS.font_size;
  }

  {
    const option = section.taboption("advanced", form.Value, "sidebar_width", _("Sidebar width"), _("Width of the main navigation sidebar in pixels."));
    option.datatype = "range(200,420)";
    option.default = FLUENT_DEFAULTS.sidebar_width;
    omitDefaultValue(option);
    option.placeholder = FLUENT_DEFAULTS.sidebar_width;
  }

  {
    const option = section.taboption("advanced", form.Value, "header_height", _("Header height"), _("Height of the top header bar in pixels."));
    option.datatype = "range(40,96)";
    option.default = FLUENT_DEFAULTS.header_height;
    omitDefaultValue(option);
    option.placeholder = FLUENT_DEFAULTS.header_height;
  }

  {
    const option = section.taboption(
      "advanced",
      form.ListValue,
      "border_radius",
      _("Corner radius"),
      _("Controls the shared Fluent corner radius tokens used by cards, buttons, inputs, and related UI surfaces."),
    );
    option.value("0", _("Square (0px)"));
    option.value("2", _("Small (2px)"));
    option.value("4", _("Medium (4px)"));
    option.value("6", _("Rounded (6px)"));
    option.value("8", _("Large (8px)"));
    option.value("12", _("Extra large (12px)"));
    option.default = FLUENT_DEFAULTS.border_radius;
    omitDefaultValue(option);
  }

  {
    const option = section.taboption("advanced", form.ListValue, "card_shadow", _("Card shadow"), _("Select the shadow depth applied to themed cards and panels."));
    option.value("none", _("None"));
    option.value("small", _("Small"));
    option.value("medium", _("Medium"));
    option.value("large", _("Large"));
    option.default = FLUENT_DEFAULTS.card_shadow;
    omitDefaultValue(option);
  }

  {
    const option = section.taboption(
      "advanced",
      form.ListValue,
      "transition_speed",
      _("Theme transition speed"),
      _("Controls the shared Fluent transition timing used by menu, header, and other theme animations."),
    );
    option.value("fast", _("Fast"));
    option.value("normal", _("Normal"));
    option.value("slow", _("Slow"));
    option.value("none", _("Disabled"));
    option.default = FLUENT_DEFAULTS.transition_speed;
    omitDefaultValue(option);
  }

  {
    const option = section.taboption(
      "advanced",
      form.TextValue,
      "custom_css",
      _("Custom CSS"),
      _("Optional raw CSS injected into the Fluent header template. Use this for extra --fluent-* variable overrides or page-specific tweaks that are not exposed as dedicated options."),
    ) as LuCI.form.TextValue;
    option.default = FLUENT_DEFAULTS.custom_css;
    omitDefaultValue(option);
    option.rmempty = true;
    option.rows = 12;
    option.wrap = "off";
    option.placeholder = ":root {\n  --fluent-sidebar-width: 280px;\n  --fluent-card-shadow: none;\n}";
  }
};
