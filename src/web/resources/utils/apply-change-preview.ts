type DisplayStatus = (type: string | false | null | undefined, content?: Node | DocumentFragment | string | null) => void;
type ChangeManager = typeof ui.changes & {
  changes?: unknown;
  displayStatus?: DisplayStatus;
  [setupMarker]?: true;
};
type ChangeEntries = readonly [string, readonly unknown[]][];

const setupMarker = Symbol("fluentApplyChangePreview");
const applyingModalSelector = "#modal_overlay .modal.alert-message.notice.spinning";

interface ActiveRequest {
  token: number;
  changes: ChangeEntries | null;
  preview: HTMLElement | null;
  dismissed?: boolean;
}

function appendText(element: HTMLElement, value: string): void {
  element.appendChild(document.createTextNode(value));
}

function appendStrong(element: HTMLElement, value: string): void {
  const strong = document.createElement("strong");
  strong.textContent = value;
  element.appendChild(strong);
}

function quoteValue(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function stringifyRecord(record: unknown): string {
  try {
    return JSON.stringify(record) ?? String(record);
  } catch {
    return "[unserializable UCI change record]";
  }
}

function changeEntries(changes: unknown): ChangeEntries {
  if (changes === null || typeof changes !== "object") return [];

  return Object.entries(changes).flatMap(([config, records]) => (Array.isArray(records) && records.length ? [[config, records] as const] : []));
}

function sectionReference(sectionId: string, added: readonly [string, string] | null): string {
  return added !== null && sectionId === added[0] ? `@${added[1]}[-1]` : sectionId;
}

function createTextLine(tag: "ins" | "del" | "var", text: string): HTMLElement {
  const line = document.createElement(tag);
  line.textContent = text;
  return line;
}

function createNestedLine(tag: "ins" | "del", prefix: string, value: string): HTMLElement {
  const line = document.createElement("var");
  const command = document.createElement(tag);
  appendText(command, prefix);
  appendStrong(command, value);
  line.appendChild(command);
  return line;
}

function createChangeLine(config: string, record: unknown, added: readonly [string, string] | null): HTMLElement {
  if (!Array.isArray(record) || !record.every((part) => typeof part === "string")) {
    return createTextLine("var", stringifyRecord(record));
  }

  const [operation, sectionId, parameter, value] = record;
  const section = sectionId === undefined ? undefined : sectionReference(sectionId, added);

  if (operation === "add" && record.length === 3 && section !== undefined && parameter !== undefined) {
    const line = document.createElement("ins");
    appendText(line, `uci add ${config} `);
    appendStrong(line, parameter);
    appendText(line, ` # =${section}`);
    return line;
  }

  if (operation === "set" && record.length === 3 && section !== undefined && parameter !== undefined) {
    const line = document.createElement("ins");
    appendText(line, `uci set ${config}.`);
    appendStrong(line, section);
    appendText(line, `=${parameter}`);
    return line;
  }

  if (operation === "set" && record.length === 4 && section !== undefined && parameter !== undefined && value !== undefined) {
    return createNestedLine("ins", `uci set ${config}.${section}.${parameter}=`, quoteValue(value));
  }

  if (operation === "remove" && record.length === 2 && section !== undefined) {
    const line = document.createElement("del");
    appendText(line, `uci del ${config}.`);
    appendStrong(line, section);
    return line;
  }

  if (operation === "remove" && record.length === 3 && section !== undefined && parameter !== undefined) {
    return createNestedLine("del", `uci del ${config}.${section}.`, parameter);
  }

  if (operation === "order" && record.length === 3 && section !== undefined && parameter !== undefined) {
    const line = document.createElement("var");
    appendText(line, `uci reorder ${config}.${section}=`);
    appendStrong(line, parameter);
    return line;
  }

  if (operation === "list-add" && record.length === 4 && section !== undefined && parameter !== undefined && value !== undefined) {
    return createNestedLine("ins", `uci add_list ${config}.${section}.${parameter}=`, quoteValue(value));
  }

  if (operation === "list-del" && record.length === 4 && section !== undefined && parameter !== undefined && value !== undefined) {
    return createNestedLine("del", `uci del_list ${config}.${section}.${parameter}=`, quoteValue(value));
  }

  if (operation === "rename" && record.length === 3 && section !== undefined && parameter !== undefined) {
    const line = document.createElement("var");
    appendText(line, `uci rename ${config}.${section}=`);
    appendStrong(line, parameter);
    return line;
  }

  if (operation === "rename" && record.length === 4 && section !== undefined && parameter !== undefined && value !== undefined) {
    const line = document.createElement("var");
    appendText(line, `uci rename ${config}.${section}.${parameter}=`);
    appendStrong(line, quoteValue(value));
    return line;
  }

  return createTextLine("var", stringifyRecord(record));
}

function createPreview(changes: ChangeEntries, onDismiss?: () => void): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "fluent-apply-change-preview";

  for (const [config, records] of changes) {
    const card = document.createElement("div");
    card.className = "fluent-apply-change-preview-card";

    const heading = document.createElement("div");
    heading.className = "fluent-apply-change-preview-card-header";

    const title = document.createElement("span");
    title.textContent = `# /etc/config/${config}`;
    heading.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "fluent-apply-change-preview-close";
    closeBtn.type = "button";
    closeBtn.title = "Close preview";
    closeBtn.onclick = () => {
      if (onDismiss) onDismiss();
      preview.remove();
    };
    heading.appendChild(closeBtn);

    card.appendChild(heading);

    const body = document.createElement("div");
    body.className = "fluent-apply-change-preview-card-body uci-change-list";

    let added: readonly [string, string] | null = null;
    for (const record of records) {
      body.appendChild(createChangeLine(config, record, added));

      if (Array.isArray(record) && record.length === 3 && record[0] === "add" && typeof record[1] === "string" && typeof record[2] === "string") {
        added = [record[1], record[2]];
      }
    }
    card.appendChild(body);
    preview.appendChild(card);
  }

  return preview;
}

