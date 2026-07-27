import { defineConfig } from "@lazulikao/luci-types/i18n";

export default defineConfig({
  packageName: "luci-theme-fluent",
  input: ["package/luci-theme-fluent/htdocs/luci-static/resources", "src/script/.cache/extra-strings.js"],
  pot: "package/luci-theme-fluent/po/templates/fluent.pot",
  extractPot: true,

  translate: {
    enabled: true,
    translator: "openai",
    batchSize: 15,
    prompt: "src/script/translate.${locale}.md",
  },
  headers: {
    languageTeam: "LuCI Theme Fluent",
    lastTranslator: "TranslateGemma",
  },
  locales: [
    {
      locale: "zh_Hans",
      headers: { lastTranslator: "LazuliKao" },
      po: "package/luci-theme-fluent/po/zh_Hans/fluent.po",
    },
    {
      locale: "zh_Hant",
      po: "package/luci-theme-fluent/po/zh_Hant/fluent.po",
    },
    {
      locale: "es",
      headers: { lastTranslator: "castillofrancodamian" },
      po: "package/luci-theme-fluent/po/es/fluent.po",
    },
    {
      locale: "fa",
      po: "package/luci-theme-fluent/po/fa/fluent.po",
    },
    {
      locale: "ru",
      po: "package/luci-theme-fluent/po/ru/fluent.po",
    },
    {
      locale: "de",
      po: "package/luci-theme-fluent/po/de/fluent.po",
    },
    {
      locale: "fr",
      po: "package/luci-theme-fluent/po/fr/fluent.po",
    },
    {
      locale: "ja",
      po: "package/luci-theme-fluent/po/ja/fluent.po",
    },
    {
      locale: "ko",
      po: "package/luci-theme-fluent/po/ko/fluent.po",
    },
    {
      locale: "tr",
      po: "package/luci-theme-fluent/po/tr/fluent.po",
    },
    {
      locale: "uk",
      po: "package/luci-theme-fluent/po/uk/fluent.po",
    },
    {
      locale: "vi",
      po: "package/luci-theme-fluent/po/vi/fluent.po",
    },
    {
      locale: "it",
      po: "package/luci-theme-fluent/po/it/fluent.po",
    },
    {
      locale: "pl",
      po: "package/luci-theme-fluent/po/pl/fluent.po",
    },
  ],
});
