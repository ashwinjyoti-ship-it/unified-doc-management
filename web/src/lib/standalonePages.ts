/** Routes that use in-page chrome (Back + title) without the mobile workspace header. */
const STANDALONE_PATHS = new Set(['/settings', '/notifications']);

export function isStandalonePage(pathname: string): boolean {
  return STANDALONE_PATHS.has(pathname);
}
