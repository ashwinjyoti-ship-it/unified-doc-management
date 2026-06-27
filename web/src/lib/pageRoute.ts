/** Parse the active page id from the current URL pathname. */
export function getActivePageIdFromPath(pathname: string): string | null {
  const pageMatch = pathname.match(/^\/page\/([^/?#]+)/);
  if (pageMatch) return pageMatch[1];
  const canvasMatch = pathname.match(/^\/canvas\/([^/?#]+)/);
  return canvasMatch?.[1] ?? null;
}
