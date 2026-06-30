# Plugin Overrides

This directory holds SCSS partials that provide **plugin-specific** style overrides
for individual OpenWrt LuCI applications.

These overrides tune markup that a particular LuCI plugin generates but the
generic components in `scss/components/` cannot easily account for.

## When to use

- The target style doesn't fit a generic component rule (button, card, table)
- The fix only makes sense for one specific LuCI plugin or admin page
- The selector relies on plugin-specific class names or DOM structure

If the rule applies to a general UI pattern, put it in `scss/components/` instead.

## Naming convention

Each file uses the OpenWrt package name as a prefix, prefixed with an underscore:

```text
_luci-mod-dashboard.scss
_admin-status-realtime.scss
_admin-status-overview.scss
_system-channel_analysis.scss
_admin-status-nftables-iptables.scss

## Adding a new override

1. **Create a new partial file** named with the package/admin page identifier:

   ```
   _<package-name>.scss
   ```

2. **Add a `@forward` entry** in `_index.scss`:

   ```scss
   // scss/overrides/_index.scss
   @forward "luci-mod-dashboard";
   @forward "system-channel_analysis";
   // ↑ add this line
   ```

   `_index.scss` is the directory entry point — manually maintain it.

3. **Wrap with a scope selector** to isolate styles to the target page/plugin:

   See below for selector strategies.

4. **Use base classes and mixins** where available:
   - `@use "../mixins" as *` — responsive breakpoints, theme context, etc.
   - `@use "overrides-utils" as *` — `plugin-prefix()`, `__mask_svg`, etc.

## Available macros / mixins

### `@include plugin($page_id)`

Wraps rules scoped to a page that uses `body[data-page="$page_id"]`.

### `@include plugin_prefix($plugin_id)`

Shorter syntax — equivalent to `@include plugin("luci-app-" + $plugin_id)`,
used when the package ID doesn't match the full LuCI app name.

### `__mask_svg()`

Masks an SVG icon with a Fluent theme background / color. Accepts the same
tokens as `fluent-icon()` mixins from `scss/icons/_icons.scss`.

## Scope isolation

Always wrap overrides within a selector that limits them to the target page or
plugin context. OpenWrt typically sets classes/attributes in two ways:

### 1. Page-scoped selectors

Most common: `body[data-page="..."` or `body.page-...`:

```scss
// scss/overrides/_luci-mod-dashboard.scss
body[data-page="admin-dashboard"] {
  .router-status-wifi .settings-info {
    // dashbaord-specific layout
  }
}
```

### 2. Plugin-prefix / full-page-scoped selectors

Some packages use `_prefix()` to resolve their full names, or use `body.page-<plugin>`
for known plugins (e.g., some `luci-app-*` packages set this directly on `<body>`):

```scss
// scss/overrides/_luci-app-firewall.scss
body.page-luci-app-firewall {
  #view > div.right {
    // firewall panel
  }
}
```

## Example: Dashboard cards

```scss
// scss/overrides/_luci-mod-dashboard.scss
body[data-page="admin-dashboard"] {
  .dashboard-bg {
    border: 1px solid var(--fluent-card-border);
    border-radius: var(--fluent-card-radius);
    box-shadow: var(--fluent-card-shadow);
    padding: var(--fluent-card-padding);
  }

  .label {
    padding: 1px 8px;
    border-radius: var(--fluent-radius-sm);
    font-size: var(--fluent-font-size-xs);
    font-weight: var(--fluent-font-weight-semibold);
  }

  .label-success {
    background: var(--fluent-success-light);
    color: var(--fluent-success);
  }

  .label-danger {
    background: var(--fluent-error-light);
    color: var(--fluent-error);
  }

  @include respond-down("md") {
    // mobile override
  }
}
```

## Current overrides

 - `system-channel_analysis` — Realtime channel monitoring page
 - `admin-status-realtime` — Realtime status page (nftables/iptables traffic)
 - `admin-status-overview` — Admin status overview page
 - `admin-status-nftables-iptables` — Firewall section (traffic pane)
