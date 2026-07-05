import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FLUENT_DEFAULTS } from "../web/resources/fluent-defaults";

export const generateThemeDefaults = (): void => {
  const here = dirname(fileURLToPath(import.meta.url));
  const moduleOutputPath = join(here, "../../package/luci-theme-fluent/root/usr/share/luci-theme-fluent/fluent-defaults.uc");
  const templateOutputPath = join(here, "../../package/luci-theme-fluent/ucode/template/themes/fluent/defaults.ut");
  const entries = Object.entries(FLUENT_DEFAULTS)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
    .join(",\n");
  const templateAssignments = Object.entries(FLUENT_DEFAULTS)
    .map(([key, value]) => `  defaults.${key} = ${JSON.stringify(value)};`)
    .join("\n");
  mkdirSync(dirname(moduleOutputPath), { recursive: true });

  writeFileSync(moduleOutputPath, `return {\n${entries}\n};\n`, "utf8");
  writeFileSync(templateOutputPath, `{%\n${templateAssignments}\n%}\n`, "utf8");
}
