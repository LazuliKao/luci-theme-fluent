import { defineConfig } from "@lazulikao/luci-types/i18n";

export default defineConfig({
	packageName: "luci-theme-fluent",
	input: [
		"package/luci-theme-fluent/htdocs/luci-static/resources",
		"src/script/.cache/extra-strings.js",
	],
	pot: "package/luci-theme-fluent/po/templates/fluent.pot",
	extractPot: true,

	translate: {
		enabled: true,
		translator: "openai",
		batchSize: 20,
		prompt: "src/script/translate.${locale}.md",
	},

	locales: [
		{
			locale: "zh_Hans",
			po: "package/luci-theme-fluent/po/zh_Hans/fluent.po",
		},
		{
			locale: "es",
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
	],
});
