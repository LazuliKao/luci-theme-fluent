import { resolve } from "node:path";
import { devRemote, loadDevRemoteConfig } from "@lazulikao/luci-types/dev";

const config = loadDevRemoteConfig();
config.buildCommand = "pnpm run watch:dashboard";
config.localDistPaths = [
  resolve("package/luci-mod-fluentdashboard/htdocs/luci-static/resources"),
  resolve("package/luci-mod-fluentdashboard/root/usr/share/rpcd/ucode"),
  resolve("package/luci-mod-fluentdashboard/root/usr/share/rpcd/acl.d"),
];
config.remotePaths = ["/www/luci-static/resources", "/usr/share/rpcd/ucode", "/usr/share/rpcd/acl.d"];

await devRemote(config);
