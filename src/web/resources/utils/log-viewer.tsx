/**
 * Log Viewer Utility for OpenWrt LuCI System Logs & Kernel Logs
 * Replaces plain textarea#syslog with a rich, theme-aware, interactive log viewer.
 */

interface ParsedLogLine {
  lineNumber: number;
  raw: string;
  time?: string;
  level?: string;
  levelType: "err" | "warn" | "notice" | "info" | "debug" | "default";
  tag?: string;
  message: string;
  isDisconnect: boolean;
}

const LS_WRAP_KEY = "fluent-log-wordwrap";
const LS_AUTOSCROLL_KEY = "fluent-log-autoscroll";

function tr(str: string): string {
  return typeof _ === "function" ? _(str) : str;
}

function formatTimestamp(timeStr: string): string {
  // If float seconds (dmesg): e.g. "0.000000" or "  1234.567890"
  if (/^\s*[\d.]+\s*$/.test(timeStr)) {
    const sec = parseFloat(timeStr);
    return Number.isNaN(sec) ? timeStr.trim() : `${sec.toFixed(2)}s`;
  }

  // Extract HH:mm:ss
  const timeMatch = timeStr.match(/(\d{2}:\d{2}:\d{2})/);
  if (timeMatch) {
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };

    // Pattern A: "23 Jul"
    const matchA = timeStr.match(/(\d{1,2})\s+([A-Za-z]{3})/i);
    if (matchA) {
      const day = matchA[1].padStart(2, "0");
      const mKey = matchA[2].toLowerCase();
      if (monthMap[mKey]) {
        return `${monthMap[mKey]}-${day} ${timeMatch[1]}`;
      }
    }

    // Pattern B: "Jul 23"
    const matchB = timeStr.match(/([A-Za-z]{3})\s+(\d{1,2})/i);
    if (matchB) {
      const mKey = matchB[1].toLowerCase();
      const day = matchB[2].padStart(2, "0");
      if (monthMap[mKey]) {
        return `${monthMap[mKey]}-${day} ${timeMatch[1]}`;
      }
    }

    return timeMatch[1];
  }

  return timeStr;
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    tempTextArea.style.position = "fixed";
    tempTextArea.style.left = "-9999px";
    tempTextArea.style.top = "-9999px";
    document.body.appendChild(tempTextArea);
    tempTextArea.focus();
    tempTextArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(tempTextArea);
    return successful;
  } catch (_e) {
    return false;
  }
}

