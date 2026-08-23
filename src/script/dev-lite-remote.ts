import { resolve } from "node:path";
import { devRemote, loadDevRemoteConfig } from "@lazulikao/luci-types/dev";

const config = loadDevRemoteConfig();
config.buildCommand = "pnpm run watch:lite";
const full = "package/luci-theme-fluent";
const lite = "package/luci-theme-fluent-lite";

// Lite replaces generated assets and service permissions; templates, defaults,
// and static assets are copied from the full source package during its build.
config.localDistPaths = [
  resolve(lite, "htdocs/luci-static/fluent/css"),
  resolve(lite, "htdocs/luci-static/resources"),
  resolve(full, "ucode/template/themes/fluent"),
  resolve(full, "root/etc/uci-defaults"),
  resolve(lite, "root/usr/libexec/rpcd"),
  resolve(full, "root/usr/share/luci/menu.d"),
  resolve(lite, "root/usr/share/rpcd/acl.d"),
  resolve(full, "htdocs/luci-static/fluent/icon"),
  resolve(full, "htdocs/luci-static/fluent/img"),
];
config.remotePaths = [
  "/www/luci-static/fluent/css",
  "/www/luci-static/resources",
  "/usr/share/ucode/luci/template/themes/fluent",
  "/etc/uci-defaults",
  "/usr/libexec/rpcd",
  "/usr/share/luci/menu.d",
  "/usr/share/rpcd/acl.d",
  "/www/luci-static/fluent/icon",
  "/www/luci-static/fluent/img",
];

await devRemote(config);
