<div align="center">
<img src="./package/luci-theme-fluent/htdocs/luci-static/fluent/img/fluent.svg" alt="luci-theme-fluent" width="96" />

# luci-theme-fluent

一款受 FluentUI 启发的 OpenWrt LuCI 主题,基于 Rsbuild,使用纯 TypeScript/TSX、SCSS、CSS 自定义属性与 ucode 模板构建。

[![license](https://img.shields.io/badge/license-Apache_2.0-blue.svg?style=flat-square)](./LICENSE)
[![Forum](https://img.shields.io/badge/Forum-OpenWrt-00a2e8.svg?style=flat-square)](https://forum.openwrt.org/t/luci-theme-fluent-fluent-theme-for-openwrt/251341)
[![pnpm](https://img.shields.io/badge/pnpm-10.12.4-f69220.svg?style=flat-square)](./package.json)
[![OpenWrt](https://img.shields.io/badge/OpenWrt-%3E23.05-00a2e8.svg?style=flat-square)](https://openwrt.org/)
[![Chrome](https://img.shields.io/badge/Chrome-%3E%3D125-4285f4.svg?style=flat-square)](https://www.google.com/chrome/)
[![Safari](https://img.shields.io/badge/Safari-%3E%3D26-999999.svg?style=flat-square)](https://www.apple.com/safari/)
[![Firefox](https://img.shields.io/badge/Firefox-%3E%3D147-e66000.svg?style=flat-square)](https://www.mozilla.org/firefox/)
[![release](https://img.shields.io/github/v/release/LazuliKao/luci-theme-fluent?style=flat-square)](https://github.com/LazuliKao/luci-theme-fluent/releases)
[![downloads](https://img.shields.io/github/downloads/LazuliKao/luci-theme-fluent/total?style=flat-square)](https://github.com/LazuliKao/luci-theme-fluent/releases)

**简体中文** | [English](./README.md)

[功能特性](#功能特性) • [界面预览](#界面预览) • [快速上手](#快速上手) • [配置](#配置) • [开发指南](#开发指南) • [致谢](#致谢)
</div>

## 界面预览

<p align="center">
  <img src="./screenshots/zh-Hans/showcase_banner.png" alt="展示横幅" width="100%" />
</p>

<p align="center">
  <img src="./screenshots/zh-Hans/showcase_mobile_promo.png" alt="移动端展示" width="100%" />
</p>

<p align="center">
  <img src="./screenshots/zh-Hans/overview_theme_comparison.png" alt="主题对比总览" width="100%" />
</p>

<p align="center">
  <img src="./screenshots/zh-Hans/login_theme_comparison.png" alt="登录页主题对比" width="100%" />
</p>

## 功能特性

- 为 LuCI 打造的 FluentUI 风格视觉体验。
- 基于 SCSS 的架构,组件样式模块化、可复用。
- 主题令牌由 CSS 自定义属性驱动,支持浅色/深色/自动模式。
- 使用 ucode 模板渲染 LuCI 页头、页脚与登录页。
- 提供主题设置界面,可配置颜色、动画与登录页外观。
- 针对特定插件页面提供结构化的样式覆盖。
- 提供可选且不依赖主题的 `luci-mod-fluentdashboard` 状态概览。

## 快速上手

### 一键安装

脚本会自动检测 `opkg` / `apk`,默认安装最新正式版:

```bash
wget -qO- https://raw.githubusercontent.com/LazuliKao/luci-theme-fluent/main/install.sh | sh
```

安装每日构建版(nightly):

```bash
wget -qO- https://raw.githubusercontent.com/LazuliKao/luci-theme-fluent/main/install.sh | sh -s nightly
```

安装完成后,在 LuCI 界面中进入 `系统 -> Fluent 主题` 即可配置。

### 手动安装

1. 打开发布页面,下载与你的系统匹配的软件包:
   - 正式版:<https://github.com/LazuliKao/luci-theme-fluent/releases>
   - 每日构建版:<https://github.com/LazuliKao/luci-theme-fluent/releases/tag/nightly>
2. 将下载的文件上传到路由器,例如 `/tmp/` 目录。
3. 使用对应的包管理器进行安装:

```bash
# OpenWrt 24.10.x
opkg install /tmp/luci-theme-fluent_*.ipk

# OpenWrt 25.12.x
apk add --allow-untrusted /tmp/luci-theme-fluent-*.apk
```

### 从 OpenWrt 源码树安装

你可以通过以下两种方式之一将本软件包添加到 OpenWrt 编译系统中：

#### 方法一：克隆仓库并复制软件包目录

```bash
cd openwrt
git clone --depth=1 https://github.com/LazuliKao/luci-theme-fluent.git /tmp/luci-theme-fluent
# OpenWrt 要求软件包目录直接位于 `package/` 下。
cp -a /tmp/luci-theme-fluent/package/luci-theme-fluent package/
```

#### 方法二：添加到 feeds

在 `feeds.conf.default` 中添加以下行：

```text
src-git fluent https://github.com/LazuliKao/luci-theme-fluent.git
```

然后更新并安装 feed：

```bash
./scripts/feeds update fluent
./scripts/feeds install -a -p fluent
```

添加软件包后，在 `menuconfig` 中进行配置和选择：

```bash
make menuconfig
```

选择 `LuCI -> Themes -> luci-theme-fluent`，然后像往常一样构建固件或软件包即可。

### Fluent 状态概览

`luci-mod-fluentdashboard` 是适用于 OpenWrt 24.10 和 25.12 的可选固定卡片式状态概览。它使用独立的 `admin/fluentdashboard` 路由，可配合任意 LuCI 主题使用，也可以与官方 `luci-mod-dashboard` 同时安装。

```bash
# OpenWrt 24.10.x
opkg install /tmp/luci-mod-fluentdashboard_*.ipk

# OpenWrt 25.12.x
apk add --allow-untrusted /tmp/luci-mod-fluentdashboard-*.apk
```

该模块显示系统、内存与存储、WAN、接口流量、无线、DHCP 租约及无线客户端信息。其资源和简体中文翻译软件包均与主题独立构建。

## 配置

主题提供了 LuCI 设置页面,支持配置以下内容:

- 颜色模式(浅色/深色/自动)
- 主题色
- 动画行为
- 登录页外观

设置界面实现位于 `src/web/resources/view/fluent-config.tsx`。

## 开发指南

### 安装依赖

在仓库根目录执行一次。

```bash
pnpm install
```

### 常用命令

以下命令均应在仓库根目录执行：

```bash
# 构建 CSS 和 LuCI JavaScript/TSX 资源。
pnpm run build
# 监听源码变化并自动重新构建资源。
pnpm run watch
# 使用 Biome 检查软件包网页资源和 LuCI 资源。
pnpm run lint
# 对 `src` 中的 TypeScript 项目执行类型检查。
pnpm run typecheck
# 提取并构建翻译；需要在 `.env` 中设置 `OPENAI_API_KEY`。
pnpm run i18n:build
# 提取独立状态概览的翻译目录。
pnpm run i18n:dashboard
```

### 输出路径

- CSS:`package/luci-theme-fluent/htdocs/luci-static/fluent/css/fluent.css`
- JS:`package/luci-theme-fluent/htdocs/luci-static/resources/`
- 状态概览：`package/luci-mod-fluentdashboard/htdocs/luci-static/resources/view/fluentdashboard/`
这些 CSS 和 JavaScript 文件由构建生成，请勿直接编辑。

### 项目结构

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

### 源码布局

- `src/scss/fluent.scss` 是 Sass 的主入口文件。
- `src/scss/components/` 存放可复用的组件样式。
- `src/scss/layouts/` 存放页面级布局样式。
- `src/scss/overrides/` 存放针对特定插件的样式覆盖。
- `src/web/resources/` 存放 LuCI 侧的 TypeScript/TSX 代码。

## 致谢

- [Microsoft Fluent Design](https://developer.microsoft.com/en-us/fluentui)
- [LuCI 文档](https://openwrt.org/docs/techref/luci)
- [ucode 模板语言](https://openwrt.org/docs/techref/utpl)
- [Apache License 2.0](./LICENSE)