export function setupLogViewer() {
  // 1. Check existing textarea#syslog in DOM
  const existing = document.getElementById("syslog") as HTMLTextAreaElement | null;
  if (existing) {
    enhanceSyslogTextarea(existing);
  }

  // 2. Observe DOM mutations for dynamic page loading / tab switches in LuCI SPA
  const bodyObserver = new MutationObserver(() => {
    const textarea = document.getElementById("syslog") as HTMLTextAreaElement | null;
    if (textarea && textarea.getAttribute("data-fluent-log-transformed") !== "true") {
      enhanceSyslogTextarea(textarea);
    }
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function enhanceSyslogTextarea(textarea: HTMLTextAreaElement) {
  if (textarea.getAttribute("data-fluent-log-transformed") === "true") return;
  textarea.setAttribute("data-fluent-log-transformed", "true");

  // Read saved toggle states from localStorage
  let isWordWrap = localStorage.getItem(LS_WRAP_KEY) === "true";
  let isAutoScroll = localStorage.getItem(LS_AUTOSCROLL_KEY) !== "false";
  let isFullscreen = false;

  let originalParent: Node | null = null;
  let originalNextSibling: Node | null = null;

  // Create Log Viewer DOM elements using TSX
  const viewer = (
    <div class="fluent-log-viewer">
      <div class="fluent-log-viewer__header">
        <div class="fluent-log-viewer__stats">
          <span class="fluent-log-viewer__badge fluent-log-viewer__badge--lines">
            <span class="fluent-log-viewer__badge-icon fluent-log-viewer__badge-icon--lines"></span>
            <span class="fluent-log-viewer__badge-count" id="fluentLogCountLines">0</span>
            <span class="fluent-log-viewer__badge-label">{tr("行")}</span>
          </span>
          <span class="fluent-log-viewer__badge fluent-log-viewer__badge--errors">
            <span class="fluent-log-viewer__badge-icon fluent-log-viewer__badge-icon--errors"></span>
            <span class="fluent-log-viewer__badge-count" id="fluentLogCountErrors">0</span>
            <span class="fluent-log-viewer__badge-label">{tr("错误")}</span>
          </span>
          <span class="fluent-log-viewer__badge fluent-log-viewer__badge--warnings">
            <span class="fluent-log-viewer__badge-icon fluent-log-viewer__badge-icon--warnings"></span>
            <span class="fluent-log-viewer__badge-count" id="fluentLogCountWarnings">0</span>
            <span class="fluent-log-viewer__badge-label">{tr("警告")}</span>
          </span>
          <span class="fluent-log-viewer__badge fluent-log-viewer__badge--disconnects">
            <span class="fluent-log-viewer__badge-icon fluent-log-viewer__badge-icon--disconnects"></span>
            <span class="fluent-log-viewer__badge-count" id="fluentLogCountDisconnects">0</span>
            <span class="fluent-log-viewer__badge-label">{tr("断开")}</span>
          </span>
        </div>
        <div class="fluent-log-viewer__toolbar">
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="wrap" title={tr("自动换行")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--wrap"></span>
          </button>
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="autoscroll" title={tr("自动滚动")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--autoscroll"></span>
          </button>
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="copy" title={tr("复制日志")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--copy"></span>
          </button>
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="download" title={tr("下载日志")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--download"></span>
          </button>
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="scroll-top" title={tr("滚动到顶部")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--scroll-top"></span>
          </button>
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="scroll-bottom" title={tr("滚动到底部")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--scroll-bottom"></span>
          </button>
          <button type="button" class="fluent-log-viewer__tool-btn" data-action="fullscreen" title={tr("全屏查看")}>
            <span class="fluent-log-viewer__icon fluent-log-viewer__icon--fullscreen"></span>
          </button>
        </div>
      </div>
      <div class="fluent-log-viewer__body">
        <div class="fluent-log-viewer__content"></div>
      </div>
    </div>
  ) as HTMLElement;

  const countLinesEl = viewer.querySelector("#fluentLogCountLines") as HTMLElement;
  const countErrorsEl = viewer.querySelector("#fluentLogCountErrors") as HTMLElement;
  const countWarningsEl = viewer.querySelector("#fluentLogCountWarnings") as HTMLElement;
  const countDisconnectsEl = viewer.querySelector("#fluentLogCountDisconnects") as HTMLElement;
  const bodyEl = viewer.querySelector(".fluent-log-viewer__body") as HTMLElement;
  const contentEl = viewer.querySelector(".fluent-log-viewer__content") as HTMLElement;
  const wrapBtn = viewer.querySelector('[data-action="wrap"]') as HTMLElement;
  const autoScrollBtn = viewer.querySelector('[data-action="autoscroll"]') as HTMLElement;
  const copyBtn = viewer.querySelector('[data-action="copy"]') as HTMLElement;
  const downloadBtn = viewer.querySelector('[data-action="download"]') as HTMLElement;
  const scrollTopBtn = viewer.querySelector('[data-action="scroll-top"]') as HTMLElement;
  const scrollBottomBtn = viewer.querySelector('[data-action="scroll-bottom"]') as HTMLElement;
  const fullscreenBtn = viewer.querySelector('[data-action="fullscreen"]') as HTMLElement;

  // Restore initial button active states from localStorage
  if (isWordWrap) {
    wrapBtn.classList.add("active");
    viewer.classList.add("fluent-log-viewer--wrap");
  }

  if (isAutoScroll) {
    autoScrollBtn.classList.add("active");
  }

  // Hide raw textarea and insert viewer after it
  textarea.style.display = "none";
  if (textarea.parentNode) {
    textarea.parentNode.insertBefore(viewer, textarea.nextSibling);
  }

  // Event handlers
  wrapBtn.addEventListener("click", () => {
    isWordWrap = !isWordWrap;
    wrapBtn.classList.toggle("active", isWordWrap);
    viewer.classList.toggle("fluent-log-viewer--wrap", isWordWrap);
    try {
      localStorage.setItem(LS_WRAP_KEY, isWordWrap ? "true" : "false");
    } catch (_e) {}
  });

  autoScrollBtn.addEventListener("click", () => {
    isAutoScroll = !isAutoScroll;
    autoScrollBtn.classList.toggle("active", isAutoScroll);
    try {
      localStorage.setItem(LS_AUTOSCROLL_KEY, isAutoScroll ? "true" : "false");
    } catch (_e) {}
    if (isAutoScroll) {
      requestAnimationFrame(() => {
        bodyEl.scrollTop = bodyEl.scrollHeight;
      });
    }
  });

  copyBtn.addEventListener("click", () => {
    const text = textarea.value || textarea.textContent || "";
    copyToClipboard(text).then((success) => {
      if (success) {
        showFeedback(copyBtn, tr("已复制"));
      }
    });
  });

  downloadBtn.addEventListener("click", () => {
    const text = textarea.value || textarea.textContent || "";
    const isDmesg = location.pathname.includes("dmesg");
    const prefix = isDmesg ? "dmesg" : "syslog";
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${prefix}-${dateStr}.log`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback(downloadBtn, tr("已下载"));
  });

  scrollTopBtn.addEventListener("click", () => {
    bodyEl.scrollTo({ top: 0, behavior: "smooth" });
  });

  scrollBottomBtn.addEventListener("click", () => {
    bodyEl.scrollTo({ top: bodyEl.scrollHeight, behavior: "smooth" });
  });

  fullscreenBtn.addEventListener("click", () => {
    isFullscreen = !isFullscreen;
    fullscreenBtn.classList.toggle("active", isFullscreen);

    if (isFullscreen) {
      originalParent = viewer.parentNode;
      originalNextSibling = viewer.nextSibling;
      document.body.appendChild(viewer);
      viewer.classList.add("fluent-log-viewer--fullscreen");
      document.body.classList.add("fluent-log-fullscreen");
    } else {
      if (originalParent) {
        originalParent.insertBefore(viewer, originalNextSibling);
      }
      viewer.classList.remove("fluent-log-viewer--fullscreen");
      document.body.classList.remove("fluent-log-fullscreen");
    }

    const iconEl = fullscreenBtn.querySelector(".fluent-log-viewer__icon");
    if (iconEl) {
      iconEl.classList.toggle("fluent-log-viewer__icon--fullscreen", !isFullscreen);
      iconEl.classList.toggle("fluent-log-viewer__icon--fullscreen-exit", isFullscreen);
    }
  });

  function showFeedback(btn: HTMLElement, msg: string) {
    const origTitle = btn.getAttribute("title") || "";
    btn.setAttribute("title", msg);
    btn.classList.add("fluent-log-viewer__tool-btn--feedback");
    setTimeout(() => {
      btn.setAttribute("title", origTitle);
      btn.classList.remove("fluent-log-viewer__tool-btn--feedback");
    }, 1500);
  }

  // Parse raw log text into structured lines
  function parseLogText(rawText: string): { lines: ParsedLogLine[]; errors: number; warnings: number; disconnects: number } {
    const rawLines = rawText.split(/\r?\n/);
    const lines: ParsedLogLine[] = [];
    let errors = 0;
    let warnings = 0;
    let disconnects = 0;
    let lineNum = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const lineStr = rawLines[i];
      if (!lineStr && i === rawLines.length - 1) continue; // skip trailing empty line
      lineNum++;

      let time: string | undefined;
      let level: string | undefined;
      let levelType: ParsedLogLine["levelType"] = "default";
      let tag: string | undefined;
      let message = lineStr;

      // 1. Try parsing syslog standard format: [Timestamp] facility.severity: tag: message
      const sysMatch = lineStr.match(/^\[([^\]]+)\]\s+([a-zA-Z0-9_-]+\.([a-zA-Z0-9_-]+))\s*:\s*(?:([a-zA-Z0-9_./-]+(?:\[\d+\])?)\s*:\s*)?(.*)$/);
      if (sysMatch) {
        time = sysMatch[1];
        level = sysMatch[2];
        const sev = sysMatch[3].toLowerCase();
        tag = sysMatch[4];
        message = sysMatch[5];

        if (["err", "error", "crit", "alert", "emerg"].includes(sev)) {
          levelType = "err";
          errors++;
        } else if (["warn", "warning"].includes(sev)) {
          levelType = "warn";
          warnings++;
        } else if (["notice", "info"].includes(sev)) {
          levelType = sev === "notice" ? "notice" : "info";
        } else if (sev === "debug") {
          levelType = "debug";
        }
      } else {
        // 2. Try parsing dmesg format: [   0.000000] message
        const dmesgMatch = lineStr.match(/^\[\s*([\d.]+)\]\s+(.*)$/);
        if (dmesgMatch) {
          time = dmesgMatch[1];
          message = dmesgMatch[2];

          const lowerMsg = message.toLowerCase();
          if (lowerMsg.includes("cut here") || lowerMsg.includes("panic") || lowerMsg.includes("error") || lowerMsg.includes("failed")) {
            levelType = "err";
            errors++;
          } else if (lowerMsg.includes("warning") || lowerMsg.includes("warn")) {
            levelType = "warn";
            warnings++;
          }
        }
      }

      // Check for disconnect / disassociated keywords
      const isDisconnect = /disconnect|disassociat|deauthenticat|Exited normally|Exit before auth/i.test(lineStr);
      if (isDisconnect) {
        disconnects++;
      }

      lines.push({
        lineNumber: lineNum,
        raw: lineStr,
        time,
        level,
        levelType,
        tag,
        message,
        isDisconnect,
      });
    }

    return { lines, errors, warnings, disconnects };
  }

  // Render log lines into DOM
  function renderLogs() {
    if (!textarea) return;
    const rawText = textarea.value || textarea.textContent || "";
    const { lines, errors, warnings, disconnects } = parseLogText(rawText);

    countLinesEl.textContent = String(lines.length);
    countErrorsEl.textContent = String(errors);
    countWarningsEl.textContent = String(warnings);
    countDisconnectsEl.textContent = String(disconnects);

    // Build document fragment for performance
    const fragment = document.createDocumentFragment();

    lines.forEach((l) => {
      const lineEl = document.createElement("div");
      lineEl.className = `fluent-log-viewer__line fluent-log-viewer__line--${l.levelType}${l.isDisconnect ? " fluent-log-viewer__line--disconnect" : ""}`;

      const numEl = document.createElement("span");
      numEl.className = "fluent-log-viewer__line-number";
      numEl.textContent = String(l.lineNumber);
      lineEl.appendChild(numEl);

      if (l.time) {
        const timeEl = document.createElement("span");
        timeEl.className = "fluent-log-viewer__line-time";
        timeEl.textContent = formatTimestamp(l.time);
        lineEl.appendChild(timeEl);
      }

      if (l.level) {
        const levelEl = document.createElement("span");
        levelEl.className = `fluent-log-viewer__level fluent-log-viewer__level--${l.levelType}`;
        levelEl.textContent = l.level;
        lineEl.appendChild(levelEl);
      }

      if (l.tag) {
        const tagEl = document.createElement("span");
        tagEl.className = "fluent-log-viewer__tag";
        tagEl.textContent = `${l.tag}:`;
        lineEl.appendChild(tagEl);
      }

      const textEl = document.createElement("span");
      textEl.className = "fluent-log-viewer__text";
      textEl.textContent = l.message;
      lineEl.appendChild(textEl);

      fragment.appendChild(lineEl);
    });

    contentEl.innerHTML = "";
    contentEl.appendChild(fragment);

    if (isAutoScroll) {
      requestAnimationFrame(() => {
        bodyEl.scrollTop = bodyEl.scrollHeight;
      });
    }
  }

  // Initial render
  renderLogs();

  // Reactive observer for value changes on textarea element
  const observer = new MutationObserver(() => {
    renderLogs();
  });
  observer.observe(textarea, { childList: true, characterData: true, subtree: true, attributes: true });

  // Override textarea.value property descriptor to catch programmatic updates from LuCI
  const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (originalValueSetter) {
    Object.defineProperty(textarea, "value", {
      set(val) {
        originalValueSetter.call(this, val);
        renderLogs();
      },
      get() {
        return Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.get?.call(this);
      },
      configurable: true,
    });
  }

  // Listen for input / change events
  textarea.addEventListener("input", renderLogs);
  textarea.addEventListener("change", renderLogs);
}
