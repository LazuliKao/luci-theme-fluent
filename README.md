<div align="center">
<img src="./package/luci-theme-fluent/htdocs/luci-static/fluent/img/fluent.svg" alt="luci-theme-fluent" width="96" />

# luci-theme-fluent

A FluentUI-inspired OpenWrt LuCI theme built with Rsbuild using pure TypeScript/TSX, SCSS, CSS custom properties, and ucode templates.

[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg?style=flat-square)](./LICENSE)
[![Forum](https://img.shields.io/badge/Forum-OpenWrt-00a2e8.svg?style=flat-square)](https://forum.openwrt.org/t/luci-theme-fluent-fluent-theme-for-openwrt/251341)
[![pnpm](https://img.shields.io/badge/pnpm-10.12.4-f69220.svg?style=flat-square)](./package.json)
[![OpenWrt](https://img.shields.io/badge/OpenWrt-%3E23.05-00a2e8.svg?style=flat-square)](https://openwrt.org/)
[![Chrome](https://img.shields.io/badge/Chrome-%3E%3D125-4285f4.svg?style=flat-square)](https://www.google.com/chrome/)
[![Safari](https://img.shields.io/badge/Safari-%3E%3D26-999999.svg?style=flat-square)](https://www.apple.com/safari/)
[![Firefox](https://img.shields.io/badge/Firefox-%3E%3D147-e66000.svg?style=flat-square)](https://www.mozilla.org/firefox/)
[![release](https://img.shields.io/github/v/release/LazuliKao/luci-theme-fluent?style=flat-square)](https://github.com/LazuliKao/luci-theme-fluent/releases)
[![downloads](https://img.shields.io/github/downloads/LazuliKao/luci-theme-fluent/total?style=flat-square)](https://github.com/LazuliKao/luci-theme-fluent/releases)

**English** | [简体中文](./README.zh-Hans.md)

[Features](#key-features) • [Showcase](#showcase) • [Getting Started](#getting-started) • [Configuration](#configuration) • [Development](#development) • [Credits](#credits)
</div>

## Showcase

<p align="center">
  <img src="./screenshots/showcase_banner.png" alt="Showcase banner" width="100%" />
</p>

<p align="center">
  <img src="./screenshots/showcase_mobile_promo.png" alt="Showcase banner" width="100%" />
</p>

<p align="center">
  <img src="./screenshots/overview_theme_comparison.png" alt="Theme comparison overview" width="100%" />
</p>

<p align="center">
  <img src="./screenshots/login_theme_comparison.png" alt="Login theme comparison" width="100%" />
</p>

## Key Features

- FluentUI-inspired visual style for LuCI.
- SCSS-based architecture with reusable partials.
- Theme tokens driven by CSS custom properties.
- ucode templates for LuCI header, footer, and login pages.
- Theme settings UI for colors, animation, and login appearance.
- Structured overrides for plugin-specific OpenWrt pages.

## Getting Started

### Quick Install

Auto-detects `opkg` / `apk` and installs the latest release by default:

```bash
wget -qO- https://raw.githubusercontent.com/LazuliKao/luci-theme-fluent/main/install.sh | sh
```

Install the nightly build instead:

```bash
wget -qO- https://raw.githubusercontent.com/LazuliKao/luci-theme-fluent/main/install.sh | sh -s nightly
```

After installation, navigate to `System -> Fluent Theme` in the LuCI web interface.

### Manual Installation

1. Open the release page and download the package file matching your system:
   - Stable releases: <https://github.com/LazuliKao/luci-theme-fluent/releases>
   - Nightly release: <https://github.com/LazuliKao/luci-theme-fluent/releases/tag/nightly>
2. Upload the downloaded file to your router, for example into `/tmp/`.
3. Install it with the matching package manager:

```bash
# OpenWrt 24.10.x
opkg install /tmp/luci-theme-fluent_*.ipk

# OpenWrt 25.12.x
apk add --allow-untrusted /tmp/luci-theme-fluent-*.apk
```

### Install from an OpenWrt source tree

You can add this package to your OpenWrt build system in one of two ways:

#### Option 1: Clone the repository and copy the package directory

```bash
cd openwrt
git clone --depth=1 https://github.com/LazuliKao/luci-theme-fluent.git /tmp/luci-theme-fluent
# OpenWrt expects the package directory directly under `package/`.
cp -a /tmp/luci-theme-fluent/package/luci-theme-fluent package/
```

#### Option 2: Add to feeds

Add the following line to your `feeds.conf.default`:

```text
src-git fluent https://github.com/LazuliKao/luci-theme-fluent.git
```

Then update and install the feed:

```bash
./scripts/feeds update fluent
./scripts/feeds install -a -p fluent
```

After adding the package, configure and select it in `menuconfig`:

```bash
make menuconfig
```

Choose `LuCI -> Themes -> luci-theme-fluent`, then build your firmware or package as usual.

## Configuration

The theme exposes a LuCI settings page for:

- color mode
- primary colors
- animation behavior
- login page appearance

The settings view is implemented in `src/web/resources/view/fluent-config.tsx`.

## Development

### Install dependencies

Run this once from the repository root.

```bash
pnpm install
```

### Common commands

Run these commands from the repository root:

```bash
# Build the CSS and LuCI JavaScript/TSX assets.
pnpm run build
# Watch source files and rebuild assets on changes.
pnpm run watch
# Run Biome lint on the package web assets and LuCI resources.
pnpm run lint
# Type-check the TypeScript project in `src`.
pnpm run typecheck
# Extract and build translations; requires `OPENAI_API_KEY` in `.env`.
pnpm run i18n:build
```

### Output paths

- CSS: `package/luci-theme-fluent/htdocs/luci-static/fluent/css/fluent.css`
- JS: `package/luci-theme-fluent/htdocs/luci-static/resources/`
These CSS and JavaScript files are generated by the build and should not be edited manually.

### Project structure

```text
luci-theme-fluent/
├── package/luci-theme-fluent/htdocs/luci-static/fluent/
├── package/luci-theme-fluent/ucode/template/themes/fluent/
├── package/luci-theme-fluent/root/etc/uci-defaults/
├── package/luci-theme-fluent/Makefile
├── src/scss/
├── src/web/resources/
└── package.json
```

### Source layout

- `src/scss/fluent.scss` is the main Sass entry point.
- `src/scss/components/` contains reusable component styles.
- `src/scss/layouts/` contains page-level layout styles.
- `src/scss/overrides/` contains plugin-specific overrides.
- `src/web/resources/` contains the LuCI-side TypeScript/TSX code.

## Credits

- [Microsoft Fluent Design](https://developer.microsoft.com/en-us/fluentui)
- [LuCI documentation](https://openwrt.org/docs/techref/luci)
- [ucode template language](https://openwrt.org/docs/techref/utpl)
- [Apache License 2.0](./LICENSE)
