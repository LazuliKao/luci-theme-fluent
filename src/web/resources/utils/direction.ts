export type DocumentDirection = "ltr" | "rtl";

export type InlineGeometry = {
  readonly inlineStart: number;
  readonly inlineSize: number;
};

function normalizeDocumentDirection(direction: string | null | undefined): DocumentDirection | null {
  if (direction === "rtl" || direction === "ltr") {
    return direction;
  }

  return null;
}

export function getEffectiveDocumentDirection(doc: Document = document): DocumentDirection {
  const documentDirection = normalizeDocumentDirection(doc.documentElement.dir);
  if (documentDirection) {
    return documentDirection;
  }

  const fallbackDirection = normalizeDocumentDirection(doc.body?.dataset.fluentDir);
  return fallbackDirection ?? "ltr";
}

export function getViewportInlineSize(): number {
  return window.innerWidth;
}

export function getRectInlineStart(rect: DOMRect, direction: DocumentDirection, viewportInlineSize: number = getViewportInlineSize()): number {
  return direction === "rtl" ? viewportInlineSize - rect.right : rect.left;
}

export function getPhysicalLeftFromInlineStart(inlineGeometry: InlineGeometry, direction: DocumentDirection, viewportInlineSize: number): number {
  return direction === "rtl" ? viewportInlineSize - inlineGeometry.inlineStart - inlineGeometry.inlineSize : inlineGeometry.inlineStart;
}

export function applyInlineGeometryToStyle(style: CSSStyleDeclaration, inlineGeometry: InlineGeometry): void {
  style.left = "auto";
  style.insetInlineStart = `${inlineGeometry.inlineStart}px`;
  style.width = `${inlineGeometry.inlineSize}px`;
}

export function setInlineCssCustomProperties(
  style: CSSStyleDeclaration,
  inlineGeometry: InlineGeometry,
  direction: DocumentDirection,
  viewportInlineSize: number,
  propertyNames: {
    readonly inlineStart: string;
    readonly inlineSize: string;
  },
): void {
  style.setProperty(propertyNames.inlineStart, `${getPhysicalLeftFromInlineStart(inlineGeometry, direction, viewportInlineSize)}px`);
  style.setProperty(propertyNames.inlineSize, `${inlineGeometry.inlineSize}px`);
}

export function getInlinePadding(style: CSSStyleDeclaration): {
  readonly inlineStart: number;
  readonly inlineEnd: number;
} {
  return {
    inlineStart: Number.parseFloat(style.paddingInlineStart) || 16,
    inlineEnd: Number.parseFloat(style.paddingInlineEnd) || 16,
  };
}
