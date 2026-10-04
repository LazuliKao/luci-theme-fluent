export interface ReleaseAsset {
  name: string;
  digest?: string;
  browser_download_url: string;
}

export interface ReleaseInfo {
  tag_name: string;
  published_at: string;
  body: string;
  package_asset: ReleaseAsset | null;
  i18n_assets: ReleaseAsset[];
}

export interface UpdateStatus {
  result: number;
  message?: string;
  job?: string;
  stage: "idle" | "downloading" | "installing" | "done" | "error";
  log?: string;
}

export const callGetVersion = L.rpc.declare<{ version: string; pkg_type: "ipk" | "apk"; installed_i18n: string[] }>({
  object: "luci.fluent",
  method: "get_version",
});

export const callStartUpdate = L.rpc.declare<{ result: number; job?: string; message?: string }, [string]>({
  object: "luci.fluent",
  method: "start_update",
  params: ["manifest"],
});

export const callUpdateStatus = L.rpc.declare<UpdateStatus, [string]>({
  object: "luci.fluent",
  method: "update_status",
  params: ["job"],
});

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

export function matchI18nAsset(assets: ReleaseAsset[], lang: string, pkgType: "ipk" | "apk"): ReleaseAsset | null {
  const prefix = `luci-i18n-fluent-${lang.toLowerCase().trim()}${pkgType === "apk" ? "-" : "_"}`;
  return assets.find((asset) => asset.name.toLowerCase().startsWith(prefix) && asset.name.endsWith(`.${pkgType}`)) ?? null;
}

export function updateManifest(assets: ReleaseAsset[], mirror = ""): string {
  return JSON.stringify({
    packages: assets.map((asset) => {
      const digest = asset.digest ?? "";
      if (!/^sha256:[a-f\d]{64}$/i.test(digest)) throw new Error(`Missing SHA-256 digest: ${asset.name}`);
      if (!asset.browser_download_url.startsWith("https://")) throw new Error(`Invalid package URL: ${asset.name}`);
      return { url: mirror + asset.browser_download_url, sha256: digest.slice(7).toLowerCase() };
    }),
  });
}

export async function fetchLatestRelease(channel: "stable" | "nightly", pkgType: "ipk" | "apk", installedI18n: string[] = [], token?: string): Promise<ReleaseInfo> {
  const release = channel === "nightly" ? "tags/nightly" : "latest";
  const response = await fetch(`https://api.github.com/repos/LazuliKao/luci-theme-fluent/releases/${release}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new GitHubAPIError(`GitHub API returned status ${response.status}: ${data.message ?? ""}`, response.status);
  const assets: ReleaseAsset[] = data.assets ?? [];
  const pattern = pkgType === "apk" ? /^luci-theme-fluent-[0-9].*\.apk$/ : /^luci-theme-fluent_[^/]+\.ipk$/;
  const packageAsset = assets.find((asset) => pattern.test(asset.name)) ?? null;
  const i18nAssets = installedI18n.map((lang) => {
    const asset = matchI18nAsset(assets, lang, pkgType);
    if (!asset) throw new Error(`Missing translation package: ${lang}`);
    return asset;
  });
  return {
    tag_name: String(data.tag_name ?? ""),
    published_at: String(data.published_at ?? ""),
    body: String(data.body ?? ""),
    package_asset: packageAsset,
    i18n_assets: i18nAssets,
  };
}
