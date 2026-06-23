# Luci-Theme-Fluent Design Document

## Overview

Luci-Theme-Fluent is a modern, FluentUI-inspired theme for OpenWrt's LuCI web interface. Built as a fully independent theme with zero dependencies on luci-theme-argon, it features a complete design system using CSS custom properties, SCSS preprocessing, and ucode templates.

## Architecture

### Directory Structure

```
luci-theme-fluent/
├── htdocs/luci-static/
│   ├── fluent/
│   │   ├── background/          # User-uploaded background images
│   │   ├── fonts/               # Self-contained font files
│   │   ├── icon/                # Theme icons
│   │   └── img/                 # Theme images (logo, placeholders)
│   └── resources/
│       ├── menu-fluent.js       # Sidebar navigation (LuCI module)
│       └── view/
│           └── fluent-config.js # Configuration UI
├── src/scss/
│   ├── fluent.scss              # Main entry point
│   ├── _variables.scss          # Design tokens
│   ├── _mixins.scss             # Reusable patterns
│   ├── _base.scss               # Reset & typography
│   └── components/
│       ├── _buttons.scss
│       ├── _inputs.scss
│       ├── _select.scss
│       ├── _checkboxes.scss
│       ├── _tables.scss
│       ├── _cards.scss
│       ├── _tabs.scss
│       ├── _header.scss
│       ├── _navigation.scss
│       ├── _progress.scss
│       ├── _modals.scss
│       ├── _login.scss
│       ├── _dropdown.scss
│       ├── _scrollbar.scss
│       ├── _sidebar.scss
│       └── _responsive.scss
├── ucode/template/themes/fluent/
│   ├── header.ut                # Main header template
│   ├── header_login.ut          # Login page header
│   ├── footer.ut                # Main footer
│   ├── footer_login.ut          # Login footer
│   ├── out_header_login.ut      # Outer login header
│   └── sysauth.ut               # Login/auth page
├── root/etc/uci-defaults/
│   └── luci-fluent              # Theme registration
├── Makefile                     # OpenWrt package definition
└── package.json                 # Build tooling
```

### CSS Architecture

#### Variable System

All design tokens are CSS custom properties, defined in `:root` and overridden per component:

```css
:root {
  /* Primary colors */
  --fluent-primary: #0078D4;
  --fluent-primary-hover: #106EBE;
  --fluent-primary-active: #005A9E;
  
  /* Neutral colors */
  --fluent-bg: #ffffff;
  --fluent-bg-card: #f9f9f9;
  --fluent-text: #242424;
  --fluent-text-secondary: #616161;
  
  /* Spacing */
  --fluent-spacing-xs: 4px;
  --fluent-spacing-sm: 8px;
  --fluent-spacing-md: 16px;
  --fluent-spacing-lg: 24px;
  --fluent-spacing-xl: 32px;
  
  /* Border radius */
  --fluent-radius-sm: 4px;
  --fluent-radius-md: 8px;
  --fluent-radius-lg: 12px;
  
  /* Shadows */
  --fluent-shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --fluent-shadow-md: 0 4px 8px rgba(0,0,0,0.12);
  --fluent-shadow-lg: 0 8px 16px rgba(0,0,0,0.14);
  
  /* Typography */
  --fluent-font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  --fluent-font-size-xs: 10px;
  --fluent-font-size-sm: 12px;
  --fluent-font-size-md: 14px;
  --fluent-font-size-lg: 16px;
  --fluent-font-size-xl: 20px;
  --fluent-font-weight: 400;
  
  /* Transitions */
  --fluent-transition-fast: 150ms ease;
  --fluent-transition-normal: 250ms ease;
  --fluent-transition-slow: 350ms ease;
}
```

#### Dark Mode Strategy

Dark mode uses CSS custom properties with a single source of truth:

```css
/* Light mode (default) */
:root {
  --fluent-bg: #ffffff;
  --fluent-text: #242424;
}

/* Dark mode via media query */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fluent-bg: #1a1a1a;
    --fluent-text: #ffffff;
  }
}

/* Dark mode via class (manual toggle) */
[data-theme="dark"] {
  --fluent-bg: #1a1a1a;
  --fluent-text: #ffffff;
}
```

**No separate dark.css file** - all color values reference CSS variables, eliminating ~95% duplication.

#### Component Structure

Each component is a standalone SCSS partial:

```scss
// components/_buttons.scss
.fluent-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--fluent-spacing-sm) var(--fluent-spacing-md);
  font-size: var(--fluent-font-size-md);
  font-weight: var(--fluent-font-weight);
  border-radius: var(--fluent-radius-md);
  transition: all var(--fluent-transition-fast);
  
  &--primary {
    background: var(--fluent-primary);
    color: white;
    
    &:hover { background: var(--fluent-primary-hover); }
    &:active { background: var(--fluent-primary-active); }
  }
  
  &--secondary {
    background: transparent;
    border: 1px solid var(--fluent-primary);
    color: var(--fluent-primary);
  }
}
```

