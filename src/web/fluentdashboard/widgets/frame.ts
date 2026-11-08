import type { WidgetNode } from "../core/types";

export class WidgetFrame {
  readonly element = document.createElement("section");
  readonly header = document.createElement("header");
  readonly body = document.createElement("div");
  readonly status = document.createElement("p");
  private title = document.createElement("h2");
  constructor(node: WidgetNode, defaultTitle: string, refresh: () => void, select: () => void) {
    this.element.className = "fluent-dashboard__card";
    this.header.className = "fluent-dashboard__card-header";
    this.header.tabIndex = 0;
    this.title.className = "fluent-dashboard__card-title";
    this.body.className = "fluent-dashboard__card-content";
    this.status.className = "fluent-dashboard__widget-status";
    this.status.setAttribute("role", "status");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = _("Refresh");
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      refresh();
    });
    const fullscreen = document.createElement("button");
    fullscreen.type = "button";
    fullscreen.textContent = _("Fullscreen");
    fullscreen.addEventListener("click", (e) => {
      e.stopPropagation();
      if (document.fullscreenElement === this.element) void document.exitFullscreen().catch(() => {});
      else void this.element.requestFullscreen().catch(() => this.setStatus(_("Fullscreen is unavailable.")));
    });
    this.header.append(this.title, button, fullscreen);
    this.header.addEventListener("click", (e) => {
      if (!(e.target instanceof HTMLButtonElement)) select();
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
  }
  setStatus(message: string): void {
    this.status.textContent = message;
    this.status.hidden = !message;
  }
}
