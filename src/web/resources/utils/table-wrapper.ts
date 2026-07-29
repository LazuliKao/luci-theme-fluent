const TABLE_SELECTOR = "table.table, table.cbi-section-table, div.table, div.cbi-section-table";

function wrapTable(table: HTMLElement): void {
  const parent = table.parentElement;

  if (!parent || parent.classList.contains("table-wrapper")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";
  parent.insertBefore(wrapper, table);
  wrapper.append(table);
}

function wrapTables(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(TABLE_SELECTOR)) {
    wrapTable(root);
  }

  root.querySelectorAll<HTMLElement>(TABLE_SELECTOR).forEach((table) => {
    wrapTable(table);
  });
}

export function setupTableWrappers(): void {
  if (!document.body) {
    return;
  }

  wrapTables(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          wrapTables(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
