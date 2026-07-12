#!/bin/sh
# build.sh - Downloads OpenWrt SDK and builds packages
# Usage: build.sh <version>
# Example: build.sh 24.10.7  (produces .ipk)
#          build.sh 25.12.4  (produces .apk)
#
# OpenWrt 24.x uses opkg/ipk, OpenWrt 25.x+ uses apk.

set -e

VERSION="${1:?Usage: build.sh <version>}"
SDK_BASE_URL="https://downloads.openwrt.org/releases/${VERSION}/targets/x86/64"

# Use local directory (works on GitHub Actions runners and Docker)
BUILDER_DIR="${HOME}/builder"
SDK_DIR="${BUILDER_DIR}/sdk"
PACKAGES_DIR="${BUILDER_DIR}/packages"
OUTPUT_DIR="${BUILDER_DIR}/output"

# Determine package format from major version
MAJOR_VERSION=$(echo "$VERSION" | cut -d. -f1)
if [ "$MAJOR_VERSION" -ge 25 ]; then
  PKG_FORMAT="apk"
  PKG_EXT="apk"
else
  PKG_FORMAT="opkg"
  PKG_EXT="ipk"
fi

echo "=== OpenWrt ${VERSION} SDK Build ==="
echo "Package format: ${PKG_FORMAT} (.${PKG_EXT})"
echo "Builder directory: ${BUILDER_DIR}"

# Discover exact SDK filename (handles gcc version changes)
echo ">>> Discovering SDK..."
SDK_TARBALL=$(wget -qO- "${SDK_BASE_URL}/" | grep -oP 'openwrt-sdk-[^"<>]+\.tar\.zst' | head -1)
if [ -z "$SDK_TARBALL" ]; then
  echo "ERROR: Could not find SDK tarball at ${SDK_BASE_URL}/"
  echo "Available files:"
  wget -qO- "${SDK_BASE_URL}/" | grep -oP 'href="[^"]*"' | head -20
  exit 1
fi

SDK_URL="${SDK_BASE_URL}/${SDK_TARBALL}"
echo "SDK: ${SDK_URL}"

# Verify URL exists
echo ">>> Verifying SDK URL..."
HTTP_CODE=$(wget --spider -S "${SDK_URL}" 2>&1 | grep "HTTP/" | tail -1 | awk '{print $2}')
if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: SDK URL returned HTTP ${HTTP_CODE}"
  echo "URL: ${SDK_URL}"
  exit 1
fi
echo "    HTTP ${HTTP_CODE} OK"

# Download SDK
echo ">>> Downloading SDK (${SDK_TARBALL})..."
mkdir -p "${BUILDER_DIR}"
cd "${BUILDER_DIR}"
wget -q -O sdk.tar.zst "${SDK_URL}"

# Extract SDK
echo ">>> Extracting SDK..."
mkdir -p "${SDK_DIR}"
tar --zstd -xf sdk.tar.zst --strip-components=1 -C "${SDK_DIR}"
rm -f sdk.tar.zst

cd "${SDK_DIR}"
echo "SDK root: $(pwd)"
ls -la feeds.conf.default scripts/ 2>/dev/null || { echo "ERROR: SDK extraction failed"; exit 1; }

# Fix feeds to use GitHub mirror (faster)
sed -i 's/git\.openwrt\.org\/project\/luci/github\.com\/openwrt\/luci/g' ./feeds.conf.default
sed -i 's/git\.openwrt\.org\/project\/feeds/github\.com\/openwrt\/feeds/g' ./feeds.conf.default

echo ">>> Updating feeds..."
./scripts/feeds update -a
./scripts/feeds install -a

# Copy package sources into SDK package tree
echo ">>> Installing package sources..."
for pkg_dir in ${PACKAGES_DIR}/*/; do
  [ -d "$pkg_dir" ] || continue
  pkg_name=$(basename "$pkg_dir")
  echo "    -> $pkg_name"
  cp -r "$pkg_dir" "./package/$pkg_name"
  chmod 755 -R "./package/$pkg_name"
  # Remove dev sources (src/) — CSS/JS is pre-built and placed via CI artifact
  rm -rf "./package/$pkg_name/src"
done


# Configure
echo ">>> Running defconfig..."
make defconfig

# Build luci-theme-fluent package
echo ">>> Building packages..."
make -j$(nproc) V=s BUILD_LOG=1 \
  package/luci-theme-fluent/compile

# Collect built packages — only luci-theme-fluent, not SDK dependencies
echo ">>> Collecting ${PKG_EXT} files..."
mkdir -p "${OUTPUT_DIR}"
find bin -name "luci-theme-fluent*.${PKG_EXT}" -exec cp {} "${OUTPUT_DIR}/" \;
find bin -name "luci-i18n-fluent*.${PKG_EXT}" -exec cp {} "${OUTPUT_DIR}/" \;
tar -cJf "${OUTPUT_DIR}/logs.tar.xz" logs 2>/dev/null || true

echo "=== Build complete ==="
echo "Package format: ${PKG_FORMAT} (.${PKG_EXT})"
ls -lh "${OUTPUT_DIR}"/*.${PKG_EXT} 2>/dev/null || echo "Warning: no ${PKG_EXT} files found"
