include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-fluent
PKG_VERSION:=1.0.9
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=Fluent Theme for LuCI
LUCI_DEPENDS:=+luci-base
LUCI_MINIFY_CSS:=0

define Build/Prepare
	$(call Build/Prepare/Default)
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header.ut
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header_login.ut
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/fluent
endef


define Package/$(PKG_NAME)/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	if command -v apk >/dev/null 2>&1 && apk info -e luci-theme-fluent-lite >/dev/null 2>&1; then
		echo "luci-theme-fluent-lite is installed; remove it before installing luci-theme-fluent" >&2
		exit 1
	fi
	if command -v opkg >/dev/null 2>&1 && opkg list-installed luci-theme-fluent-lite 2>/dev/null | grep -q '^luci-theme-fluent-lite '; then
		echo "luci-theme-fluent-lite is installed; remove it before installing luci-theme-fluent" >&2
		exit 1
	fi
}
endef

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
include $(TOPDIR)/feeds/luci/luci.mk
