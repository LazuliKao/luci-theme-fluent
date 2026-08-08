/**
 * Setup automatic pausing of page refresh/polling when text is selected
 * This helps prevent active user selections from being lost when the UI refreshes
 */
export function setupSelectionPause() {
  let pollPausedBySelection = false;
  const poll = L.poll;

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
      if (!pollPausedBySelection && poll.active()) {
        poll.stop();
        pollPausedBySelection = true;
      }
    } else if (pollPausedBySelection) {
      poll.start();
      pollPausedBySelection = false;
    }
  });
}
