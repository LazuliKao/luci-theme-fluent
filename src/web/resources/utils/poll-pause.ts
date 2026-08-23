/**
 * Setup automatic pausing of page refresh/polling when text is selected
 * This helps prevent active user selections from being lost when the UI refreshes
 */
export function setupSelectionPause() {
  let pollPausedBySelection = false;
  type PollApi = {
    active?: () => boolean;
    start?: () => boolean;
    stop?: () => boolean;
  };
  type LegacyPollApi = {
    halt?: () => boolean;
    run?: () => boolean;
    running?: () => boolean;
  };

  const poll = L.poll as PollApi | undefined;
  const legacyXhr = typeof XHR === "undefined" ? undefined : (XHR as LegacyPollApi);
  const pollApi = typeof poll?.active === "function" && typeof poll.stop === "function" && typeof poll.start === "function" ? (poll as Required<PollApi>) : null;
  const legacyApi = typeof legacyXhr?.running === "function" && typeof legacyXhr.halt === "function" && typeof legacyXhr.run === "function" ? (legacyXhr as Required<LegacyPollApi>) : null;

  // Some downstream LuCI builds expose an incomplete L.poll API. Do nothing when no complete polling API is available.
  const controller = pollApi
    ? { isActive: () => pollApi.active(), stop: () => pollApi.stop(), start: () => pollApi.start() }
    : legacyApi
      ? { isActive: () => legacyApi.running(), stop: () => legacyApi.halt(), start: () => legacyApi.run() }
      : null;
  if (!controller) return;

  document.addEventListener("selectionchange", () => {
    const selection = document.getSelection();
    let hasSelection = (selection?.toString().trim().length ?? 0) > 0;

    // Input and textarea selections are not represented by document.getSelection().
    if (!hasSelection) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        hasSelection = activeElement.selectionStart !== activeElement.selectionEnd;
      }
    }

    if (hasSelection) {
      if (!pollPausedBySelection && controller.isActive()) {
        pollPausedBySelection = controller.stop();
      }
    } else if (pollPausedBySelection) {
      controller.start();
      pollPausedBySelection = false;
    }
  });
}
