/**
 * Advanced MAC Selector Component for OpenWrt LuCI
 * Renders a square edit button next to MAC inputs.
 * Opens an independent stacked modal overlay over existing forms.
 */

interface VendorItem {
  name: string;
  prefix: string;
}

const VENDOR_PREFIXES: VendorItem[] = [
  { name: _("Random Local MAC"), prefix: "RANDOM_LOCAL" },
  { name: "Apple", prefix: "00:1C:42" },
  { name: "Apple", prefix: "AC:BC:32" },
  { name: "Intel", prefix: "00:1E:67" },
  { name: "Intel", prefix: "3C:FD:FE" },
  { name: "Huawei", prefix: "00:1E:10" },
  { name: "Huawei", prefix: "70:54:F5" },
  { name: "Xiaomi", prefix: "18:59:36" },
  { name: "Xiaomi", prefix: "34:80:B3" },
  { name: "ASUS", prefix: "04:D4:C4" },
  { name: "ASUS", prefix: "2C:4D:54" },
  { name: "TP-Link", prefix: "00:1D:0F" },
  { name: "TP-Link", prefix: "50:C7:BF" },
  { name: "Lenovo", prefix: "00:12:FE" },
  { name: "Dell", prefix: "00:14:22" },
  { name: "Microsoft", prefix: "00:15:5D" },
  { name: "Raspberry Pi", prefix: "B8:27:EB" },
  { name: "Raspberry Pi", prefix: "DC:A6:32" },
  { name: "Realtek / QEMU", prefix: "52:54:00" },
  { name: "Cisco", prefix: "00:00:0C" },
  { name: "Samsung", prefix: "00:12:FB" },
];

function inferVendorPrefixFromMac(macStr: string): string | null {
  if (!macStr) return null;
  const cleanMac = macStr.trim().toUpperCase().replace(/[:-]/g, "");
  if (cleanMac.length < 6) return null;

  const prefixHex = cleanMac.slice(0, 6);
  const formattedPrefix = `${prefixHex.slice(0, 2)}:${prefixHex.slice(2, 4)}:${prefixHex.slice(4, 6)}`;

  const match = VENDOR_PREFIXES.find((v) => v.prefix.toUpperCase() === formattedPrefix);
  return match ? match.prefix : null;
}

