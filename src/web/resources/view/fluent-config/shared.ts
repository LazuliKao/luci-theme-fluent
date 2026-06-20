const form = L.form;

export const transparencySteps: number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

const createColorPicker = (textInput: HTMLInputElement): void => {
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
    if (!/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(value)) {
      return;
    }

    colorPicker.value = value;
    preview.style.backgroundColor = value;
  };

  syncColor(textInput.value);
  colorPicker.addEventListener("input", () => {
    textInput.value = colorPicker.value;
    preview.style.backgroundColor = colorPicker.value;
  });
  textInput.addEventListener("input", () => {
    syncColor(textInput.value);
  });

  swatch.appendChild(colorPicker);
  swatch.appendChild(preview);

  parent.insertBefore(field, textInput);
  field.appendChild(textInput);
  field.appendChild(swatch);
}

export const configureHexColorValue = (
  option: LuCI.form.Value,
  selectorSuffix: string,
  useAnimationFrame = false,
): void => {
  option.rmempty = false;
  option.validate = (sectionId: string, value: unknown) => {
    if (sectionId) {
      return (
        /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(String(value)) ||
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
      if (textInput) createColorPicker(textInput);
    };

    if (useAnimationFrame) {
      requestAnimationFrame(bindPicker);
    } else {
      setTimeout(bindPicker, 0);
    }

    return el;
  }) as unknown as () => Node | Promise<Node>;
};
