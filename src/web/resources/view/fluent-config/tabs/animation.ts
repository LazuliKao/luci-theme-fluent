const form = L.form;

import { FLUENT_DEFAULTS, fluentFlagDefault } from "../../../fluent-defaults";

export const registerAnimationTab = (section: LuCI.form.TypedSection): void => {
  section.tab("animation", _("Animation"));

  {
    const option = section.taboption(
      "animation",
      form.Flag,
      "view_transition",
      _("Enable page transition animation"),
      _("Use the browser View Transition API to animate navigation between LuCI pages when supported."),
    );
    option.default = fluentFlagDefault(FLUENT_DEFAULTS.view_transition) ? option.enabled : option.disabled;
    option.rmempty = false;
  }

  {
    const option = section.taboption(
      "animation",
      form.Flag,
      "tab_animation",
      _("Enable tab underline animation"),
      _("Animate the active underline when switching between native LuCI tabs and themed tab menus."),
    );
    option.default = fluentFlagDefault(FLUENT_DEFAULTS.tab_animation) ? option.enabled : option.disabled;
    option.rmempty = false;
  }

  {
    const option = section.taboption(
      "animation",
      form.Flag,
      "prefers_reduced_motion",
      _("Respect reduced-motion preference"),
      _("When enabled, Fluent animations follow the browser or operating system reduced-motion preference."),
    );
    option.default = fluentFlagDefault(FLUENT_DEFAULTS.prefers_reduced_motion) ? option.enabled : option.disabled;
    option.rmempty = false;
    option.depends("tab_animation", "1");
  }

  {
    const option = section.taboption("animation", form.Flag, "loading_bar", _("Show top loading bar"), _("Display the themed loading indicator at the top edge during page loads and transitions."));
    option.default = fluentFlagDefault(FLUENT_DEFAULTS.loading_bar) ? option.enabled : option.disabled;
    option.rmempty = false;
  }
};
