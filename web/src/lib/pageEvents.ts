export const PAGE_IMPORTED_EVENT = 'udm:page-imported';

export function notifyPageImported(pageId: string) {
  window.dispatchEvent(new CustomEvent(PAGE_IMPORTED_EVENT, { detail: { pageId } }));
}
