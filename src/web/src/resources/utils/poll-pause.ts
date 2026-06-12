/**
 * Setup automatic pausing of page refresh/polling when text is selected
 * This helps prevent active user selections from being lost when the UI refreshes
 */
export function setupSelectionPause() {
  let pollPausedBySelection = false;

  const isPollActive = () => {
    if (typeof L?.poll?.active === "function") {
      return L.poll.active();
    }

    if (typeof XHR?.running === "function") {
      return XHR.running();
    }
    return false;
  };

  const stopPoll = () => {
    if (typeof L?.poll?.stop === "function") {
      L.poll.stop();
    } else if (typeof XHR?.halt === "function") {
      XHR.halt();
    }
  };

  const startPoll = () => {
    if (typeof L?.poll?.start === "function") {
      L.poll.start();
    } else if (typeof XHR?.run === "function") {
      XHR.run();
    }
  };

  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection();
    let hasSelection = selection && selection.toString().trim() !== "";

    // Fallback: check if selection is inside an input or textarea
    if (!hasSelection) {
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (typeof activeEl.selectionStart === "number" && typeof activeEl.selectionEnd === "number") {
          hasSelection = activeEl.selectionStart !== activeEl.selectionEnd;
        }
      }
    }

    if (hasSelection) {
      if (!pollPausedBySelection && isPollActive()) {
        stopPoll();
        pollPausedBySelection = true;
      }
    } else {
      if (pollPausedBySelection) {
        startPoll();
        pollPausedBySelection = false;
      }
    }
  });
}
