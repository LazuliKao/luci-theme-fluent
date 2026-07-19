include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-fluent
PKG_VERSION:=1.0.6
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=Fluent Theme for LuCI
LUCI_DEPENDS:=+luci-base
LUCI_MINIFY_CSS:=0

include $(TOPDIR)/feeds/luci/luci.mk

define Build/Prepare
	$(call Build/Prepare/Default)
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header.ut
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header_login.ut
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/fluent
endef


# Build call
define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci batch <<-EOF
		set luci.themes.Fluent=/luci-static/fluent
		commit luci
	EOF
	/etc/init.d/rpcd restart
}
endef

# call BuildPackage - OpenWrt buildroot signature
