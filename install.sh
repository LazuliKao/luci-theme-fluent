#!/bin/sh

set -eu

PKG_NAME="luci-theme-fluent"
REPO="LazuliKao/luci-theme-fluent"
RELEASE_TAG="${1:-latest}"
PKG_FILE=""

log() {
   echo "[install.sh] $*"
}

fail() {
   echo "[install.sh] ERROR: $*" >&2
   exit 1
}

need_cmd() {
   command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not found"
}

detect_package_manager() {
   if command -v apk >/dev/null 2>&1; then
      PKG_EXT="apk"
      PKG_MGR="apk"
   elif command -v opkg >/dev/null 2>&1; then
      PKG_EXT="ipk"
      PKG_MGR="opkg"
   else
      fail "no supported package manager found (apk/opkg)"
   fi
}

setup_release_source() {
   case "${RELEASE_TAG}" in
      latest)
         API_URL="https://api.github.com/repos/${REPO}/releases/latest"
         TMP_JSON="$(mktemp /tmp/${PKG_NAME}.latest.XXXXXX.json)"
         ;;
      *)
         API_URL="https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}"
         TMP_JSON="$(mktemp /tmp/${PKG_NAME}.tag.XXXXXX.json)"
         ;;
   esac
}

cleanup() {
   rm -f "${TMP_JSON:-}" "${PKG_FILE:-}"
}

fetch_release_metadata() {
   log "Fetching release metadata"
   wget -qO "${TMP_JSON}" "${API_URL}" || fail "failed to fetch release metadata"
}

select_download_url() {
   DOWNLOAD_URL="$(grep -oE '"browser_download_url":[[:space:]]*"[^"]+"' "${TMP_JSON}" \
      | sed -E 's/.*"([^"]+)"/\1/' \
      | grep -E "/${PKG_NAME}[^/]*\.${PKG_EXT}$" \
      | head -n 1 || true)"

   [ -n "${DOWNLOAD_URL}" ] || fail "no .${PKG_EXT} asset found for release ${RELEASE_TAG}"
}

download_package() {
   PKG_FILE="/tmp/$(basename "${DOWNLOAD_URL}")"
   log "Downloading $(basename "${PKG_FILE}")"
   wget -qO "${PKG_FILE}" "${DOWNLOAD_URL}" || fail "failed to download package"
   [ -s "${PKG_FILE}" ] || fail "downloaded package is empty"
}

install_package() {
   log "Installing $(basename "${PKG_FILE}")"
   if [ "${PKG_MGR}" = "apk" ]; then
      apk add --allow-untrusted --upgrade "${PKG_FILE}" || fail "apk install failed"
   else
      opkg install "${PKG_FILE}" || fail "opkg install failed"
   fi
}

need_cmd wget
need_cmd grep
need_cmd sed
need_cmd head
need_cmd basename
need_cmd mktemp
detect_package_manager
setup_release_source
trap cleanup EXIT INT TERM

log "Detected package manager: ${PKG_MGR} (expecting .${PKG_EXT})"
log "Using release selector: ${RELEASE_TAG}"
fetch_release_metadata
select_download_url
download_package
install_package
log "Done"
