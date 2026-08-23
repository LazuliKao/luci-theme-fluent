include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-fluent-lite
PKG_VERSION:=1.0.9
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKGARCH:=all
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=Fluent Theme for LuCI (lite)
  DEPENDS:=+luci-base
  CONFLICTS:=luci-theme-fluent
endef

define Package/$(PKG_NAME)/description
Core FluentUI theme styling for LuCI without optional menu, updater, log, and application enhancements.
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	$(CP) $(TOPDIR)/package/luci-theme-fluent/htdocs $(PKG_BUILD_DIR)/
	$(CP) $(TOPDIR)/package/luci-theme-fluent/root $(PKG_BUILD_DIR)/
	$(CP) $(TOPDIR)/package/luci-theme-fluent/ucode $(PKG_BUILD_DIR)/
	$(CP) $(TOPDIR)/package/luci-theme-fluent-lite/htdocs/luci-static/fluent/css/fluent.css $(PKG_BUILD_DIR)/htdocs/luci-static/fluent/css/
	$(CP) $(TOPDIR)/package/luci-theme-fluent-lite/htdocs/luci-static/resources/* $(PKG_BUILD_DIR)/htdocs/luci-static/resources/
	$(CP) $(TOPDIR)/package/luci-theme-fluent-lite/root/* $(PKG_BUILD_DIR)/root/
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header.ut
	$(SED) 's/@VERSION@/$(PKG_VERSION)/g' $(PKG_BUILD_DIR)/ucode/template/themes/fluent/header_login.ut
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
	$(INSTALL_DIR) $(1)/www $(1)/usr/share/ucode/template/themes
	$(CP) $(PKG_BUILD_DIR)/htdocs/luci-static $(1)/www/
	$(CP) $(PKG_BUILD_DIR)/ucode/template/themes/fluent $(1)/usr/share/ucode/template/themes/
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/fluent
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

$(eval $(call BuildPackage,$(PKG_NAME)))
