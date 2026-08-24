include $(TOPDIR)/rules.mk

PKG_NAME:=luci-mod-fluentdashboard
PKG_VERSION:=1.0.9
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=LazuliKao
PKGARCH:=all
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)
PKG_BUILD_DEPENDS:=iwinfo luci-base/host

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=2. Modules
  TITLE:=Fluent dashboard for LuCI
  DEPENDS:=+luci-base +libiwinfo
endef

define Package/$(PKG_NAME)/description
 A fixed-card, theme-independent LuCI status dashboard with system,
 network, wireless, DHCP lease, and wireless client information.
endef

define Package/luci-i18n-fluentdashboard-zh-cn
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=$(PKG_NAME) - zh-cn translation
  HIDDEN:=1
  DEFAULT:=LUCI_LANG_zh_Hans||(ALL&&m)
  DEPENDS:=$(PKG_NAME) +luci-i18n-base-zh-cn
  PKGARCH:=all
endef

define Package/luci-i18n-fluentdashboard-zh-cn/description
 Simplified Chinese translation for luci-mod-fluentdashboard.
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	$(CP) ./htdocs $(PKG_BUILD_DIR)/
	$(CP) ./root $(PKG_BUILD_DIR)/
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/www $(1)/usr/share
	$(CP) $(PKG_BUILD_DIR)/htdocs/* $(1)/www/
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
endef

define Package/luci-i18n-fluentdashboard-zh-cn/install
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	po2lmo ./po/zh_Hans/fluentdashboard.po $(1)/usr/lib/lua/luci/i18n/fluentdashboard.zh-cn.lmo
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
	exit 0
}
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
$(eval $(call BuildPackage,luci-i18n-fluentdashboard-zh-cn))
