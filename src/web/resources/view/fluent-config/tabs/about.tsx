import { callGetVersion, callStartUpdate, callUpdateStatus, fetchLatestRelease, GitHubAPIError, type UpdateStatus, updateManifest } from "../../../utils/update";

const CBIAboutManager = L.form.DummyValue.extend({
  renderWidget: () => {
    let version: Awaited<ReturnType<typeof callGetVersion>>;
    const versionEl = <span>…</span>;
    const formatEl = <span>…</span>;
    const channel = (
      <select id="fluent-update-channel" class="cbi-input-select">
        <option value="stable">{_("Stable Channel")}</option>
        <option value="nightly">{_("Nightly Channel (Prerelease)")}</option>
      </select>
    ) as HTMLSelectElement;
    const method = (
      <select id="fluent-update-method" class="cbi-input-select">
        <option value="">{_("Backend (Official GitHub)")}</option>
        <option value="https://ghfast.top/">{_("Backend (GHProxy Acceleration)")}</option>
      </select>
    ) as HTMLSelectElement;
    const check = (
      <button type="button" class="btn cbi-button-action">
        {_("Check for updates")}
      </button>
    ) as HTMLButtonElement;
    const status = <p class="fluent-update-status" role="status" />;
    const card = <div class="fluent-update-card" hidden />;
    const log = <pre class="fluent-update-changelog" hidden />;
    const reload = (
      <button type="button" class="btn cbi-button-action" hidden onclick={() => window.location.reload()}>
        {_("Reload Web Interface")}
      </button>
    );
    const container = (
      <div class="fluent-about-manager">
        <div class="fluent-about-logo">
          <img src={`${L.media()}/img/fluent.svg`} alt="" />
          <h2>Fluent Theme</h2>
          <p class="fluent-about-subtitle">{_("Fluent Design 2 theme for LuCI")}</p>
        </div>
        <div class="fluent-about-details">
          <div class="fluent-about-detail-row">
            <strong>{_("Author")}:</strong>
            <span>LazuliKao</span>
          </div>
          <div class="fluent-about-detail-row">
            <strong>{_("Installed version")}:</strong>
            {versionEl}
          </div>
          <div class="fluent-about-detail-row">
            <strong>{_("Package format")}:</strong>
            {formatEl}
          </div>
          <div class="fluent-about-detail-row">
            <strong>{_("Source code")}:</strong>
            <a href="https://github.com/LazuliKao/luci-theme-fluent" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
        <hr class="fluent-about-divider" />
        <h3>{_("Software Update")}</h3>
        <div class="fluent-update-controls">
          <label htmlFor="fluent-update-channel">{_("Update channel")}</label>
          {channel}
          <label htmlFor="fluent-update-method">{_("Download method")}</label>
          {method}
          {check}
        </div>
        {status}
        {card}
        {log}
        {reload}
      </div>
    );

    function setStatus(message: string, type = "info") {
      status.textContent = message;
      status.className = `fluent-update-status status-${type}`;
    }

    function setBusy(busy: boolean) {
      channel.disabled = method.disabled = check.disabled = busy;
      card.querySelectorAll("button").forEach((button) => {
        button.disabled = busy;
      });
    }

    async function monitor(initial: UpdateStatus) {
      let state = initial;
      const deadline = Date.now() + 20 * 60 * 1000;
      setBusy(true);
      try {
        while (container.isConnected) {
          if (state.result !== 0) throw new Error(state.message || _("Unable to read update status."));
          log.hidden = !state.log;
          if (log.textContent !== state.log) log.textContent = state.log ?? "";
          if (state.stage === "done") {
            setStatus(_("Theme successfully updated. Reload the web interface to use the new version."), "success");
            reload.hidden = false;
            return;
          }
          if (state.stage === "error") {
            setStatus(_("Update failed. Check the installation log below."), "error");
            return;
          }
          if (state.stage !== "downloading" && state.stage !== "installing") throw new Error(_("Unexpected update status."));
          setStatus(state.stage === "downloading" ? _("Downloading and verifying packages...") : _("Installing packages..."));
          if (Date.now() >= deadline) throw new Error(_("Timed out waiting for update status."));
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (!container.isConnected) return;
          if (!state.job) throw new Error(_("Missing update job."));
          state = await callUpdateStatus(state.job);
        }
      } catch (error) {
        setStatus(`${_("Update status unavailable. Reload and sign in again to check the result.")} ${String(error)}`, "warn");
        reload.hidden = false;
      } finally {
        setBusy(false);
      }
    }

    async function checkRelease(token?: string) {
      setBusy(true);
      card.hidden = true;
      setStatus(_("Checking for updates..."));
      try {
        const release = await fetchLatestRelease(channel.value as "stable" | "nightly", version.pkg_type, version.installed_i18n, token);
        const asset = release.package_asset;
        if (!asset) throw new Error(_("No matching theme package found in this release."));
        const current = version.version.replace(/^v/, "");
        const remote = release.tag_name.replace(/^v/, "");
        const upToDate = channel.value === "stable" && L.naturalCompare(remote, current) <= 0;
        const install = (
          <button type="button" class="btn cbi-button-save">
            {_("Download and Install")}
          </button>
        );
        dom.content(card, [
          <div class="fluent-update-header">
            <span class="fluent-update-badge">{release.tag_name}</span>
            <span>{release.published_at.split("T")[0]}</span>
          </div>,
          <pre class="fluent-update-changelog">{release.body}</pre>,
          ...(upToDate ? [] : [install]),
        ]);
        card.hidden = false;
        setStatus(upToDate ? _("Your theme is up to date!") : _("A new version is available!"), upToDate ? "success" : "info");
        install.addEventListener("click", async () => {
          setBusy(true);
          log.hidden = reload.hidden = true;
          try {
            const manifest = updateManifest([asset, ...release.i18n_assets], method.value);
            const result = await callStartUpdate(manifest);
            if (result.result !== 0 || !result.job) throw new Error(result.message || _("Unable to start update."));
            await monitor({ result: 0, job: result.job, stage: "downloading" });
          } catch (error) {
            setStatus(`${_("Unable to start update.")} ${String(error)}`, "error");
          } finally {
            setBusy(false);
          }
        });
      } catch (error) {
        setStatus(String(error), "error");
        if (error instanceof GitHubAPIError && (error.status === 403 || error.status === 429)) {
          const input = (<input type="password" class="cbi-input-text" aria-label={_("GitHub token")} autocomplete="off" />) as HTMLInputElement;
          L.ui.showModal(
            _("GitHub Token Required"),
            <>
              <p>{_("API rate limit exceeded. Please enter a GitHub Token to continue. This token is only used for frontend requests and will not be saved on the router backend.")}</p>
              {input}
              <div class="right">
                <button type="button" class="btn" onclick={() => L.ui.hideModal()}>
                  {_("Cancel")}
                </button>
                <button
                  type="button"
                  class="btn cbi-button-save"
                  onclick={() => {
                    const token = input.value.trim();
                    L.ui.hideModal();
                    if (token) void checkRelease(token);
                  }}
                >
                  {_("Submit")}
                </button>
              </div>
            </>,
          );
        }
      } finally {
        setBusy(false);
      }
    }

    setBusy(true);
    void (async () => {
      try {
        version = await callGetVersion();
        if (!version.version || !["ipk", "apk"].includes(version.pkg_type)) throw new Error(_("Unable to determine installed theme version."));
        versionEl.textContent = version.version;
        formatEl.textContent = version.pkg_type.toUpperCase();
        check.addEventListener("click", () => {
          void checkRelease();
        });
        const state = await callUpdateStatus("");
        if (state.result !== 0) throw new Error(state.message);
        if (state.stage !== "idle") await monitor(state);
        setBusy(false);
      } catch (error) {
        setStatus(String(error), "error");
      }
    })();
    return container;
  },
});

export const registerAboutTab = (section: LuCI.form.TypedSection): void => {
  section.tab("about", _("About"));
  section.taboption("about", CBIAboutManager, "_about_mgr");
};