### Template Architecture

#### ucode Template System

Templates use ucode syntax (not Lua):

| Feature    | Syntax        | Example                   |
| ---------- | ------------- | ------------------------- |
| Comment    | `{# ... #}`   | `{# This is a comment #}` |
| Code block | `{% ... %}`   | `{% if (mode) { %}`       |
| Output     | `{{ ... }}`   | `{{ media }}`             |
| Raw output | `{{- ... -}}` | `{{- raw_html -}}`        |

#### Auto-Available Globals

These variables are automatically available in all ucode templates:

- `theme` - Current theme name
- `media` - Path to theme static files
- `resource` - Path to LuCI resources
- `node` - Current dispatch node
- `dispatcher` - LuCI dispatcher
- `version` - LuCI version info
- `ctx` - Request context

#### UCI Configuration Integration

The template reads UCI configuration to inject CSS custom properties:

```ucode
{% 
  import { cursor } from 'uci';
  var cfg = cursor();
  var primary = cfg.get_first('fluent', 'global', 'primary') || '#0078D4';
%}
<style>
  :root {
    --fluent-primary: {{ primary }};
  }
</style>
```

### Build Pipeline

#### SCSS Compilation

```json
{
  "scripts": {
    "css:build": "sass --no-source-map src/scss/fluent.scss htdocs/luci-static/fluent/css/fluent.css",
    "css:watch": "sass --no-source-map --watch src/scss/fluent.scss htdocs/luci-static/fluent/css/fluent.css",
    "lint": "biome lint src/scss htdocs",
    "format": "biome format --write src/scss htdocs"
  }
}
```

#### OpenWrt Packaging

The Makefile uses OpenWrt's `luci.mk` build system:

```makefile
include $(TOPDIR)/rules.mk

LUCI_TITLE:=Fluent Theme
LUCI_DEPENDS:=
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
```

### Component Map

| Component  | File               | Description                             |
| ---------- | ------------------ | --------------------------------------- |
| Buttons    | `_buttons.scss`    | Primary, secondary, ghost, icon buttons |
| Inputs     | `_inputs.scss`     | Text, number, email, password fields    |
| Select     | `_select.scss`     | Dropdown selects                        |
| Checkboxes | `_checkboxes.scss` | Checkboxes and radio buttons            |
| Tables     | `_tables.scss`     | Data tables with sorting                |
| Cards      | `_cards.scss`      | Content cards                           |
| Tabs       | `_tabs.scss`       | Tab navigation                          |
| Header     | `_header.scss`     | Top header bar                          |
| Navigation | `_navigation.scss` | Main navigation                         |
| Progress   | `_progress.scss`   | Progress bars                           |
| Modals     | `_modals.scss`     | Modal dialogs                           |
| Login      | `_login.scss`      | Login page                              |
| Dropdown   | `_dropdown.scss`   | Dropdown menus                          |
| Scrollbar  | `_scrollbar.scss`  | Custom scrollbars                       |
| Sidebar    | `_sidebar.scss`    | Sidebar navigation                      |
| Responsive | `_responsive.scss` | Media queries                           |

## Migration Path

### Phase 1: Foundation (Current)
- [x] Project structure
- [x] CSS variable system
- [x] ucode templates
- [x] Build pipeline

### Phase 2: Components
- [ ] All SCSS component partials
- [ ] Component documentation
- [ ] Visual regression tests

### Phase 3: Features
- [ ] Background image management
- [ ] Theme configuration UI
- [ ] Dark mode toggle

### Phase 4: Polish
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Cross-browser testing

### Phase 5: Release
- [ ] Package for OpenWrt
- [ ] Documentation
- [ ] Community feedback

## Success Criteria

- [ ] Zero dependency on luci-theme-argon
- [ ] All CSS variables properly defined
- [ ] Dark mode works via media query and class toggle
- [ ] ucode templates render correctly
- [ ] SCSS compiles without errors
- [ ] OpenWrt package builds successfully
- [ ] Configuration UI functional
- [ ] Responsive on mobile devices
- [ ] Accessible (WCAG 2.1 AA)

## References

- [Microsoft Fluent Design System](https://developer.microsoft.com/en-us/fluentui)
- [LuCI Documentation](https://openwrt.org/docs/techref/luci)
- [ucode Template Language](https://openwrt.org/docs/techref/utpl)
- [Design System](https://fluent2.microsoft.design/design-principles)