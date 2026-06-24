/** Shared active-page highlight for sidebar items */
export function pageItemClass(active: boolean, extra = '') {
  return [
    'w-full flex items-center gap-2 rounded-lg text-sm transition-all duration-150',
    active
      ? [
          'bg-forest text-white font-bold',
          'border-l-4 border-sage',
          'shadow-[0_2px_8px_rgba(0,66,40,0.35)]',
          'ring-2 ring-forest/40 ring-inset',
          'pl-[calc(0.75rem-4px)]',
        ].join(' ')
      : 'hover:bg-linen text-charcoal border-l-4 border-transparent pl-3',
    extra,
  ].join(' ');
}

export function pageTreeRowClass(active: boolean) {
  return [
    'w-full flex items-center gap-1 rounded-lg text-sm transition-all duration-150',
    active
      ? [
          'bg-forest text-white font-bold',
          'border-l-4 border-sage',
          'shadow-[0_2px_8px_rgba(0,66,40,0.35)]',
          'ring-2 ring-forest/40 ring-inset',
        ].join(' ')
      : 'hover:bg-linen text-charcoal border-l-4 border-transparent',
  ].join(' ');
}
