/** Shared active-page highlight for sidebar items */
export function pageItemClass(active: boolean, extra = '') {
  return [
    'w-full flex items-center gap-2 rounded-lg text-sm transition-all duration-150',
    active
      ? [
          'bg-forest text-white font-semibold',
          'border-l-[5px] border-sage',
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_2px_10px_rgba(0,66,40,0.4)]',
          'ring-2 ring-forest/50',
          'pl-[calc(0.75rem-5px)]',
        ].join(' ')
      : 'hover:bg-linen text-sage hover:text-forest border-l-[5px] border-transparent pl-3',
    extra,
  ].join(' ');
}

export function pageTreeRowClass(active: boolean) {
  return [
    'w-full flex items-center gap-1 rounded-lg text-sm transition-all duration-150',
    active
      ? [
          'bg-forest text-white font-semibold',
          'border-l-[5px] border-sage',
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_2px_10px_rgba(0,66,40,0.4)]',
          'ring-2 ring-forest/50',
        ].join(' ')
      : 'hover:bg-linen text-sage hover:text-forest border-l-[5px] border-transparent',
  ].join(' ');
}
