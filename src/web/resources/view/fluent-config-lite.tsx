const form = L.form;
const uci = L.uci;

import { registerAdvancedTab } from "./fluent-config/tabs/advanced";
import { registerColorsTab } from "./fluent-config/tabs/colors";
import { registerGeneralTab } from "./fluent-config/tabs/general";
import { registerLoginTab } from "./fluent-config/tabs/login";

class mainImpl extends L.view {
  load() {
    return uci.load("fluent");
  }

  render() {
    const map = new form.Map(
      "fluent",
      _("Fluent theme settings"),
      _("Configure color mode, accent colors, layout sizing, login-page appearance, and advanced CSS overrides for luci-theme-fluent-lite."),
    );
    const section = map.section(form.TypedSection, "global", _("Theme settings"));
    section.addremove = false;
    section.anonymous = true;

    registerGeneralTab(section, false);
    registerColorsTab(section);
    registerLoginTab(section);
    registerAdvancedTab(section);
    return map.render();
  }
}

export const main = mainImpl;
