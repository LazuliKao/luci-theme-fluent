import assert from "node:assert/strict";
import test from "node:test";

import { setupApplyChangePreview } from "./apply-change-preview";

class FakeText {
  constructor(public textContent: string) {}
}

class FakeElement {
  readonly childNodes: (FakeElement | FakeText)[] = [];
  className = "";
  parentNode: FakeElement | null = null;

  constructor(readonly tagName: string) {}

  get children(): FakeElement[] {
    return this.childNodes.filter((child): child is FakeElement => child instanceof FakeElement);
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes.length = 0;
    this.childNodes.push(new FakeText(value));
  }

  appendChild<T extends FakeElement | FakeText>(child: T): T {
    if (child instanceof FakeElement) child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const className = selector.startsWith(".") ? selector.slice(1) : null;
    if (className === null) return [];

    return this.children.flatMap((child) => [...(child.className.split(/\s+/).includes(className) ? [child] : []), ...child.querySelectorAll(selector)]);
  }

  remove(): void {
    if (!this.parentNode) return;

    const index = this.parentNode.childNodes.indexOf(this);
    if (index >= 0) this.parentNode.childNodes.splice(index, 1);
    this.parentNode = null;
  }
}

class FakeDocument {
  activeModal: FakeElement | null = null;

  createElement(tagName: string): HTMLElement {
    return new FakeElement(tagName) as unknown as HTMLElement;
  }

  createTextNode(value: string): Text {
    return new FakeText(value) as unknown as Text;
  }

  querySelector<T extends Element>(selector: string): T | null {
    if (selector === "#modal_overlay") return this.exposeOverlay ? (this.overlay as unknown as T) : null;
    if (selector !== "#modal_overlay .modal.alert-message.notice.spinning") return null;

    const modal = this.activeModal;
    if (!modal) return null;

    const classes = modal.className.split(/\s+/);
    return classes.includes("modal") && classes.includes("alert-message") && classes.includes("notice") && classes.includes("spinning") ? (modal as unknown as T) : null;
  }
}

class FakeMutationObserver {
  static observers: FakeMutationObserver[] = [];

  constructor(private readonly callback: MutationCallback) {}

  observe(): void {
    FakeMutationObserver.observers.push(this);
  }

  disconnect(): void {
    FakeMutationObserver.observers = FakeMutationObserver.observers.filter((observer) => observer !== this);
  }

