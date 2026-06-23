include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-fluent
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=Fluent Theme for LuCI
LUCI_DEPENDS:=
LUCI_MINIFY_CSS:=0

include $(TOPDIR)/feeds/luci/luci.mk

# Build call
define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci batch <<-EOF
		set luci.themes.Fluent=/luci-static/fluent
		commit luci
	EOF
}
endef

# call BuildPackage - OpenWrt buildroot signature
