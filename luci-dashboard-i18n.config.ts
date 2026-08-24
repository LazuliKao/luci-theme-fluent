import { defineConfig } from "@lazulikao/luci-types/i18n";

export default defineConfig({
  packageName: "luci-mod-fluentdashboard",
  input: ["package/luci-mod-fluentdashboard/htdocs/luci-static/resources/view/fluentdashboard"],
  pot: "package/luci-mod-fluentdashboard/po/templates/fluentdashboard.pot",
  extractPot: true,
  translate: {
    enabled: false,
  },
  locales: [
    {
      locale: "zh_Hans",
      po: "package/luci-mod-fluentdashboard/po/zh_Hans/fluentdashboard.po",
    },
  ],
});
