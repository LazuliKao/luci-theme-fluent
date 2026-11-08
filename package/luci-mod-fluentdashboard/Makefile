include $(TOPDIR)/rules.mk

LUCI_TITLE:=Fluent dashboard for LuCI
LUCI_DEPENDS:=+luci-base +libiwinfo +rpcd-mod-ucode +ucode-mod-fs +ucode-mod-uci
LUCI_DESCRIPTION:=A theme-independent configurable dashboard workbench with shared layouts and live system, network, wireless and client widgets.
LUCI_MAINTAINER:=LazuliKao
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_JS:=0

PKG_NAME:=luci-mod-fluentdashboard
PKG_VERSION:=1.0.9
PKG_RELEASE:=5
PKG_LICENSE:=Apache-2.0
PKG_BUILD_DEPENDS:=iwinfo

define Package/luci-mod-fluentdashboard/conffiles
/etc/config/fluentdashboard
endef

# call BuildPackage - OpenWrt buildroot signature
include $(TOPDIR)/feeds/luci/luci.mk
