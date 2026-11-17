import type { WidgetNode } from "../core/types";

const REFRESH_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.65"/><path d="M13.5 2v2.6h-2.6"/></svg>';
const FULLSCREEN_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>';

export class WidgetFrame {
  readonly element = document.createElement("section");
  readonly header = document.createElement("header");
  readonly body = document.createElement("div");
  readonly status = document.createElement("p");
  private title = document.createElement("h2");
  private badges = document.createElement("div");
  constructor(node: WidgetNode, defaultTitle: string, refresh: () => void, select: () => void) {
    this.element.className = "fluent-dashboard__card";
    this.header.className = "fluent-dashboard__card-header";
    this.header.tabIndex = 0;
    this.title.className = "fluent-dashboard__card-title";
    this.badges.className = "fluent-dashboard__card-badges";
    this.body.className = "fluent-dashboard__card-content";
    this.status.className = "fluent-dashboard__widget-status";
    this.status.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "fluent-dashboard__card-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fluent-dashboard__icon-btn";
    button.title = _("Refresh");
    button.setAttribute("aria-label", _("Refresh"));
    button.innerHTML = REFRESH_SVG;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      refresh();
    });
    const fullscreen = document.createElement("button");
    fullscreen.type = "button";
    fullscreen.className = "fluent-dashboard__icon-btn";
    fullscreen.title = _("Fullscreen");
    fullscreen.setAttribute("aria-label", _("Fullscreen"));
    fullscreen.innerHTML = FULLSCREEN_SVG;
    fullscreen.addEventListener("click", (e) => {
      e.stopPropagation();
      if (document.fullscreenElement === this.element) void document.exitFullscreen().catch(() => {});
      else void this.element.requestFullscreen().catch(() => this.setStatus(_("Fullscreen is unavailable.")));
    });
    actions.append(this.badges, button, fullscreen);
    this.header.append(this.title, actions);
    this.header.addEventListener("click", (e) => {
      if (!(e.target instanceof Element && e.target.closest("button"))) select();
    });
    this.header.addEventListener("keydown", (e) => {
      if (e.target === this.header && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        select();
      }
    });
    this.element.append(this.header, this.status, this.body);
    this.update(node, defaultTitle, false);
  }
  update(node: WidgetNode, defaultTitle: string, editing: boolean): void {
    this.title.textContent = node.title || defaultTitle;
    this.element.classList.toggle("fluent-dashboard__card--locked", Boolean(node.locked));
    this.element.classList.toggle("fluent-dashboard__card--hidden", Boolean(node.hidden));
    this.element.classList.toggle("fluent-dashboard__card--editing", editing);
    this.badges.replaceChildren();
    if (editing && node.locked) {
      const b = document.createElement("span");
      b.className = "fluent-dashboard__badge";
      b.textContent = _("Locked");
      this.badges.append(b);
    }
    if (editing && node.hidden) {
      const b = document.createElement("span");
      b.className = "fluent-dashboard__badge fluent-dashboard__badge--muted";
      b.textContent = _("Hidden");
      this.badges.append(b);
    }
  }
  setStatus(message: string): void {
    this.status.textContent = message;
    this.status.hidden = !message;
  }
}
