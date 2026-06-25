const form = L.form;

export const transparencySteps: number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const PREVIEW_STYLE_ID = "fluent-live-preview";
const HEX_RE = /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i;

const COLOR_UCI_TO_CSS_VAR: Record<string, { cssVar: string; isDark: boolean }> = {
  primary: { cssVar: "--fluent-primary", isDark: false },
  dark_primary: { cssVar: "--fluent-primary", isDark: true },
  page_bg: { cssVar: "--fluent-bg", isDark: false },
  dark_page_bg: { cssVar: "--fluent-bg", isDark: true },
  card_bg: { cssVar: "--fluent-bg-card", isDark: false },
  dark_card_bg: { cssVar: "--fluent-bg-card", isDark: true },
  sidebar_bg: { cssVar: "--fluent-sidebar-bg", isDark: false },
  dark_sidebar_bg: { cssVar: "--fluent-sidebar-bg", isDark: true },
  progressbar_font: { cssVar: "--fluent-progressbar-font-color", isDark: false },
  dark_progressbar_font: { cssVar: "--fluent-progressbar-font-color", isDark: true },
};

const previewRules = new globalThis.Map<string, { selector: string; cssVar: string; value: string }>();

const getPreviewStyle = (): HTMLStyleElement => {
  let el = document.getElementById(PREVIEW_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = PREVIEW_STYLE_ID;
    document.head.appendChild(el);
  }

  return el;
};

const writePreviewStyle = (): void => {
  const el = getPreviewStyle();
  const bySelector = new globalThis.Map<string, string[]>();

  for (const rule of previewRules.values()) {
    const declarations = bySelector.get(rule.selector) ?? [];
    declarations.push(`${rule.cssVar}: ${rule.value};`);
    bySelector.set(rule.selector, declarations);
  }

  let css = "";
  for (const [selector, declarations] of bySelector) {
    css += `${selector} { ${declarations.join(" ")} }\n`;
  }

  el.textContent = css;
};

const createColorPicker = (textInput: HTMLInputElement, onLiveChange: (value: string) => void): void => {
  if (textInput.dataset.fluentColorPicker === "true") {
    return;
  }

  const parent = textInput.parentElement;
  if (!parent) {
    return;
  }

  textInput.dataset.fluentColorPicker = "true";
  textInput.classList.add("fluent-color-field__text");

  const field = document.createElement("div");
  field.className = "fluent-color-field";

  const swatch = document.createElement("label");
  swatch.className = "fluent-color-swatch";
  swatch.title = _("Choose color");

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.className = "fluent-color-swatch__input";
  colorPicker.setAttribute("aria-label", _("Choose color"));

  const preview = document.createElement("span");
  preview.className = "fluent-color-swatch__preview";

  const syncColor = (value: string) => {
    if (!HEX_RE.test(value)) {
      return;
    }

    colorPicker.value = value;
    preview.style.backgroundColor = value;
  };

  syncColor(textInput.value);
  colorPicker.addEventListener("input", () => {
    textInput.value = colorPicker.value;
    preview.style.backgroundColor = colorPicker.value;
    if (HEX_RE.test(colorPicker.value)) {
      onLiveChange(colorPicker.value);
    }
  });
  textInput.addEventListener("input", () => {
    syncColor(textInput.value);
    if (HEX_RE.test(textInput.value)) {
      onLiveChange(textInput.value);
    }
  });

  swatch.appendChild(colorPicker);
  swatch.appendChild(preview);

  parent.insertBefore(field, textInput);
  field.appendChild(textInput);
  field.appendChild(swatch);
};
const publishPreview = (uciKey: string, value: string): void => {
  const mapping = COLOR_UCI_TO_CSS_VAR[uciKey];
  if (!mapping) {
    return;
  }

  const key = `${mapping.isDark ? "dark" : "light"}|${mapping.cssVar}`;
  previewRules.set(key, {
    selector: mapping.isDark ? ':root[data-theme="dark"]' : ":root",
    cssVar: mapping.cssVar,
    value,
  });
  writePreviewStyle();
};

export const configureHexColorValue = (
  option: LuCI.form.Value,
  selectorSuffix: string,
  useAnimationFrame = false,
): void => {
  option.rmempty = false;
  option.validate = (sectionId: string, value: unknown) => {
    if (sectionId) {
      return (
        HEX_RE.test(String(value)) ||
        _("Expecting: %s").format(_("valid HEX color value"))
      );
    }
    return true;
  };

  option.render = ((
    sectionId: string,
    optionIndex: number,
    cfgvalue: unknown,
  ) => {
    const el = (form.Value.prototype.render as unknown as (...args: unknown[]) => Node).call(
      option,
      sectionId,
      optionIndex,
      cfgvalue,
    );

    const bindPicker = () => {
      const textInput = document.querySelector<HTMLInputElement>(
        `[id^="widget.cbid.fluent."][id$=".${selectorSuffix}"]`,
      );
      if (textInput) {
        createColorPicker(textInput, (value) => publishPreview(selectorSuffix, value));
      }
    };

    if (useAnimationFrame) {
      requestAnimationFrame(bindPicker);
    } else {
      setTimeout(bindPicker, 0);
    }

    return el;
  }) as unknown as () => Node | Promise<Node>;
};

export const createModeSubtabs = (
  section: LuCI.form.TypedSection,
  parentTab: string,
  optionName: string,
): LuCI.form.TypedSection => {
  const container = section.taboption(parentTab, form.SectionValue, optionName, form.TypedSection, "global") ;

  const modeSection = container.subsection as LuCI.form.TypedSection;
  modeSection.anonymous = true;
  modeSection.addremove = false;
  modeSection.tab("light", _("Light mode"));
  modeSection.tab("dark", _("Dark mode"));

  return modeSection;
};
