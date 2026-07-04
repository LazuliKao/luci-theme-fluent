const form = L.form;

import { FLUENT_DEFAULTS, fluentFlagDefault } from "../../../fluent-defaults";

export const registerGeneralTab = (section: LuCI.form.TypedSection): void => {
  section.tab("general", _("General"));

  {
    const option = section.taboption("general", form.ListValue, "mode", _("Color mode"));
    option.value("auto", _("Follow system"));
    option.value("light", _("Force light mode"));
    option.value("dark", _("Force dark mode"));
    option.default = FLUENT_DEFAULTS.mode;
    option.rmempty = false;
    option.description = _("Use the system/browser preference, or always render the Fluent theme in a fixed light or dark palette.");
  }

  {
    const option = section.taboption("general", form.ListValue, "font_weight", _("Navigation font weight"));
    option.value("normal", _("Normal"));
    option.value("600", _("Semibold"));
    option.default = FLUENT_DEFAULTS.font_weight;
    option.rmempty = false;
    option.description = _("Controls the font weight used by main navigation labels and related theme text accents.");
  }

  {
    const option = section.taboption("general", form.ListValue, "control_height", _("Control height"));
    option.value("32", _("Compact (32px)"));
    option.value("42", _("Comfortable (42px)"));
    option.default = FLUENT_DEFAULTS.control_height;
    option.rmempty = false;
    option.description = _("Applies to standard buttons, inputs, selects, and similar form controls across the theme.");
  }

  {
    const option = section.taboption("general", form.Flag, "custom_select", _("Use Fluent custom select dropdowns"), _("Replace native select elements with the theme's custom dropdown widget."));
    option.default = fluentFlagDefault(FLUENT_DEFAULTS.custom_select) ? option.enabled : option.disabled;
    option.rmempty = false;
  }
};
