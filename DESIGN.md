# Luci-Theme-Fluent Design Document

## Overview

Luci-Theme-Fluent is a modern, FluentUI-inspired theme for OpenWrt's LuCI web interface. Built as a fully independent theme with zero dependencies on luci-theme-argon, it features a complete design system using CSS custom properties, SCSS preprocessing, and ucode templates.

---

## Architecture

### Directory Structure

```
luci-theme-fluent/
├── package/
│   └── luci-theme-fluent/
│       ├── htdocs/luci-static/
│       │   ├── fluent/
│       │   │   ├── background/          # User-uploaded background images
│       │   │   ├── fonts/               # Self-contained font files (optional)
│       │   │   ├── icon/                # Theme icons
│       │   │   └── img/                 # Theme images (logo, placeholders)
│       │   └── resources/
│       │       ├── menu-fluent.js       # Compiled sidebar navigation (LuCI module)
│       │       └── view/
│       │           └── fluent-config.js # Compiled configuration UI
│       ├── ucode/template/themes/fluent/
│       │   ├── header.ut                # Main header template
│       │   ├── header_login.ut          # Login page header
│       │   ├── footer.ut                # Main footer
│       │   ├── footer_login.ut          # Login footer
│       │   ├── out_header_login.ut      # Outer login header
│       │   └── sysauth.ut               # Login/auth page
│       ├── root/
│       │   ├── etc/config/fluent        # Default UCI config
│       │   ├── etc/uci-defaults/        # Theme registration and config setup
│       │   └── usr/                     # Scripts, RPCD, ACL files
│       ├── po/                          # Translation sources
│       └── Makefile                     # OpenWrt package definition
├── src/
│   ├── scss/
│   │   ├── fluent.scss          # Main entry point (imports partials)
│   │   ├── _variables.scss      # Design tokens (Typography, Spacing, Radius, Brand ramps)
│   │   ├── _mixins.scss         # Reusable patterns
│   │   ├── _base.scss           # Reset & typography
│   │   ├── components/          # Component SCSS partials
│   │   ├── layouts/             # Layout SCSS partials
│   │   ├── themes/              # Light/Dark variables
│   │   └── overrides/           # Page-scoped overrides
│   ├── web/
│   │   └── resources/
│   │       ├── menu-fluent.tsx  # Sidebar navigation TSX source
│   │       └── view/
│   │           └── fluent-config.tsx # Config UI TSX source
│   ├── script/                  # Build scripts (extract-ucode, generate-icons, etc.)
│   └── rsbuild.config.ts        # Rsbuild configuration
└── package.json                 # Project build tooling (pnpm workspace)
```

---

## CSS Architecture

### Design Tokens (Variables System)

All design tokens are CSS custom properties, defined in `:root` and aligned with `@fluentui/tokens` v2. The authoritative source for these values is `src/scss/_variables.scss`:

```scss
:root {
  // Typography
  --fluent-font-family: "Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  --fluent-font-size-base: 14px;
  --fluent-font-size-xs: 10px;
  --fluent-font-size-sm: 12px;
  --fluent-font-size-md: 16px;
  --fluent-font-size-lg: 20px;
  --fluent-font-size-xl: 24px;
  --fluent-font-size-xxl: 28px;
  --fluent-font-size-xxxl: 40px;

  --fluent-font-weight-regular: 400;
  --fluent-font-weight-semibold: 600;
  --fluent-font-weight-bold: 700;

  --fluent-line-height-tight: 1.2;
  --fluent-line-height-normal: 1.43;
  --fluent-line-height-relaxed: 1.57;

  // Spacing (4px grid)
  --fluent-space-unit: 4px;
  --fluent-space-xxs: 2px;
  --fluent-space-xs: 4px;
  --fluent-space-sm: 8px;
  --fluent-space-md: 12px;
  --fluent-space-lg: 16px;
  --fluent-space-xl: 24px;
  --fluent-space-xxl: 32px;
  --fluent-space-xxxl: 48px;

  // Border Radius
  --fluent-radius-sm: 2px;
  --fluent-radius-md: 4px;
  --fluent-radius-lg: 8px;
  --fluent-radius-xl: 12px;
  --fluent-radius-circular: 10000px;
  --fluent-radius-round: 50%;

  // Duration & Easing
  --fluent-duration-fast: 150ms;
  --fluent-duration-normal: 250ms;
  --fluent-duration-slow: 400ms;
  --fluent-duration-slower: 500ms;
  --fluent-easing-standard: cubic-bezier(0.8, 0, 0.2, 1);
  --fluent-easing-decelerate: cubic-bezier(0, 0, 0, 1);
  --fluent-easing-accelerate: cubic-bezier(1, 0, 1, 1);
  --fluent-easing-easy-ease: cubic-bezier(0.33, 0, 0.67, 1);

  // Z-Index
  --fluent-zindex-actions: 1000;
  --fluent-zindex-modal: 1100;
  --fluent-zindex-tooltip: 1200;
  --fluent-zindex-toast: 1300;
  --fluent-zindex-dropdown: 1500;
  --fluent-zindex-menu: 1050;
}
```

### Dark Mode Strategy

Dark mode is entirely variable-driven. Instead of maintaining a duplicate stylesheet, light/dark themes are applied by redefining color variables on the `:root` element. The theme toggle is handled via the `data-theme` attribute on `<html>`:

```css
/* Light mode values (Default) */
:root {
  --fluent-primary: #0078d4;
  --fluent-bg: #fafafa;
  --fluent-bg-card: #ffffff;
}

/* Dark mode variables applied to data-theme */
:root[data-theme="dark"] {
  --fluent-primary: #4da6ff;
  --fluent-bg: #1b1b1b;
  --fluent-bg-card: #2d2d2d;
  --fluent-text: #f3f2f1;
  --fluent-text-secondary: #a0a0a0;
  --fluent-border: #404040;
}
```

---

## Template Architecture

### ucode Template System

All server-side templates are written in ucode syntax:

* **Code Execution**: `{% if (mode === 'dark') { %} ... {% } %}`
* **Expression Output**: `{{ media }}` or `{{ border_radius }}`
* **Comments**: `{# Comments #}`

### Global Variables
Ucode templates have automatic access to LuCI global properties: `theme`, `media`, `resource`, `node`, `dispatcher`, `version`, `ctx`.

### UCI Configuration Integration
`header.ut` reads settings directly from UCI config `/etc/config/fluent` using ucode's `uci` cursor and dynamically injects them as inline CSS custom properties, allowing user customization of colors, radii, sidebar widths, and layout spacing at runtime.

---

## Build System & Tooling

The project uses **Rsbuild** (configured in `src/rsbuild.config.ts`) instead of standard Sass compilers. It builds two environments:
1. **CSS environment** (`src/scss/fluent.scss`): Preprocesses SCSS files, inlines inline SVGs, and outputs CSS to `package/luci-theme-fluent/htdocs/luci-static/fluent/css/fluent.css`.
2. **JS environment** (`src/web/resources/`): Compiles React-like JSX/TSX views into OpenWrt-compatible LuCI modules using custom banner/footer plugins.

### Package Scripts

Authoritative scripts inside `package.json`:
* `pnpm run build`: Compiles both SCSS styles and LuCI JS modules.
* `pnpm run watch`: Watches files for dynamic hot-rebuilding.
* `pnpm run lint`: Formats and checks codebase using Biome.
* `pnpm run i18n:build`: Re-extracts and translates all ucode and Javascript strings.