/**
 * Shows the staged UCI changes beneath LuCI's native apply status while the
 * Fluent configuration flag is enabled.
 */
export function setupApplyChangePreview(): void {
  const changes = ui.changes as ChangeManager;
  if (changes[setupMarker] || typeof changes.apply !== "function" || typeof changes.displayStatus !== "function") return;

  const originalApply = changes.apply.bind(changes);
  const originalDisplayStatus = changes.displayStatus.bind(changes);
  let nextToken = 0;
  let activeRequest: ActiveRequest | null = null;

  const renderActivePreview = (): void => {
    const request = activeRequest;
    if (request === null || request.changes === null || request.dismissed) return;

    const modal = document.querySelector<HTMLElement>(applyingModalSelector);
    if (!modal) return;

    const parent = modal.parentElement || modal;

    const previews = parent.querySelectorAll<HTMLElement>(".fluent-apply-change-preview");
    if (previews.length === 1 && previews[0] === request.preview) return;

    previews.forEach((preview) => {
      preview.remove();
    });

    const preview =
      request.preview ||
      createPreview(request.changes, () => {
        request.dismissed = true;
      });
    parent.appendChild(preview);
    request.preview = preview;
  };

  let removeTimeout: ReturnType<typeof setTimeout> | null = null;

  changes.displayStatus = (type, content) => {
    if (type !== "notice spinning") {
      if (removeTimeout === null) {
        removeTimeout = setTimeout(() => {
          if (typeof document.querySelectorAll === "function") {
            document.querySelectorAll(".fluent-apply-change-preview").forEach((el) => {
              el.remove();
            });
          }
          removeTimeout = null;
        }, 150);
      }
    } else {
      if (removeTimeout !== null) {
        clearTimeout(removeTimeout);
        removeTimeout = null;
      }
    }

    originalDisplayStatus(type, content);

    if (!type) {
      nextToken += 1;
      activeRequest = null;
      return;
    }

    if (type === "notice spinning") renderActivePreview();
  };

  // Native LuCI may create #modal_overlay only when applying starts, or replace the spinner
  // through an existing displayStatus reference. Observe the document so both cases render.
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(renderActivePreview).observe(document, { childList: true, subtree: true });
  }

  changes.apply = (checked?: boolean): void => {
    const token = ++nextToken;
    activeRequest = null;

    const configValue = L.uci.get_first("fluent", "global", "uci_changes_preview");
    if (configValue === "1" || configValue === null || configValue === undefined) {
      const cachedEntries = changeEntries(changes.changes);
      activeRequest = { token, changes: cachedEntries.length ? cachedEntries : null, preview: null };
      try {
        void L.uci.changes().then(
          (result) => {
            if (activeRequest?.token !== token) return;

            const entries = changeEntries(result);
            if (!entries.length) return;

            activeRequest.changes = entries;
            renderActivePreview();
          },
          () => {
            if (activeRequest?.token === token && activeRequest.changes === null) activeRequest = null;
          },
        );
      } catch {
        if (activeRequest?.token === token && activeRequest.changes === null) activeRequest = null;
      }
    }

    originalApply(checked);
  };

  changes[setupMarker] = true;
}
