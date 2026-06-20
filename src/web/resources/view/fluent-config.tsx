// Ambient declarations for LuCI modules loaded at runtime
const form = L.form;
const uci = L.uci;

const transSet: number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

const createColorPicker = (textInput: HTMLInputElement): void => {
  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.value = textInput.value;
  colorPicker.style.width = "24px";
  colorPicker.style.height = "24px";
  colorPicker.style.padding = "0px";
  colorPicker.style.marginLeft = "5px";
  colorPicker.style.borderRadius = "4px";
  colorPicker.style.border = "1px solid #d9d9d9";

  textInput.parentNode?.insertBefore(colorPicker, textInput.nextSibling);
  colorPicker.addEventListener("input", () => {
    textInput.value = colorPicker.value;
  });
  textInput.addEventListener("input", () => {
    colorPicker.value = textInput.value;
  });
};

class mainImpl extends L.view {
  load() {
    return uci.load("fluent");
  }
  render(data: unknown) {
    void data;

    const m = new form.Map("fluent", _("Fluent theme configuration"), _("Here you can set the primary color, theme mode, font weight, blur and transparency of the Fluent theme."));

    const s = m.section(form.TypedSection, "global", _("Theme configuration"));
    s.addremove = false;
    s.anonymous = true;
    {
      const o = s.option(form.ListValue, "mode", _("Theme mode"));
      o.value("normal", _("Follow system"));
      o.value("light", _("Light mode"));
      o.value("dark", _("Dark mode"));
      o.default = "normal";
      o.rmempty = false;
    }

    {
      const o = s.option(form.ListValue, "font_weight", _("Font"));
      o.value("normal", _("Normal"));
      o.value("600", _("Semibold"));
      o.default = "600";
      o.rmempty = false;
    }
    {
      const o = s.option(form.ListValue, "control_height", _("Control Height"));
      o.value("32", _("Compact (32px)"));
      o.value("42", _("Default (42px)"));
      o.default = "32";
      o.rmempty = false;
    }
    {
      const o = s.option(form.Flag, "custom_select", _("Fluent Select Dropdown"), _("Transform native select elements into FluentUI-styled custom dropdowns."));
      o.default = o.enabled;
      o.rmempty = false;
    }
    {
      const o = s.option(form.Flag, "view_transition", _("Page Transition Animation"), _("Enable smooth fade-out/fade-in transitions between page loads using the View Transition API."));
      o.default = o.enabled;
      o.rmempty = false;
    }
    {
      const o = s.option(form.Flag, "tab_animation", _("Tab Slide Animation"), _("Enable sliding animation for tab menu underline indicators."));
      o.default = o.enabled;
      o.rmempty = false;
    }
    {
      const o = s.option(form.Flag, "prefers_reduced_motion", _("Respect System Animation Settings"), _("When enabled, respects the browser/OS-level 'reduced motion' animation preferences. When disabled, ignores them and forces sliding tab animations."));
      o.default = o.enabled;
      o.rmempty = false;
      o.depends("tab_animation", "1");
    }
    {
      const o = s.option(form.Flag, "loading_bar", _("Top Loading Bar"), _("Display a FluentUI-styled indeterminate progress bar at the top of the page during page loads and transitions."));
      o.default = o.enabled;
      o.rmempty = false;
    }
    {
      const o = s.option(form.Value, "primary", _("[Light mode] Primary Color"), _("A HEX color (default: #0078d4)."));
      o.default = "#0078d4";
      o.rmempty = false;
      o.validate = (sectionId: string, value: unknown) => {
        if (sectionId) {
          return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(String(value)) || _("Expecting: %s").format(_("valid HEX color value"));
        }
        return true;
      };
      o.render = (sectionId: string, optionIndex: number, cfgvalue: unknown) => {
        const el = form.Value.prototype.render.call(o, sectionId, optionIndex, cfgvalue);
        setTimeout(() => {
          const textInput = document.querySelector<HTMLInputElement>('[id^="widget.cbid.fluent."][id$=".primary"]');
          if (textInput) createColorPicker(textInput);
        }, 0);
        return el;
      };
    }

    {
      const o = s.option(form.ListValue, "transparency", _("[Light mode] Transparency"), _("0 transparent - 1 opaque (suggest: transparent: 0 or translucent preset: 0.5)."));
      for (const i of transSet) o.value(String(i));
      o.default = "0.5";
      o.rmempty = false;
    }

    {
      const o = s.option(form.Value, "blur", _("[Light mode] Frosted Glass Radius"), _("Larger value will more blurred (suggest: clear: 0 or blur preset: 10)."));
      o.datatype = "ufloat";
      o.default = "0";
      o.rmempty = false;
    }
    {
      const o = s.option(form.Value, "progressbar_font", _("[Light mode] Progress bar Font Color"), _("A HEX color (default: #2e2b60)."));
      o.default = "#2e2b60";
      o.rmempty = false;
      o.validate = (sectionId: string, value: unknown) => {
        if (sectionId) {
          return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(String(value)) || _("Expecting: %s").format(_("valid HEX color value"));
        }
        return true;
      };
      o.render = (sectionId: string, optionIndex: number, cfgvalue: unknown) => {
        const el = form.Value.prototype.render.call(o, sectionId, optionIndex, cfgvalue);
        setTimeout(() => {
          const textInput = document.querySelector<HTMLInputElement>('[id^="widget.cbid.fluent."][id$=".progressbar_font"]');
          if (textInput) createColorPicker(textInput);
        }, 0);
        return el;
      };
    }
    {
      const o = s.option(form.Value, "dark_primary", _("[Dark mode] Primary Color"), _("A HEX Color (default: #1a1a2e)."));
      o.default = "#1a1a2e";
      o.rmempty = false;
      o.validate = (sectionId: string, value: unknown) => {
        if (sectionId) {
          return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(String(value)) || _("Expecting: %s").format(_("valid HEX color value"));
        }
        return true;
      };
      o.render = (sectionId: string, optionIndex: number, cfgvalue: unknown) => {
        const el = form.Value.prototype.render.call(o, sectionId, optionIndex, cfgvalue);
        requestAnimationFrame(() => {
          const textInput = document.querySelector<HTMLInputElement>('[id^="widget.cbid.fluent."][id$=".dark_primary"]');
          if (textInput) createColorPicker(textInput);
        });
        return el;
      };
    }
    {
      const o = s.option(form.ListValue, "transparency_dark", _("[Dark mode] Transparency"), _("0 transparent - 1 opaque (suggest: black translucent preset: 0.5)."));
      for (const i of transSet) o.value(String(i));
      o.default = "0.5";
      o.rmempty = false;
    }
    {
      const o = s.option(form.Value, "blur_dark", _("[Dark mode] Frosted Glass Radius"), _("Larger value will more blurred (suggest: clear: 0 or blur preset: 10)."));
      o.datatype = "ufloat";
      o.default = "0";
      o.rmempty = false;
    }
    {
      const o = s.option(form.Button, "_save", _("Save settings"));
      o.inputstyle = "apply";
      o.inputtitle = _("Save current settings");
      o.onclick = () => {
        ui.changes.apply(true);
        return m.save(undefined, true);
      };
    }
    return m.render();
  }
  handleSaveApply = null;
  handleSave = null;
  handleReset = null;
}

export const main = mainImpl;
