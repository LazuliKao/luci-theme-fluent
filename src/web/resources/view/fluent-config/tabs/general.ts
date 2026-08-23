const form = L.form;

import { FLUENT_DEFAULTS, fluentFlagDefault } from "../../../fluent-defaults";
import { omitDefaultValue } from "../shared";

export const registerGeneralTab = (section: LuCI.form.TypedSection, includeCustomSelect = true): void => {
  section.tab("general", _("General"));

  {
    const option = section.taboption("general", form.ListValue, "mode", _("Color mode"));
    option.value("auto", _("Follow system"));
    option.value("light", _("Force light mode"));
    option.value("dark", _("Force dark mode"));
    option.default = FLUENT_DEFAULTS.mode;
    omitDefaultValue(option);
    option.description = _("Use the system/browser preference, or always render the Fluent theme in a fixed light or dark palette.");
  }

  {
    const option = section.taboption("general", form.ListValue, "direction_mode", _("Text direction"));
    option.value("auto", _("Automatic (Arabic/Persian locales only)"));
    option.value("rtl", _("Force RTL"));
    option.value("ltr", _("Force LTR"));
    option.default = FLUENT_DEFAULTS.direction_mode;
    omitDefaultValue(option);
    option.description = _(
      "Choose the document direction for authenticated and login pages. Automatic mode resolves Arabic and Persian locale codes (ar, ar_*, ar-*, fa, fa_*, fa-*) to RTL and falls back to LTR for missing or unrecognized locales.",
    );
  }

  {
    const option = section.taboption("general", form.ListValue, "font_weight", _("Navigation font weight"));
    option.value("normal", _("Normal"));
    option.value("600", _("Semibold"));
    option.default = FLUENT_DEFAULTS.font_weight;
    omitDefaultValue(option);
    option.description = _("Controls the font weight used by main navigation labels and related theme text accents.");
  }

  {
    const option = section.taboption("general", form.ListValue, "control_height", _("Control height"));
    option.value("32", _("Compact (32px)"));
    option.value("42", _("Comfortable (42px)"));
    option.default = FLUENT_DEFAULTS.control_height;
    omitDefaultValue(option);
    option.description = _("Applies to standard buttons, inputs, selects, and similar form controls across the theme.");
  }

  if (includeCustomSelect) {
    const option = section.taboption("general", form.Flag, "custom_select", _("Use Fluent custom select dropdowns"), _("Replace native select elements with the theme's custom dropdown widget."));
    option.default = fluentFlagDefault(FLUENT_DEFAULTS.custom_select) ? option.enabled : option.disabled;
    omitDefaultValue(option);
  }

  {
    const option = section.taboption("general", form.ListValue, "progressbar_text_position", _("Progress bar text position"));
    option.value("top-start", _("Above bar, start"));
    option.value("bottom-start", _("Below bar, start"));
    option.value("top-end", _("Above bar, end"));
    option.value("bottom-end", _("Below bar, end"));
    option.default = FLUENT_DEFAULTS.progressbar_text_position;
    omitDefaultValue(option);
    option.description = _("Position of progress-bar labels relative to the bar. Start/end alignment follows the text direction (LTR or RTL).");
  }
};
