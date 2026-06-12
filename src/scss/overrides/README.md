# Plugin Overrides

This directory holds SCSS partials that provide **plugin-specific** style overrides
for individual OpenWrt LuCI applications (e.g. `luci-app-statistics`,
`luci-app-vnstat`, `luci-app-attendedsysupgrade`).

These overrides tune markup that a particular LuCI plugin generates but the
generic components in `scss/components/` cannot easily account for.

## When to use

- The target style doesn't fit a generic component rule (button, card, table)
- The fix only makes sense for one specific LuCI plugin
- The selector relies on plugin-specific class names or DOM structure

If the rule applies to a general UI pattern, put it in `scss/components/` instead.

## Naming convention

Each file matches the OpenWrt package name in kebab-case, prefixed with `_`:

```
_luci-app-statistics.scss
_luci-app-vnstat.scss
_luci-app-attendedsysupgrade.scss
```

## Adding a new override

1. Create a new partial: `_<package-name>.scss`
2. Add a `@forward` line in `_index.scss`:

   ```scss
   // scss/overrides/_index.scss
   @forward "luci-mod-dashboard";
   @forward "luci-app-example";               // ← add this
   ```

   `fluent.scss` already loads the whole directory via `@use "overrides"`,
   so no other file needs changing.

3. Wrap all rules within a scope selector (see below).

## How it works

`fluent.scss` uses `@use "overrides"` — Dart Sass resolves a directory import
by loading `_index.scss` from that directory. That file manually `@forward`s
each override partial. Add a new `@forward` line for each new override file.

```scss
// fluent.scss
@use "overrides";                          // loads scss/overrides/_index.scss
```

```scss
// scss/overrides/_index.scss  (manually maintained)
@forward "luci-mod-dashboard";
@forward "luci-app-example";
```

## Scope isolation

Always wrap overrides within a selector that limits them to the target plugin's
page. OpenWrt plugins typically set a `.page-<name>` class on `<body>`.

```scss
// scss/overrides/_luci-app-example.scss
body.page-luci-app-example {
  .some-plugin-specific-class {
    // overrides
  }
}
```