include $(TOPDIR)/rules.mk

LUCI_TITLE:=Fluent Theme for LuCI (lite)
LUCI_DEPENDS:=+luci-base
LUCI_MINIFY_CSS:=0

PKG_NAME:=luci-theme-fluent-lite
PKG_VERSION:=1.0.9
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

FLUENT_LITE_SOURCE_DIR:=$(CURDIR)
FLUENT_FULL_SOURCE_DIR:=$(abspath $(CURDIR)/../luci-theme-fluent)

define LUCI_DESCRIPTION
Core FluentUI theme styling for LuCI without optional menu, updater, log, and application enhancements.
endef

define Build/Prepare/$(PKG_NAME)
	$(CP) $(FLUENT_FULL_SOURCE_DIR)/htdocs/* $(PKG_BUILD_DIR)/htdocs/
	$(CP) $(FLUENT_FULL_SOURCE_DIR)/root/* $(PKG_BUILD_DIR)/root/
	$(CP) $(FLUENT_LITE_SOURCE_DIR)/htdocs/* $(PKG_BUILD_DIR)/htdocs/
	$(CP) $(FLUENT_LITE_SOURCE_DIR)/root/* $(PKG_BUILD_DIR)/root/
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header.ut
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header_login.ut
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/fluent
endef

define Package/$(PKG_NAME)/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	if command -v apk >/dev/null 2>&1 && apk info -e luci-theme-fluent >/dev/null 2>&1; then
		echo "luci-theme-fluent is installed; remove it before installing luci-theme-fluent-lite" >&2
		exit 1
	fi
	if command -v opkg >/dev/null 2>&1 && opkg list-installed luci-theme-fluent 2>/dev/null | grep -q '^luci-theme-fluent '; then
		echo "luci-theme-fluent is installed; remove it before installing luci-theme-fluent-lite" >&2
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
