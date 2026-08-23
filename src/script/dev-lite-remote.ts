import { existsSync } from "node:fs";
import { devRemote, loadDevRemoteConfig } from "@lazulikao/luci-types/dev";

const config = loadDevRemoteConfig();
config.buildCommand = "pnpm run watch:lite";
config.localDistPaths = config.localDistPaths.map((path) => {
  const litePath = path.replace(/([\\/])luci-theme-fluent(?=[\\/]|$)/, "$1luci-theme-fluent-lite");
  return litePath !== path && existsSync(litePath) ? litePath : path;
});

await devRemote(config);
