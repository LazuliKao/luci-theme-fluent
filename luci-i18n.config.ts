import { defineConfig } from "@lazulikao/luci-types/i18n";

export default defineConfig({
  packageName: "luci-theme-fluent",
  input: ["package/luci-theme-fluent/htdocs/luci-static/resources", "src/script/.cache/extra-strings.js"],
  pot: "package/luci-theme-fluent/po/templates/fluent.pot",
  extractPot: true,

  translate: {
    enabled: true,
    translator: "openai",
    batchSize: 10,
    prompt: "src/script/translate.${locale}.md",
  },
  headers: {
    languageTeam: "LuCI Theme Fluent",
  },
  locales: [
    {
      locale: "zh_Hans",
      headers: {
        lastTranslator: "LazuliKao",
      },
      po: "package/luci-theme-fluent/po/zh_Hans/fluent.po",
    },
    {
      locale: "es",
      headers: {
        lastTranslator: "castillofrancodamian",
      },
      po: "package/luci-theme-fluent/po/es/fluent.po",
    },
    {
      locale: "fa",
      headers: {
        lastTranslator: "TranslateGemma",
      },
      po: "package/luci-theme-fluent/po/fa/fluent.po",
    },
    {
      locale: "ru",
      headers: {
        lastTranslator: "TranslateGemma",
      },
      po: "package/luci-theme-fluent/po/ru/fluent.po",
    },
  ],
});
