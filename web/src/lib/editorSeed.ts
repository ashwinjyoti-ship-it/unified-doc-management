/** One-shot HTML to apply when opening a newly created page from slash commands. */
export function setEditorSeed(pageId: string, html: string) {
  sessionStorage.setItem(`editorSeed:${pageId}`, html);
}

export function consumeEditorSeed(pageId: string): string | null {
  const key = `editorSeed:${pageId}`;
  const html = sessionStorage.getItem(key);
  if (html) sessionStorage.removeItem(key);
  return html;
}
