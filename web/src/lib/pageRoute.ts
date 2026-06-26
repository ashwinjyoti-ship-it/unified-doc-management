/** Parse the active page id from the current URL pathname. */
export function getActivePageIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/page\/([^/?#]+)/);
  return match?.[1] ?? null;
}
