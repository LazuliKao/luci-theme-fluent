/** Reconcile matching nodes in place. Scroll containers, focused controls and text nodes survive polling. */
export function reconcile(target: Node, next: Node): void {
  if (target.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
    if (target.nodeValue !== next.nodeValue) target.nodeValue = next.nodeValue;
    return;
  }
  if (target instanceof Element && next instanceof Element) {
    for (const attr of Array.from(target.attributes)) if (!next.hasAttribute(attr.name)) target.removeAttribute(attr.name);
    for (const attr of Array.from(next.attributes)) if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
  }
  const children = Array.from(next.childNodes);
  children.forEach((child, i) => {
    const current = target.childNodes[i];
    if (!current) target.appendChild(child.cloneNode(true));
    else if (current.nodeType !== child.nodeType || current.nodeName !== child.nodeName) target.replaceChild(child.cloneNode(true), current);
    else reconcile(current, child);
  });
  while (target.childNodes.length > children.length) target.removeChild(target.lastChild as Node);
}
