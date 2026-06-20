const form = L.form;

export const registerGeneralTab = (section: LuCI.form.TypedSection): void => {
  section.tab(
    "general",
    _("General"),
    _("Choose how the theme selects its mode and how large core controls should render."),
  );

  {
    const option = section.taboption("general", form.ListValue, "mode", _("Color mode"));
    option.value("normal", _("Follow system"));
    option.value("light", _("Force light mode"));
    option.value("dark", _("Force dark mode"));
    option.default = "normal";
    option.rmempty = false;
    option.description = _("Use the system/browser preference, or always render the Fluent theme in a fixed light or dark palette.");
  }

  {
    const option = section.taboption("general", form.ListValue, "font_weight", _("Navigation font weight"));
    option.value("normal", _("Normal"));
    option.value("600", _("Semibold"));
    option.default = "600";
    option.rmempty = false;
    option.description = _("Controls the font weight used by main navigation labels and related theme text accents.");
  }

  {
    const option = section.taboption("general", form.ListValue, "control_height", _("Control height"));
    option.value("32", _("Compact (32px)"));
    option.value("42", _("Comfortable (42px)"));
    option.default = "32";
    option.rmempty = false;
    option.description = _("Applies to standard buttons, inputs, selects, and similar form controls across the theme.");
  }

  {
    const option = section.taboption(
      "general",
      form.Flag,
      "custom_select",
      _("Use Fluent custom select dropdowns"),
      _("Replace native select elements with the theme's custom dropdown widget."),
    );
    option.default = option.enabled;
    option.rmempty = false;
  }
};
