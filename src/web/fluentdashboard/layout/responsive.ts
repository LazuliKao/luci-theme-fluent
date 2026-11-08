export function columnsForWidth(width: number): 12 | 6 | 2 {
  return width >= 992 ? 12 : width >= 576 ? 6 : 2;
}
export function observeColumns(element: HTMLElement, listener: (columns: 12 | 6 | 2) => void): () => void {
  let previous = 0;
  const observer = new ResizeObserver(([entry]) => {
    const columns = columnsForWidth(entry.contentRect.width);
    if (columns !== previous) {
      previous = columns;
      listener(columns);
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
}
