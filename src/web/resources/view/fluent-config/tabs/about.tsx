declare global {
  namespace JSX {
    interface IntrinsicElements {
      img: JSXElement<HTMLImageElement>;
      hr: JSXElement<HTMLHRElement>;
    }
  }
}

const form = L.form;
const dom = L.dom as unknown as typeof LuCI.dom;
const ghmirror = "https://ghfast.top/"; // Use GHProxy to bypass GitHub API rate limits
import { callGetVersion, callDoInstall, callStartDownload, callCheckDownload, fetchLatestRelease, GitHubAPIError } from "../../../utils/update";

const CBIAboutManager = (form.DummyValue as unknown as typeof LuCI.baseclass).extend({
  renderWidget: (_section_id: string, _option_index: number, _cfgvalue: string) => {
    // Current details from RPCD
    let currentVersion = "1.0.1";
    let pkgType: "ipk" | "apk" = "ipk";
    let installedI18n: string[] = [];

    // UI state elements
    const logoEl = (
      <div class="fluent-about-logo">
        <img src={`${L.media()}/img/fluent.svg`} alt="Fluent Theme Logo" />
        <h2>Fluent Theme</h2>
        <p class="fluent-about-subtitle">{_("Fluent Design 2 theme for LuCI")}</p>
      </div>
    );

    const detailsEl = (
      <div class="fluent-about-details">
        <div class="fluent-about-detail-row">
          <strong>{_("Author")}:</strong>
          <span>LazuliKao</span>
        </div>
        <div class="fluent-about-detail-row">
          <strong>{_("Installed version")}:</strong>
          <span class="fluent-about-current-version">v...</span>
        </div>
        <div class="fluent-about-detail-row">
          <strong>{_("Package format")}:</strong>
          <span class="fluent-about-pkg-type">...</span>
        </div>
        <div class="fluent-about-detail-row">
          <strong>{_("Source code")}:</strong>
          <span>
            <a href="https://github.com/LazuliKao/luci-theme-fluent" target="_blank" rel="noreferrer">
              GitHub Repository
            </a>
          </span>
        </div>
      </div>
    );

    // Update section elements
    const channelSelect = (
      <select class="cbi-input-select" id="update-channel-select">
        <option value="stable">{_("Stable Channel")}</option>
        <option value="nightly">{_("Nightly Channel (Prerelease)")}</option>
      </select>
    ) as HTMLSelectElement;

    const methodSelect = (
      <select class="cbi-input-select" id="update-method-select">
        <option value="backend_official">{_("Backend (Official GitHub)")}</option>
        <option value="backend_ghproxy">{_("Backend (GHProxy Acceleration)")}</option>
      </select>
    ) as HTMLSelectElement;

    const checkBtn = (
      <button class="btn cbi-button cbi-button-action" type="button">
        {_("Check for updates")}
      </button>
    ) as HTMLButtonElement;

    const updateControlsEl = (
      <div class="fluent-update-controls" style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
        <div class="fluent-update-channel-selector">
          <label htmlFor="update-channel-select">{_("Update channel")}: </label>
          {channelSelect}
        </div>
        {checkBtn}
      </div>
    );

    const statusMsgEl = <div class="fluent-update-status" style="display: none" />;

    // Progress Bar element
    const progressBarFill = <div class="fluent-progress-bar__fill" style="width: 0%" />;
    const progressBarEl = (
      <div class="fluent-progress-bar" style="display: none">
        {progressBarFill}
      </div>
    );

    const progressTextEl = <div class="fluent-progress-text" style="display: none" />;

    // New version card container
    const updateCardEl = <div class="fluent-update-card" style="display: none" />;

    const managerContainer = (
      <div class="fluent-about-manager">
        {logoEl}
        {detailsEl}
        <hr class="fluent-about-divider" />
        <h3>{_("Software Update")}</h3>
        {updateControlsEl}
        {statusMsgEl}
        {updateCardEl}
        {progressBarEl}
        {progressTextEl}
      </div>
    );

    const setStatus = (msg: string, type: "info" | "success" | "error" | "warn" = "info") => {
      dom.content(statusMsgEl, [document.createTextNode(msg)]);
      statusMsgEl.className = `fluent-update-status status-${type}`;
      statusMsgEl.style.display = "block";
    };

    const updateProgress = (stage: string, percent: number, detailMsg: string) => {
      progressBarEl.style.display = "block";
      progressTextEl.style.display = "block";
      progressBarFill.style.width = `${percent}%`;
      progressBarFill.className = `fluent-progress-bar__fill fill-${stage}`;
      dom.content(progressTextEl, [document.createTextNode(`${detailMsg} (${percent}%)`)]);
    };

    const hideProgress = () => {
      progressBarEl.style.display = "none";
      progressTextEl.style.display = "none";
    };

    // Load initial version info
    const loadVersionInfo = async () => {
      try {
        const res = await callGetVersion();
        currentVersion = res.version;
        pkgType = res.pkg_type;
        installedI18n = res.installed_i18n || (res.i18n_zh_cn_installed ? ["zh-cn"] : []);

        const currentVerSpan = detailsEl.querySelector(".fluent-about-current-version");
        if (currentVerSpan) {
          currentVerSpan.textContent = `v${currentVersion}`;
        }

        const pkgTypeSpan = detailsEl.querySelector(".fluent-about-pkg-type");
        if (pkgTypeSpan) {
          pkgTypeSpan.textContent = pkgType === "apk" ? "APK (OpenWrt 25.12+)" : "IPK (OpenWrt 24.10)";
        }
      } catch (err) {
        console.error("Failed to fetch version", err);
        setStatus(_("Failed to fetch current theme version."), "error");
      }
    };
    void loadVersionInfo();

    const doCheckUpdate = async (token?: string) => {
      const channel = channelSelect.value as "stable" | "nightly";

      try {
        const release = await fetchLatestRelease(channel, pkgType, installedI18n, token);
        console.log(release);
        checkBtn.disabled = false;

        const localVerClean = currentVersion.replace(/^v/, "").trim();
        const remoteVerClean = release.tag_name.replace(/^v/, "").trim();

        const isNewer = L.naturalCompare(remoteVerClean, localVerClean) > 0;

        const isUpToDate = !isNewer && channel !== "nightly";

        if (isUpToDate) {
          setStatus(_("Your theme is up to date!"), "success");
        } else {
          setStatus(isNewer ? _("A new version is available!") : _("Nightly build available (reinstallation check)."), isNewer ? "warn" : "info");
        }

        if (!release.package_asset) {
          setStatus(_("No matching package asset found for your system architecture in this release."), "error");
          return;
        }

        // Build changelog preview
        const changelogHtml = release.body ? release.body : "";

        const installBtn = (
          <button class="btn cbi-button cbi-button-save" type="button" style="white-space: nowrap;">
            {_("Download and Install")}
          </button>
        ) as HTMLButtonElement;

        const contentList: (Node | HTMLElement | DocumentFragment)[] = [
          <div class="fluent-update-header">
            <span class="fluent-update-badge">{remoteVerClean === "nightly" ? "Nightly" : `v${remoteVerClean}`}</span>
            <span class="fluent-update-date">{release.published_at.split("T")[0]}</span>
          </div>,
        ];

        if (changelogHtml) {
          contentList.push(<pre class="fluent-update-changelog">{changelogHtml}</pre>);
        }

        if (!isUpToDate) {
          contentList.push(
            <div class="fluent-update-footer" style="display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
              {methodSelect}
              {installBtn}
            </div>,
          );
        }

        dom.content(updateCardEl, contentList);

        updateCardEl.style.display = "block";

        // Install package execution
        installBtn.addEventListener("click", async () => {
          const packageAsset = release.package_asset;

          if (!packageAsset) {
            setStatus(_("No matching package asset found for your system architecture in this release."), "error");
            return;
          }
          installBtn.disabled = true;
          channelSelect.disabled = true;
          methodSelect.disabled = true;
          checkBtn.disabled = true;
          setStatus(_("Starting update process..."), "info");

          const i18nAssets = release.i18n_assets || [];

          let expectedHash: string | null = null;
          const expectedI18nHashes: string[] = [];

          if (packageAsset.digest?.startsWith("sha256:")) {
            expectedHash = packageAsset.digest.replace("sha256:", "");
          } else {
            console.warn("Unable to determine expected package hash from digest. Skipping verification.");
            expectedHash = "skip";
          }

          for (const asset of i18nAssets) {
            if (asset.digest?.startsWith("sha256:")) {
              expectedI18nHashes.push(asset.digest.replace("sha256:", ""));
            } else {
              expectedI18nHashes.push("skip");
            }
          }

          // Step 1: Backend download and verify
          const downloadStep = async () => {
            const method = methodSelect.value;
            const useProxy = method.includes("ghproxy");

            const confirmInstallation = () => {
              return new Promise<boolean>((resolve) => {
                const cancelBtn = (
                  <button type="button" class="btn cbi-button cbi-button-action">
                    {_("Cancel")}
                  </button>
                ) as HTMLButtonElement;
                cancelBtn.addEventListener("click", () => {
                  L.ui.hideModal();
                  resolve(false);
                });
                const confirmBtn = (
                  <button type="button" class="btn cbi-button cbi-button-save">
                    {_("Continue")}
                  </button>
                ) as HTMLButtonElement;
                confirmBtn.addEventListener("click", () => {
                  L.ui.hideModal();
                  resolve(true);
                });

                L.ui.showModal(
                  _("Confirm Installation"),
                  <div>
                    <p>{_("The theme package is ready. Are you sure you want to proceed with the installation?")}</p>
                    <div class="right" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                      {cancelBtn}
                      {confirmBtn}
                    </div>
                  </div>,
                );
              });
            };

            // Pass URL to router for background download
            setStatus(_("Starting backend download..."), "info");
            updateProgress("download", 0, _("Downloading on router"));

            const dlUrl = useProxy ? ghmirror + packageAsset.browser_download_url : packageAsset.browser_download_url;
            const i18nDlUrls = i18nAssets
              .map((a) => (useProxy ? ghmirror + a.browser_download_url : a.browser_download_url))
              .join(" ");

            const startRes = await callStartDownload(dlUrl, i18nDlUrls.split(" ")[0] || "", i18nDlUrls);
            if (startRes.result !== 0) {
              throw new Error(startRes.message || "Failed to start router download.");
            }

            // Poll check_download
            while (true) {
              const checkRes = await callCheckDownload();
              const size = checkRes.size || 0;
              const i18nTotalSize = i18nAssets.reduce((sum, a) => sum + (a.size || 0), 0);
              const totalSize = packageAsset.size + i18nTotalSize;
              const percent = totalSize > 0 ? Math.min(Math.round((size / totalSize) * 100), 100) : 0;
              updateProgress("download", percent, `${_("Downloading on router")} (${(size / 1024).toFixed(0)} / ${(totalSize / 1024).toFixed(0)} KB)`);

              if (!checkRes.running) {
                if (checkRes.code !== 0) {
                  throw new Error("Router background download failed or file is empty.");
                } else {
                  break;
                }
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            if (!(await confirmInstallation())) {
              throw new Error(_("Installation cancelled by user."));
            }

            setStatus(_("Triggering installation on router..."), "info");
            updateProgress("install", 100, _("Installing package"));

            const installRes = await callDoInstall(expectedHash, expectedI18nHashes[0] || "", expectedI18nHashes.join(" "));
            if (installRes.result !== 0) {
              throw new Error(installRes.message || "Router installation failed.");
            }

            // Create log container
            const logPre = (
              <pre style="background: var(--fluent-code-bg, #1a1a1a); color: var(--fluent-text, #fff); padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; max-height: 200px; overflow-y: auto; margin-top: 15px;"></pre>
            ) as HTMLPreElement;

            const pollLog = async () => {
              const ubusUrl = L.env.ubuspath || "/ubus";
              const sid = L.env.sessionid;

              while (true) {
                try {
                  const res = await fetch(ubusUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      jsonrpc: "2.0",
                      id: 1,
                      method: "call",
                      params: [sid, "luci.fluent", "get_install_log", {}],
                    }),
                  });
                  const data = await res.json();

                  // If error (like Access Denied after rpcd restarts), break the polling silently
                  if (data.error) break;

                  if (data.result?.[1]?.log) {
                    logPre.textContent = data.result[1].log;
                    logPre.scrollTop = logPre.scrollHeight;
                  }

                  await new Promise((r) => setTimeout(r, 1000));
                } catch {
                  break;
                }
              }
            };
            pollLog();

            // Finished successfully
            setStatus(_("Theme successfully updated! Reloading RPC service, please refresh the page in 5 seconds."), "success");
            updateProgress("done", 100, _("Finished"));

            // Show refresh button
            const refreshBtn = (
              <button class="btn cbi-button cbi-button-action" type="button" style="margin-top: 15px">
                {_("Reload Web Interface")}
              </button>
            ) as HTMLButtonElement;
            refreshBtn.addEventListener("click", () => {
              window.location.reload();
            });

            dom.content(updateCardEl, [
              <div class="fluent-update-success">
                <h3 style="color: var(--fluent-success); text-align: center;">{_("Upgrade Successful!")}</h3>
                <p style="text-align: center; margin: 15px 0;">
                  {_("The theme is being installed on your router. The logs are displayed below. Reloading the web interface will apply the changes once RPCD restarts.")}
                </p>
                {logPre}
                <div style="display: flex; justify-content: center; margin-top: 20px;">{refreshBtn}</div>
              </div>,
            ]);
          };

          try {
            await downloadStep();
          } catch (err) {
            console.error("Update failed", err);
            setStatus(`${_("Update failed")}: ${err instanceof Error ? err.message : String(err)}`, "error");
            installBtn.disabled = false;
            installBtn.removeAttribute("disabled");
            channelSelect.disabled = false;
            channelSelect.removeAttribute("disabled");
            methodSelect.disabled = false;
            methodSelect.removeAttribute("disabled");
            checkBtn.disabled = false;
            checkBtn.removeAttribute("disabled");
            hideProgress();
          }
        });
      } catch (err) {
        checkBtn.disabled = false;
        console.error("Failed checking updates", err);

        if (err instanceof GitHubAPIError && err.status === 403) {
          const inputEl = (<input type="text" class="cbi-input-text" style="width: 100%" placeholder="ghp_..." />) as HTMLInputElement;
          const msgEl = <p>{_("API rate limit exceeded. Please enter a GitHub Token to continue. This token is only used for frontend requests and will not be saved on the router backend.")}</p>;

          const createTokenPromptEl = (
            <p style="margin-top: 10px; font-size: 13px; color: var(--fluent-text-secondary);">
              {_("You can create a new token at")}{" "}
              <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener noreferrer">
                https://github.com/settings/personal-access-tokens/new
              </a>
              {"."}
              {_("The token does NOT require any permissions/scopes to be granted (read-only public access is sufficient).")}
            </p>
          );

          const rawErrorEl = (
            <pre style="margin-top: 10px; margin-bottom: 15px; font-size: 12px; white-space: pre-wrap; word-break: break-word; color: var(--fluent-error-text); background: var(--fluent-card-bg); padding: 8px; border-radius: var(--fluent-border-radius);">
              {err instanceof Error ? err.message : String(err)}
            </pre>
          );

          const cancelBtn = (
            <button type="button" class="btn cbi-button cbi-button-action">
              {_("Cancel")}
            </button>
          ) as HTMLButtonElement;
          cancelBtn.addEventListener("click", () => L.ui.hideModal());

          const submitBtn = (
            <button type="button" class="btn cbi-button cbi-button-save">
              {_("Submit")}
            </button>
          ) as HTMLButtonElement;
          submitBtn.addEventListener("click", () => {
            const newToken = inputEl.value.trim();
            L.ui.hideModal();
            if (newToken) {
              setStatus(_("Retrying with token..."), "info");
              checkBtn.disabled = true;
              doCheckUpdate(newToken);
            }
          });

          L.ui.showModal(
            _("GitHub Token Required"),
            <>
              {msgEl}
              {createTokenPromptEl}
              {rawErrorEl}
              {inputEl}
              <div class="right" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                {cancelBtn}
                {submitBtn}
              </div>
            </>,
          );
        } else {
          setStatus(`${_("Failed to check for updates")}: ${err instanceof Error ? err.message : String(err)}`, "error");
        }
      }
    };

    // Check update click logic
    checkBtn.addEventListener("click", () => {
      setStatus(_("Checking for updates..."), "info");
      checkBtn.disabled = true;
      updateCardEl.style.display = "none";
      hideProgress();
      doCheckUpdate();
    });

    return managerContainer;
  },
}) as unknown as typeof LuCI.form.DummyValue;

export const registerAboutTab = (section: LuCI.form.TypedSection): void => {
  section.tab("about", _("About"));

  section.taboption("about", CBIAboutManager, "_about_mgr");
};
