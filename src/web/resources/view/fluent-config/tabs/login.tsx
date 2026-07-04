declare global {
  namespace JSX {
    interface IntrinsicElements {
      video: JSXElement<HTMLVideoElement>;
    }
  }
}

const form = L.form;
const rpc = L.rpc;
const dom = L.dom;
const fs = L.fs;
const ui = L.ui;

const callFluentAvail = rpc.declare<number>({ object: "luci.fluent", method: "avail", expect: { avail: 0 } });
const callFluentRemove = rpc.declare<number, [string]>({ object: "luci.fluent", method: "remove", params: ["filename"], expect: { result: 0 } });
const callFluentRename = rpc.declare<number, [string]>({ object: "luci.fluent", method: "rename", params: ["newname"], expect: { result: 0 } });

import { createModeSubtabs, transparencySteps } from "../shared";
import { FLUENT_DEFAULTS } from "../../../fluent-defaults";

const BACKGROUND_PATH = "/www/luci-static/fluent/background";
const BACKGROUND_URL = "/luci-static/fluent/background/";
const SUPPORTED_BACKGROUND_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "mp4", "webm"]);

const getExtension = (filename: string): string => filename.split(".").pop()?.toLowerCase() ?? "";

const isSupportedBackground = (filename: string): boolean => SUPPORTED_BACKGROUND_EXTENSIONS.has(getExtension(filename));

