# AGENTS.md - luci-theme-fluent Developer Guide

**FluentUI 2 theme for OpenWrt LuCI** — standalone repo (not monorepo). Built with SCSS, ucode templates, CSS custom properties for light/dark/auto theming.

- **Repo**: `LazuliKao/luci-theme-fluent` (separate, not `luci-theme-argon`)
- **Branch**: `openwrt-24.10`, `main`
- **Targets**: OpenWrt 24.10.7 (opkg/ipk), OpenWrt 25.12.4 (apk)

## Quick Start

```bash
pnpm install          # install deps from root + src/ (pnpm workspace)
pnpm run build        # compile SCSS + LuCI JS/TSX (runs "cd src && pnpm run build")
pnpm run watch        # auto-rebuild both
pnpm run lint         # Biome lint on package/luci-theme-fluent/htdocs/ + src/web/resources/
pnpm run typecheck    # "cd src && tsc -p tsconfig.json --noEmit"
```

## Build System (Rsbuild)

The project uses **Rsbuild** (not raw sass CLI) configured in `src/rsbuild.config.ts` with two environments:

| Environment | Entry | Output | Notes |
|---|---|---|---|
| `css` | `src/scss/fluent.scss` | `package/luci-theme-fluent/htdocs/luci-static/fluent/css/fluent.css` | Sass via `@rsbuild/plugin-sass`, SVG inlining via `dataUriLimit: MAX_SAFE_INTEGER`. Custom plugin removes generated `fluent.js`. Minify: off. |
| `js` | `src/web/resources/{menu-fluent.tsx, view/fluent-config.tsx}` | `package/luci-theme-fluent/htdocs/luci-static/resources/{menu-fluent.js, view/fluent-config.js}` | React JSX via `@lazulikao/luci-types`, LuCI `require` preamble via `BannerPlugin`, `return main;` footer. Minify: on (but splitChunks/runtimeChunk off). |

**Key rsbuild quirks**:

- JS env has `rspack.BannerPlugin` prepending `"require baseclass"` / `"require ui"` and appending `return main;`.
- CSS env has `RemoveEntryJsPlugin` that deletes `fluent.js` from output.
- `splitChunks: false`, `runtimeChunk: false`, `minimize: false` in JS env.

## Project Structure

```
luci-theme-fluent/
├── package/
│   └── luci-theme-fluent/
│       ├── htdocs/luci-static/
│       │   ├── fluent/css/fluent.css       # Compiled CSS (NOT committed? check .gitignore)
│       │   ├── fluent/background/          # User-uploaded backgrounds
│       │   ├── fluent/fonts/               # Empty directory
│       │   ├── fluent/icon/                # favicon.ico, icon-192.png, favicon-32.png, manifest.json
│       │   ├── fluent/img/fluent.svg       # Theme logo
│       │   └── resources/                  # Compiled JS: menu-fluent.js, view/fluent-config.js
│       ├── ucode/template/themes/fluent/   # 6 ucode templates (header.ut, footer.ut, header_login.ut, footer_login.ut, out_header_login.ut, sysauth.ut)
│       ├── root/
│       │   ├── etc/config/fluent           # Default UCI config (40+ options)
│       │   ├── etc/uci-defaults/luci-fluent # Theme registration + default config initialization
│       │   ├── usr/libexec/fluent/online_wallpaper  # Shell script: fetches Bing/Unsplash login backgrounds
│       │   ├── usr/libexec/rpcd/luci.fluent        # RPC daemon: list/remove/rename background files
│       │   ├── usr/share/luci/menu.d/luci-theme-fluent.json  # Menu registration for config view
│       │   └── usr/share/rpcd/acl.d/luci-theme-fluent.json   # ACL permissions: fluent UCI + background file access
│       ├── po/
│       │   ├── templates/fluent.pot        # POT template (66 strings)
│       │   └── zh_Hans/fluent.po           # Simplified Chinese translations
│       └── Makefile                        # OpenWrt package definition
├── src/
│   ├── scss/
│   │   ├── fluent.scss            # Entry point (47 @use imports)
│   │   ├── _variables.scss        # Design tokens (157 lines: typography, spacing, radius, z-index, brand ramps)
│   │   ├── _mixins.scss           # Responsive breakpoints, button/input/card/table/scrollbar mixins (394 lines)
│   │   ├── _icons.scss            # 15 FluentUI SVG icons as SCSS variables, fluent-icon() + fluent-icon-content() mixins
│   │   ├── _base.scss             # CSS reset, typography, animations (437 lines)
│   │   ├── components/            # 24 component partials
│   │   │   ├── _buttons, _inputs, _textarea, _select, _checkboxes
│   │   │   ├── _tables, _cards, _tabs, _navigation, _dropdown
│   │   │   ├── _dynlist, _password, _modals, _progress, _scrollbars
│   │   │   ├── _errors, _alert-message, _cbi-forms, _cbi-dialogs
│   │   │   ├── _cbi-network, _cbi-widgets, _dashboard, _menu-button, _tooltips
│   │   ├── layouts/               # _login, _sidebar, _header, _main (4 files)
│   │   ├── themes/                # _light.scss, _dark.scss
│   │   └── overrides/             # Plugin-specific SCSS overrides
│   │       ├── index.scss         # @forward dispatcher (manual maintenance)
│   │       ├── overrides-utils    # Shared override utilities
│   │       ├── luci-mod-dashboard, luci-app-firewall
│   │       ├── system-channel_analysis, admin-status-realtime
│   │       └── README.md          # How to add new overrides (page-scoped, body.page-* selector)
│   ├── web/
│   │   ├── index.ts               # Just declares baseclass + ui types
│   │   └── resources/
│   │       ├── menu-fluent.tsx     # Entry: renders sidebar nav + tab menus via LuCI menu API
│   │       ├── utils/              # 6 helpers: error-tooltips, poll-pause, slide-animations, select-dropdown, ifacebox-tooltip, theme-features
│   │       └── view/
│   │           ├── fluent-config.tsx     # Config UI (4 tabs: general/colors/animation/login)
│   │           ├── shared.ts             # Color picker widget, transparency steps
│   │           └── tabs/                 # {general, colors, animation, login}.ts — each registers section.taboption()
│   ├── script/
│   │   ├── extract-ucode.ts       # Bridge: scans package-local .ut files for `_('...')`, filters LuCI core strings, generates extra-strings.js
│   │   ├── generate-icons.ts      # Generates favicon-32.png + icon-192.png from package-local fluent.svg
│   │   ├── fluent-icons.json      # Iconify mapping: SCSS var name → @iconify-json/fluent icon name
│   │   └── translate.md           # AI translation prompt for luci-types i18n --translate (zh_Hans)
│   └── rsbuild.config.ts, package.json, tsconfig.json
├── .github/workflows/
│   ├── ci.yml                      # Push/PR: SCSS build → lint → 2 SDK matrix builds → nightly release
│   ├── release.yml                 # Tag push: build for 24.10.7 + 25.12.4 → GitHub release
│   └── build.sh                    # SDK download + compile script (shared by both workflows)
└── package.json                    # Workspace build tooling
```

