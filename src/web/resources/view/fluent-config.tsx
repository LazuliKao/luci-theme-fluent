const form = L.form;
const uci = L.uci;

import { registerAboutTab } from "./fluent-config/tabs/about";
import { registerAdvancedTab } from "./fluent-config/tabs/advanced";
import { registerAnimationTab } from "./fluent-config/tabs/animation";
import { registerColorsTab } from "./fluent-config/tabs/colors";
import { registerGeneralTab } from "./fluent-config/tabs/general";
import { registerLoginTab } from "./fluent-config/tabs/login";
import { registerMenuTab } from "./fluent-config/tabs/menu";

class mainImpl extends L.view {
  load() {
    return Promise.all([uci.load("fluent"), L.ui.menu.load()]);
  }

  render(data: [unknown, LuCI.ui.menu.MenuNode]) {
    const [, menuTree] = data;

    const map = new form.Map(
      "fluent",
      _("Fluent theme settings"),
      _("Configure color mode, accent colors, layout sizing, animation behavior, login-page appearance, and advanced CSS overrides for luci-theme-fluent."),
    );

    const section = map.section(form.TypedSection, "global", _("Theme settings"));
    section.addremove = false;
    section.anonymous = true;

    registerGeneralTab(section);
    registerMenuTab(section, menuTree);
    registerColorsTab(section);
    registerAnimationTab(section);
    registerLoginTab(section);
    registerAdvancedTab(section);
    registerAboutTab(section);

    return map.render();
  }
}

export const main = mainImpl;
