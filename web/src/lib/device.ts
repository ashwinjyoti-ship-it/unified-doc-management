export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export function closeSidebarOnMobile(setSidebarOpen: (open: boolean) => void) {
  if (isMobileViewport()) setSidebarOpen(false);
}
