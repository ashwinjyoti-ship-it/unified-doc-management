/**
 * Host mode.
 *
 * Tandem can be embedded by a host application that wants Tandem to sit inside
 * its own visual language. The host declares itself once with `?host=poppin`;
 * Tandem remembers it for the session so the flag survives client-side
 * navigation, and applies a `host-<name>` class to `<html>`.
 *
 * This only remaps visual variables. Tandem's information architecture,
 * routing and behaviour are unchanged, and standalone Tandem is unaffected.
 */

export type HostMode = 'standalone' | 'poppin';

const HOST_STORAGE_KEY = 'udm.host';
const SUPPORTED_HOSTS: readonly HostMode[] = ['poppin'];

export function detectHostMode(search = window.location.search): HostMode {
  const requested = new URLSearchParams(search).get('host');
  if (requested && SUPPORTED_HOSTS.includes(requested as HostMode)) {
    try {
      sessionStorage.setItem(HOST_STORAGE_KEY, requested);
    } catch {
      // Private mode or a blocked storage partition: the class still applies
      // for this document, it just will not survive a full reload.
    }
    return requested as HostMode;
  }
  try {
    const remembered = sessionStorage.getItem(HOST_STORAGE_KEY);
    if (remembered && SUPPORTED_HOSTS.includes(remembered as HostMode)) return remembered as HostMode;
  } catch {
    // ignore
  }
  return 'standalone';
}

export function applyHostMode(mode: HostMode = detectHostMode()): HostMode {
  const root = document.documentElement;
  for (const host of SUPPORTED_HOSTS) root.classList.toggle(`host-${host}`, host === mode);
  return mode;
}