const sanitizeFilename = (filename: string): string => {
  const basename = filename.replace(/^.*[\\/]/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

  if (basename === "" || basename === "." || basename === ".." || !isSupportedBackground(basename)) {
    return `background-${Date.now()}.jpg`;
  }

  return basename;
};

const formatAvailableSpace = (availableKb: number): string => {
  if (availableKb >= 1024 * 1024) {
    return `${(availableKb / 1024 / 1024).toFixed(1)} GiB`;
  }

  if (availableKb >= 1024) {
    return `${(availableKb / 1024).toFixed(1)} MiB`;
  }

  return `${availableKb} KiB`;
};

const requireRpcSuccess = (result: number, action: string): void => {
  if (result !== 0) {
    throw new Error(`${action} failed with code ${result}.`);
  }
};

const createBackgroundPreview = (filename: string): HTMLElement => {
  const extension = getExtension(filename);
  const url = `${BACKGROUND_URL}${encodeURIComponent(filename)}`;

  if (extension === "mp4" || extension === "webm") {
    return (
      <video
        class="fluent-bg-preview fluent-bg-preview-video"
        muted
        playsInline
        preload="metadata"
        src={url}
      />
    ) as HTMLElement;
  }

  return <div class="fluent-bg-preview" style={`background-image:url('${url.replace(/'/g, "%27")}')`} /> as HTMLElement;
};

const renderNodeContent = (node: HTMLElement, children: Node | HTMLElement | DocumentFragment | (Node | HTMLElement | DocumentFragment)[]): void => {
  (dom as unknown as typeof LuCI.dom).content(node, children);
};

const CBIWallpaperManager = ((form.DummyValue as unknown as typeof LuCI.baseclass).extend({
  renderWidget: function (_section_id: string, _option_index: number, _cfgvalue: string) {
    const statusEl = <div class="cbi-value-description fluent-bg-status">Ready to upload or remove custom backgrounds.</div> as HTMLElement;
    const hintEl = <div class="fluent-bg-hint">Supported formats: JPG, PNG, GIF, WEBP, MP4, WEBM.</div> as HTMLElement;
    const uploadButton = <button class="btn cbi-button cbi-button-action" type="button">Upload background</button> as HTMLButtonElement;
    const actionsEl = <div class="fluent-bg-actions">{uploadButton}</div> as HTMLElement;
    const listEl = <div class="fluent-bg-list" /> as HTMLElement;

    const setStatus = (message: string): void => {
      renderNodeContent(statusEl, [document.createTextNode(message)]);
    };

    const formatEntrySize = (size: number | undefined): string => {
      const value = Number(size ?? 0);
      return value > 0 ? formatAvailableSpace(Math.max(1, Math.ceil(value / 1024))) : "Unknown size";
    };

    const renderEmpty = (): void => {
      renderNodeContent(
        listEl,
        <div class="fluent-bg-empty">
          <strong>No custom backgrounds yet</strong>
          <span>Upload an image or video to use it on the login page.</span>
        </div>,
      );
    };

    const refresh = (): Promise<void> =>
      fs
        .list(BACKGROUND_PATH)
        .catch((): LuCI.fs.FileStatEntry[] => [])
        .then((entries: LuCI.fs.FileStatEntry[]) => {
          const files = entries
            .filter((entry) => entry.type === "file" && isSupportedBackground(String(entry.name ?? "")))
            .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

          if (!files.length) {
            renderEmpty();
            return;
          }

          renderNodeContent(
            listEl,
            files.map((entry) => {
              const filename = String(entry.name ?? "");
              const deleteButton = <button class="btn cbi-button cbi-button-remove" type="button">Delete</button> as HTMLButtonElement;
              const handleDelete = ui.createHandlerFn(this, () => {
                setStatus(`Deleting ${filename}...`);

                return callFluentRemove(filename)
                  .then((result) => {
                    requireRpcSuccess(result, `Deleting ${filename}`);
                    return refresh().then(() => {
                      setStatus(`Deleted ${filename}.`);
                    });
                  })
                  .catch((error) => {
                    setStatus(`Failed to delete ${filename}: ${error instanceof Error ? error.message : String(error)}`);
                  });
              });

              if (handleDelete) {
                deleteButton.addEventListener("click", handleDelete);
              }

              return (
                <div class="fluent-bg-item">
                  {createBackgroundPreview(filename)}
                  <div class="fluent-bg-meta">
                    <strong class="fluent-bg-name" title={filename}>{filename}</strong>
                    <span class="fluent-bg-size">{formatEntrySize(entry.size)}</span>
                  </div>
                  <div class="fluent-bg-item-actions">{deleteButton}</div>
                </div>
              );
            }),
          );
        });

    uploadButton.addEventListener("click", () => {
      setStatus("Selecting background file...");

      void ui
        .uploadFile("/tmp/fluent_background.tmp")
        .then((upload) => {
          if (!upload?.name) {
            throw new Error("Upload did not return a filename.");
          }

          const filename = sanitizeFilename(upload.name);

          setStatus(`Saving ${filename}...`);

          return callFluentRename(filename)
            .then((result) => {
              requireRpcSuccess(result, `Saving ${filename}`);
              return refresh().then(() => {
                setStatus(`Saved ${filename}.`);
              });
            })
            .catch((error) => {
              setStatus(`Failed to save ${filename}: ${error instanceof Error ? error.message : String(error)}`);
            });
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (message && message !== "false") {
            setStatus(`Upload failed: ${message}`);
          } else {
            setStatus("Upload canceled.");
          }
        });
    });

    void callFluentAvail()
      .then((availableKb) => {
        setStatus(`Ready to upload or remove custom backgrounds. Available space: ${formatAvailableSpace(availableKb)}.`);
      })
      .catch(() => {
        setStatus("Ready to upload or remove custom backgrounds.");
      });

    void refresh();

    return <div class="fluent-bg-manager">{[statusEl, hintEl, actionsEl, listEl]}</div>;
  },
}) as unknown) as typeof LuCI.form.DummyValue;

export const registerLoginTab = (section: LuCI.form.TypedSection): void => {
  section.tab(
    "login",
    _("Login page"),
    _("Customize the login page background, card opacity, and blur radius for light and dark modes."),
  );

  {
    const option = section.taboption(
      "login",
      form.ListValue,
      "login_bg",
      "Background source",
      "Select the background image source for the login page.",
    );
    option.value("microsoft", "Microsoft dynamic canvas");
    option.value("custom", "Custom background");
    option.value("bing", "Bing daily wallpaper");
    option.default = FLUENT_DEFAULTS.login_bg;
    option.rmempty = false;
  }

  {
    const option = section.taboption(
      "login",
      CBIWallpaperManager,
      "_bg_mgr",
      "Custom backgrounds",
      "Upload and manage custom background images for the login page.",
    );
    option.depends("login_bg", "custom");
  }

  const modeSection = createModeSubtabs(section, "login", "login_mode_tabs");

  {
    const option = modeSection.taboption(
      "light",
      form.ListValue,
      "transparency",
      _("Login card opacity"),
      _("Opacity of the login card in light mode. 0 is fully transparent and 1 is fully opaque."),
    );
    for (const step of transparencySteps) option.value(String(step));
    option.default = FLUENT_DEFAULTS.transparency;
    option.rmempty = false;
  }

  {
    const option = modeSection.taboption(
      "light",
      form.Value,
      "blur",
      _("Backdrop blur radius"),
      _("Blur radius in pixels behind the login card in light mode. Use 0 to disable blur."),
    );
    option.datatype = "ufloat";
    option.default = FLUENT_DEFAULTS.blur;
    option.rmempty = false;
  }

  {
    const option = modeSection.taboption(
      "dark",
      form.ListValue,
      "transparency_dark",
      _("Login card opacity"),
      _("Opacity of the login card in dark mode. 0 is fully transparent and 1 is fully opaque."),
    );
    for (const step of transparencySteps) option.value(String(step));
    option.default = FLUENT_DEFAULTS.transparency_dark;
    option.rmempty = false;
  }

  {
    const option = modeSection.taboption(
      "dark",
      form.Value,
      "blur_dark",
      _("Backdrop blur radius"),
      _("Blur radius in pixels behind the login card in dark mode. Use 0 to disable blur."),
    );
    option.datatype = "ufloat";
    option.default = FLUENT_DEFAULTS.blur_dark;
    option.rmempty = false;
  }
};
