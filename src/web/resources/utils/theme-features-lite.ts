/** Core accessibility and color-mode behavior retained by the lite build. */
export function setupThemeFeatures(): void {
  const body = document.body;
  if (!body || body.dataset.fluentLiteFeaturesInitialized) return;
  body.dataset.fluentLiteFeaturesInitialized = "true";

  const prefersReducedMotion = body.getAttribute("data-prefers-reduced-motion") === "1";
  const updateReducedMotion = (matches: boolean) => body.setAttribute("data-reduce-motion", prefersReducedMotion && matches ? "true" : "false");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  updateReducedMotion(reducedMotion.matches);
  if (prefersReducedMotion) reducedMotion.addEventListener("change", (event) => updateReducedMotion(event.matches));

  const toggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  if (!toggle) return;

  const getTheme = (mode: string): string => (mode === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode);
  const updateToggle = (mode: string): void => {
    const theme = getTheme(mode);
    document.documentElement.setAttribute("data-theme", theme);
    toggle.setAttribute("data-active-theme", theme);
    toggle.setAttribute("data-mode", mode);
  };
  const saveMode = L.rpc.declare<{ result: number }, [string]>({ object: "luci.fluent", method: "set_mode", params: ["mode"] });

  toggle.hidden = false;
  updateToggle(body.getAttribute("data-theme-mode") || "auto");
  requestAnimationFrame(() => toggle.classList.add("visible"));
  toggle.addEventListener("click", async () => {
    if (toggle.disabled) return;
    const current = body.getAttribute("data-theme-mode") || "auto";
    const next = current === "dark" ? "light" : current === "light" ? "auto" : "dark";
    toggle.disabled = true;
    updateToggle(next);
    try {
      const response = await saveMode(next);
      if (response?.result !== 0) throw new Error(_("Failed to save theme mode."));
      body.setAttribute("data-theme-mode", next);
    } catch (error) {
      updateToggle(current);
      L.ui.addNotification(null, String(error), "error");
    } finally {
      toggle.disabled = false;
    }
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const mode = body.getAttribute("data-theme-mode") || "auto";
    if (mode === "auto") updateToggle(mode);
  });
}
