include $(TOPDIR)/rules.mk

LUCI_TITLE:=Fluent dashboard for LuCI
LUCI_DEPENDS:=+luci-base +libiwinfo
LUCI_DESCRIPTION:=A fixed-card, theme-independent LuCI status dashboard with system, network, wireless, DHCP lease, and wireless client information.
LUCI_MAINTAINER:=LazuliKao
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_JS:=0

PKG_NAME:=luci-mod-fluentdashboard
PKG_VERSION:=1.0.9
PKG_RELEASE:=4
PKG_LICENSE:=Apache-2.0
PKG_BUILD_DEPENDS:=iwinfo

# call BuildPackage - OpenWrt buildroot signature
include $(TOPDIR)/feeds/luci/luci.mk