function getRandomByteHex(): string {
  const byte = Math.floor(Math.random() * 256);
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

function generateMacAddress(vendorPrefix?: string): string {
  if (vendorPrefix && vendorPrefix !== "RANDOM_LOCAL") {
    const cleanPrefix = vendorPrefix.trim().toUpperCase();
    const parts = cleanPrefix.split(/[:-]/);
    while (parts.length < 6) {
      parts.push(getRandomByteHex());
    }
    return parts.slice(0, 6).join(":");
  }

  // Locally administered unicast MAC: 2nd nibble of 1st byte is 2, 6, A, or E
  const localNibbles = ["2", "6", "A", "E"];
  const firstNibble = Math.floor(Math.random() * 16)
    .toString(16)
    .toUpperCase();
  const secondNibble = localNibbles[Math.floor(Math.random() * localNibbles.length)];
  const firstByte = `${firstNibble}${secondNibble}`;

  const macBytes = [firstByte];
  for (let i = 0; i < 5; i++) {
    macBytes.push(getRandomByteHex());
  }

  return macBytes.join(":");
}

function updateInputValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function openMacOverlayModal(targetInput: HTMLInputElement) {
  const currentVal = targetInput.value.trim() || targetInput.placeholder || "00:00:00:00:00:00";
  const matchedVendorPrefix = inferVendorPrefixFromMac(currentVal);
  const modalInputId = "fluent-mac-overlay-input";
  const vendorSelectId = "fluent-mac-overlay-vendor-select";

  // 1. Modal Input Preview Box
  const modalInput = (<input id={modalInputId} type="text" class="cbi-input-text fluent-mac-modal-input" value={currentVal} placeholder="00:00:00:00:00:00" />) as HTMLInputElement;

  // 2. Native LuCI Select Dropdown (Auto-transformed by setupFluentSelects)
  const vendorSelect = (
    <select id={vendorSelectId} class="cbi-input-select" style="width: 100%;">
      <option value="" disabled hidden selected={!matchedVendorPrefix}>
        {_("Select vendor prefix...")}
      </option>
    </select>
  ) as HTMLSelectElement;

  VENDOR_PREFIXES.forEach((vendor) => {
    const opt = document.createElement("option");
    opt.value = vendor.prefix;
    opt.textContent = `${vendor.name} (${vendor.prefix === "RANDOM_LOCAL" ? "x2:xx:xx" : vendor.prefix})`;
    if (matchedVendorPrefix && vendor.prefix === matchedVendorPrefix) {
      opt.selected = true;
    }
    vendorSelect.appendChild(opt);
  });

  if (matchedVendorPrefix) {
    vendorSelect.value = matchedVendorPrefix;
  }

  // 3. Random MAC Button (Generates MAC based on currently selected vendor prefix or random)
  const randomBtn = (
    <button type="button" class="btn cbi-button cbi-button-action fluent-mac-random-btn">
      {_("Randomize MAC")}
    </button>
  ) as HTMLButtonElement;

  randomBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const selectedPrefix = vendorSelect.value;
    modalInput.value = generateMacAddress(selectedPrefix || undefined);
  });

  // 4. Modal Footer Action Buttons
  const cancelBtn = (
    <button type="button" class="btn cbi-button cbi-button-neutral">
      {_("Cancel")}
    </button>
  ) as HTMLButtonElement;

  const confirmBtn = (
    <button type="button" class="btn cbi-button cbi-button-positive">
      {_("Confirm")}
    </button>
  ) as HTMLButtonElement;

  // 5. Stacked Backdrop Container (z-index: 2500)
  const closeBtn = (<button type="button" class="fluent-mac-overlay-close" title={_("Close")}></button>) as HTMLButtonElement;

  const backdrop = (
    <div class="fluent-mac-overlay-backdrop">
      <div class="fluent-mac-overlay-card">
        <div class="fluent-mac-overlay-header">
          <h3>{_("Advanced MAC Selector")}</h3>
          {closeBtn}
        </div>

        <div class="fluent-mac-overlay-body">
          <div class="fluent-mac-field-block">
            <label htmlFor={modalInputId} class="fluent-mac-label">
              {_("Current / Pending MAC Address")}
            </label>
            {modalInput}
          </div>

          <div class="fluent-mac-field-block">
            <label htmlFor={vendorSelectId} class="fluent-mac-label">
              {_("Preset Vendor / Generator")}
            </label>
            <div class="fluent-mac-picker-row">
              <div class="fluent-mac-vendor-picker-wrap">{vendorSelect}</div>
              {randomBtn}
            </div>
          </div>
        </div>

        <div class="fluent-mac-overlay-footer">
          {cancelBtn}
          {confirmBtn}
        </div>
      </div>
    </div>
  ) as HTMLElement;

  const closeOverlay = () => {
    backdrop.remove();
  };

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeOverlay();
  });

  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeOverlay();
  });

  confirmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const finalMac = modalInput.value.trim();
    if (finalMac) {
      updateInputValue(targetInput, finalMac);
    }
    closeOverlay();
  });

  // Click on backdrop background (outside card) closes overlay
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      closeOverlay();
    }
  });

  document.body.appendChild(backdrop);
}

function enhanceMacInput(input: HTMLInputElement) {
  if (input.dataset.fluentMacInit === "true") return;
  input.dataset.fluentMacInit = "true";

  const parent = input.parentElement;
  if (!parent) return;

  // Ensure input is wrapped in a .cbi-input-group.fluent-mac-selector-group
  let groupWrapper: HTMLElement;
  if (parent.classList.contains("fluent-mac-selector-group")) {
    groupWrapper = parent;
  } else {
    groupWrapper = (<div class="cbi-input-group fluent-mac-selector-group"></div>) as HTMLElement;
    parent.insertBefore(groupWrapper, input);
    groupWrapper.appendChild(input);
  }

  // Create square edit button (Uses SCSS mask icon for edit)
  const editBtn = (<button type="button" class="cbi-button cbi-button-action fluent-mac-edit-btn" title={_("Advanced MAC Selector")}></button>) as HTMLButtonElement;

  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMacOverlayModal(input);
  });

  groupWrapper.appendChild(editBtn);
}

export function setupMacSelector() {
  // 1. Initial scan for inputs ending with .macaddr
  const macInputs = document.querySelectorAll<HTMLInputElement>('input[id$=".macaddr"]');
  macInputs.forEach((input) => {
    enhanceMacInput(input);
  });

  // 2. Observer for dynamic MAC inputs (e.g. CBI dynamic lists, modal forms)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === "INPUT" && el.id && el.id.endsWith(".macaddr")) {
            enhanceMacInput(el as HTMLInputElement);
          } else {
            const innerInputs = el.querySelectorAll<HTMLInputElement>('input[id$=".macaddr"]');
            innerInputs.forEach((input) => {
              enhanceMacInput(input);
            });
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