## SCSS Rules

1. **All colors/spacing via CSS custom properties** — defined in `_variables.scss`, never hardcoded
2. **Component-based** — one partial per component in `scss/components/`
3. **No `!important`** — unless overriding `cascade.css` (then document why)
4. **BEM naming** — `.block__element--modifier`
5. **Max 3 levels nesting**
6. **Mobile-first** — `min-width` media queries. Breakpoints: sm(576), md(768), lg(992), xl(1200), xxl(1400)
7. **Dark mode via vars** — themes switch CSS vars, not separate files. Header.ut injects light/dark overrides inline.

## ucode Template Rules

- **Syntax**: `{% %}` code, `{{ }}` output, `{# #}` comments
- **Globals**: `theme`, `media`, `resource`, `node`, `dispatcher`, `version`, `ctx`
- **UCI**: `import { cursor } from 'uci'` — `cfg.get_first('fluent', 'global', 'key') || 'default'`
- **FS**: `import { access, glob } from 'fs'`
- **System info**: `ubus.call('system', 'board')`
- **Escape**: `entityencode()` or `pcdata()`
- **Login page** (`sysauth.ut`): 2-step form (username → password), Microsoft dynamic canvas / Bing/Unsplash / custom backgrounds, video support, HTTPS redirect check
- **Header** (`header.ut`): Injects 40+ CSS vars from UCI, dark mode detection + localStorage persistence, loading bar, view transitions API, theme toggle button

## UCI Configuration (`/etc/config/fluent`)

Available UCI options (set defaults in `package/luci-theme-fluent/root/etc/config/fluent` and `package/luci-theme-fluent/root/etc/uci-defaults/luci-fluent`):

| Group | Keys |
|---|---|
| Mode | `mode` (normal/light/dark) |
| Colors | `primary`, `dark_primary`, `page_bg`, `card_bg`, `sidebar_bg`, `dark_page_bg`, `dark_card_bg`, `dark_sidebar_bg`, `progressbar_font`, `dark_progressbar_font` |
| Typography | `font_weight` (400/600), `font_size` (14 default) |
| Layout | `sidebar_width` (260), `sidebar_style`, `header_height` (48), `border_radius` (4), `control_height` (32/42), `card_shadow` (none/small/medium/large) |
| Login | `login_bg` (builtin/bing/unsplash/microsoft), `blur`, `blur_dark`, `transparency`, `transparency_dark` |
| Animation | `transition_speed` (fast/normal/slow/none), `view_transition`, `tab_animation`, `loading_bar`, `prefers_reduced_motion`, `custom_select` |
| Advanced | `custom_css` |

## i18n / Translation Pipeline

