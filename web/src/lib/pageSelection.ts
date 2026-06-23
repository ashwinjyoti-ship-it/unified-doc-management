/** Shared active-page highlight for sidebar items */
export function pageItemClass(active: boolean, extra = '') {
  return [
    'w-full flex items-center gap-2 rounded-lg text-sm transition-all duration-150',
    active
      ? 'bg-forest/15 text-forest font-semibold border-l-[3px] border-forest shadow-[inset_0_0_0_1px_rgba(0,66,40,0.1)] pl-[calc(0.75rem-3px)]'
      : 'hover:bg-linen text-charcoal border-l-[3px] border-transparent pl-3',
    extra,
  ].join(' ');
}

export function pageTreeRowClass(active: boolean) {
  return [
    'w-full flex items-center gap-1 rounded-lg text-sm transition-all duration-150',
    active
      ? 'bg-forest/15 text-forest font-semibold border-l-[3px] border-forest shadow-[inset_0_0_0_1px_rgba(0,66,40,0.1)]'
      : 'hover:bg-linen text-charcoal border-l-[3px] border-transparent',
  ].join(' ');
}
