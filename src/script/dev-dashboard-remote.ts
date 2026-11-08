import { resolve } from "node:path";
import { devRemote, loadDevRemoteConfig } from "@lazulikao/luci-types/dev";

const config = loadDevRemoteConfig();
config.buildCommand = "pnpm run watch:dashboard";
config.localDistPaths = [resolve("package/luci-mod-fluentdashboard/htdocs/luci-static/resources")];
config.remotePaths = ["/www/luci-static/resources"];

await devRemote(config);