```bash
pnpm run i18n:extract       # → package/luci-theme-fluent/po/templates/fluent.pot (66 strings)
pnpm run i18n:export        # → package/luci-theme-fluent/po/zh_Hans/fluent.po (AI-translated via OpenAI)
pnpm run i18n:extract-ucode # Discover ucode-only translatable strings
pnpm run i18n:build         # All three steps
```

**Key**: Extraction uses `luci-types i18n` CLI (from `@lazulikao/luci-types`). Since it can't parse `.ut` files, `extract-ucode.ts` scans ucode templates for `_('...')`, filters out LuCI core strings, and generates `extra-strings.js` which is passed as an additional `-i` input.

**Export**: Uses `dotenvx run` to load `OPENAI_API_KEY` from `.env`, with the translate prompt from `src/script/translate.md`. Requires `.env` setup.

**5 custom ucode strings**: "Login", "Next", "Please enter your password.", "Please enter your username.", "Toggle dark mode", "Username is required."

## CI/CD

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Push/PR to `main`/`openwrt-24.10` | SCSS build → lint → SDK build (24.10.7 ipk + 25.12.4 apk) → nightly release |
| `release.yml` | Tag push `v*` | CSS build → SDK builds → GitHub release |

**Nightly**: Creates pre-release tag named `nightly` with both ipk and apk packages.

**SDK build** (`.github/workflows/build.sh`): Auto-discovers SDK tarball from `downloads.openwrt.org`, uses `sed` to replace git.openwrt.org with GitHub mirrors for faster feeds, only builds `package/luci-theme-fluent/compile`, collects `luci-theme-fluent*` + `luci-i18n-fluent*` packages.

## Web Resources Architecture

- **`menu-fluent.tsx`** — Main entry: renders sidebar nav (2-level) + tab menus via LuCI `ui.menu` API. Uses `baseclass.extend(module)` pattern. Initializes 6 utility features on load.
- **`fluent-config.tsx`** — Config view: `L.view` subclass, 4 tabs registered via `section.tab()`. Reads/writes `uci.load("fluent")`.
- **TSX**: Uses `@lazulikao/luci-types` JSX import source (not standard React). JSX creates LuCI DOM elements.
- **Built by**: Rsbuild with `@rsbuild/core` + `@rsbuild/plugin-sass` + `@rspack/core`.

## OpenWrt Packaging

`package/luci-theme-fluent/Makefile` uses `luci.mk` build system. `LUCI_MINIFY_CSS:=0` prevents luci.mk from minifying (handled by rsbuild). Post-install registers theme via `uci set luci.themes.fluent=/luci-static/fluent`.

## Key Constraints

1. **JSX uses non-standard import**: `importSource: "@lazulikao/luci-types"` (not React). JSX elements are LuCI DOM nodes, not React components.
2. **SCSS files excluded from Biome**: `biome.json` ignores `src/scss/**/*`.
3. **RSBuild CSS output cleanup**: `RemoveEntryJsPlugin` prevents `fluent.js` from appearing in CSS output.
4. **Po files in `package/luci-theme-fluent/po/` auto-processed**: OpenWrt `luci.mk` converts them to translation JSON at build time.
5. **Template entry**: `header.ut` handles both authenticated pages AND login page rendering (via `ctx.authsession` check).
6. **`package/luci-theme-fluent/root/etc/config/fluent`** and **`package/luci-theme-fluent/root/etc/uci-defaults/luci-fluent`** are the authoritative source for default UCI config values.

## Troubleshooting

| Issue | Check |
|---|---|
| CSS not loading | `package/luci-theme-fluent/htdocs/luci-static/fluent/css/fluent.css` exists? |
| Dark mode wrong | UCI `mode` set correctly? CSS vars injected? localStorage `fluent-theme` override? |
| Build fails | `pnpm install` first. Rsbuild config in `src/rsbuild.config.ts`. SCSS lint via Biome (but ignores SCSS files). |
| Template error | ucode: `{% %}` not `<% %>`, `{{ }}` not `<%= %>` |
| CI SDK fails | `.github/workflows/build.sh` — SDK URL auto-discovery, HTTP 200 check |
| i18n fails | `.env` has `OPENAI_API_KEY`? `pnpm run build` compiled JS first? |

## 额外注意事项

- **不扩散原则**：组件样式只影响自身或者给定区域，避免全局样式污染
- **一致性原则**：同一组件在不同页面/场景保持视觉和交互一致，避免过度添加padding或者margin来适应不同布局，容易导致多层padding叠加过大
- **非必要不添加额外布局**：有些组件OpenWrt有一些基础样式并且正常布局依赖这些样式，避免额外添加flex之类导致布局混乱
- **避免硬编码与无意义后备值**：使用 CSS 变量时，直接使用变量名（如 `var(--fluent-text)`），不需要也不应该提供默认色后备值（如 `var(--fluent-text, #323130)`），避免代码冗余和后续维护可能出现的硬编码问题。