  static trigger(): void {
    for (const observer of FakeMutationObserver.observers) {
      observer.callback([], observer as unknown as MutationObserver);
    }
  }
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

interface Fixture {
  readonly document: FakeDocument;
  readonly events: string[];
  readonly changesCalls: { checked: boolean | undefined }[];
  readonly changesRequests: Deferred<unknown>[];
  readonly nativeDisplayStatus: (type: string | false | null | undefined) => void;
  readonly statusCalls: { type: string | false | null | undefined }[];
  readonly changeManager: {
    apply: (checked?: boolean) => void;
    displayStatus: (type: string | false | null | undefined) => void;
  };
}

function createFixture(enabled: boolean, cachedChanges: unknown = null): Fixture {
  const document = new FakeDocument();
  const events: string[] = [];
  const changesCalls: { checked: boolean | undefined }[] = [];
  const changesRequests: Deferred<unknown>[] = [];
  const statusCalls: { type: string | false | null | undefined }[] = [];

  const changeManager = {
    changes: cachedChanges,
    apply(checked?: boolean): void {
      events.push("apply");
      changesCalls.push({ checked });
      changeManager.displayStatus("notice spinning");
    },
    displayStatus(type: string | false | null | undefined): void {
      statusCalls.push({ type });
      if (!type) {
        document.activeModal = null;
        return;
      }

      const modal = new FakeElement("div");
      modal.className = `modal alert-message ${type}`;
      const status = new FakeElement("p");
      status.textContent = "Native apply status";
      modal.appendChild(status);
      document.activeModal = modal;
    },
  };

  Object.assign(globalThis, {
    document,
    L: {
      uci: {
        get_first: () => (enabled ? "1" : "0"),
        changes: () => {
          events.push("changes");
          const request = deferred<unknown>();
          changesRequests.push(request);
          return request.promise;
        },
      },
    },
    ui: { changes: changeManager },
  });

  const nativeDisplayStatus = changeManager.displayStatus;
  return { document, events, changesCalls, changesRequests, nativeDisplayStatus, statusCalls, changeManager };
}
function preview(fixture: Fixture): FakeElement | null {
  return fixture.document.activeModal?.querySelector(".fluent-apply-change-preview") ?? null;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("disabled apply preserves the native apply flow without fetching changes", () => {
  const fixture = createFixture(false);
  setupApplyChangePreview();
  const wrappedApply = fixture.changeManager.apply;

  setupApplyChangePreview();
  fixture.changeManager.apply(true);

  assert.equal(fixture.changeManager.apply, wrappedApply);
  assert.deepEqual(fixture.changesCalls, [{ checked: true }]);
  assert.equal(fixture.changesRequests.length, 0);
  assert.deepEqual(fixture.statusCalls, [{ type: "notice spinning" }]);
  assert.equal(preview(fixture), null);
});

test("enabled apply fetches changes without delaying the native status and safely appends them", async () => {
  const fixture = createFixture(true);
  setupApplyChangePreview();

  fixture.changeManager.apply(true);

  assert.deepEqual(fixture.changesCalls, [{ checked: true }]);
  assert.equal(fixture.changesRequests.length, 1);
  assert.deepEqual(fixture.events, ["changes", "apply"]);
  assert.equal(preview(fixture), null);

  fixture.changesRequests[0].resolve({
    system: [
      ["set", "cfg01", "hostname", "router<'safe'"],
      ["remove", "cfg01", "description"],
    ],
  });
  await settle();

  const rendered = preview(fixture);
  assert.ok(rendered);
  assert.equal(rendered.textContent, "# /etc/config/systemuci set system.cfg01.hostname='router<'\"'\"'safe'\"'\"''uci del system.cfg01.description");
  assert.equal(rendered.querySelector("script"), null);
});
test("cached native changes remain visible when apply clears the RPC result", async () => {
  const fixture = createFixture(true, { system: [["set", "cfg01", "hostname", "router"]] });
  setupApplyChangePreview();

  fixture.changeManager.apply();
  assert.equal(preview(fixture)?.textContent, "# /etc/config/systemuci set system.cfg01.hostname='router'");

  fixture.changesRequests[0].resolve({});
  await settle();
  assert.equal(preview(fixture)?.textContent, "# /etc/config/systemuci set system.cfg01.hostname='router'");
});

test("each native countdown render replaces the preview instead of stacking it", async () => {
  const fixture = createFixture(true);
  setupApplyChangePreview();
  fixture.changeManager.apply(false);
  fixture.changesRequests[0].resolve({ system: [["set", "cfg01", "hostname", "router"]] });
  await settle();

  fixture.changeManager.displayStatus("notice spinning");
  fixture.changeManager.displayStatus("notice spinning");

  const modal = fixture.document.activeModal;
  assert.ok(modal);
  assert.equal(modal.querySelectorAll(".fluent-apply-change-preview").length, 1);
  assert.equal(preview(fixture)?.textContent, "# /etc/config/systemuci set system.cfg01.hostname='router'");
});

test("empty, rejected, and non-spinning responses never inject a preview", async () => {
  const emptyFixture = createFixture(true);
  setupApplyChangePreview();
  emptyFixture.changeManager.apply();
  emptyFixture.changesRequests[0].resolve({ system: [] });
  await settle();
  assert.equal(preview(emptyFixture), null);

  const rejectedFixture = createFixture(true);
  setupApplyChangePreview();
  rejectedFixture.changeManager.apply();
  rejectedFixture.changesRequests[0].reject(new Error("ubus unavailable"));
  await settle();
  assert.equal(preview(rejectedFixture), null);

  const warningFixture = createFixture(true);
  setupApplyChangePreview();
  warningFixture.changeManager.apply();
  warningFixture.changeManager.displayStatus("warning");
  warningFixture.changesRequests[0].resolve({ system: [["set", "cfg01", "hostname", "router"]] });
  await settle();
  assert.equal(preview(warningFixture), null);
});

test("closing the native modal discards a resolved preview request", async () => {
  const fixture = createFixture(true);
  setupApplyChangePreview();
  fixture.changeManager.apply();
  fixture.changeManager.displayStatus(false);
  fixture.changesRequests[0].resolve({ system: [["set", "cfg01", "hostname", "router"]] });
  await settle();

  fixture.changeManager.displayStatus("notice spinning");
  assert.equal(preview(fixture), null);
});

test("a later apply supersedes an older unresolved changes request", async () => {
  const fixture = createFixture(true);
  setupApplyChangePreview();
  fixture.changeManager.apply(true);
  fixture.changeManager.apply(false);

  fixture.changesRequests[0].resolve({ old: [["set", "cfg01", "hostname", "stale"]] });
  await settle();
  assert.equal(preview(fixture), null);

  fixture.changesRequests[1].resolve({
    current: [
      ["add", "cfg02", "rule"],
      ["set", "cfg02", "enabled", "1"],
    ],
  });
  await settle();

  assert.equal(preview(fixture)?.textContent, "# /etc/config/currentuci add current rule # =cfg02uci set current.@rule[-1].enabled='1'");
});

test("the document observer injects after a late native spinner creation", async () => {
  const nativeMutationObserver = globalThis.MutationObserver;
  Object.assign(globalThis, { MutationObserver: FakeMutationObserver });

  try {
    const fixture = createFixture(true);
    setupApplyChangePreview();
    fixture.changeManager.apply();
    fixture.document.activeModal = null;
    fixture.changesRequests[0].resolve({ system: [["set", "cfg01", "hostname", "router"]] });
    await settle();

    fixture.nativeDisplayStatus("notice spinning");
    FakeMutationObserver.trigger();
    assert.equal(preview(fixture)?.textContent, "# /etc/config/systemuci set system.cfg01.hostname='router'");
  } finally {
    FakeMutationObserver.observers = [];
    if (nativeMutationObserver === undefined) Reflect.deleteProperty(globalThis, "MutationObserver");
    else Object.assign(globalThis, { MutationObserver: nativeMutationObserver });
  }
});

test("all native UCI record forms render with their documented command syntax", async () => {
  const fixture = createFixture(true);
  setupApplyChangePreview();
  fixture.changeManager.apply();
  fixture.changesRequests[0].resolve({
    network: [
      ["add", "cfg01", "interface"],
      ["set", "cfg01", "interface"],
      ["set", "cfg01", "proto", "static"],
      ["remove", "cfg01"],
      ["remove", "cfg01", "metric"],
      ["order", "cfg02", "1"],
      ["list-add", "cfg02", "dns", "1.1.1.1"],
      ["list-del", "cfg02", "dns", "8.8.8.8"],
      ["rename", "cfg02", "wan"],
      ["rename", "cfg02", "hostname", "router"],
      ["unknown", "cfg03"],
    ],
  });
  await settle();

  assert.equal(
    preview(fixture)?.textContent,
    "# /etc/config/networkuci add network interface # =cfg01uci set network.@interface[-1]=interfaceuci set network.@interface[-1].proto='static'uci del network.@interface[-1]uci del network.@interface[-1].metricuci reorder network.cfg02=1uci add_list network.cfg02.dns='1.1.1.1'uci del_list network.cfg02.dns='8.8.8.8'uci rename network.cfg02=wanuci rename network.cfg02.hostname='router'[\"unknown\",\"cfg03\"]",
  );
});
