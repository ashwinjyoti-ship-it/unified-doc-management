import Link from '@tiptap/extension-link';

export const PageLink = Link.extend({
  name: 'link',

  addAttributes() {
    return {
      ...this.parent?.(),
      'data-page-link': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-page-link'),
        renderHTML: (attributes) => (
          attributes['data-page-link'] ? { 'data-page-link': attributes['data-page-link'] } : {}
        ),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const isPageLink = HTMLAttributes.href?.startsWith('/page/') || HTMLAttributes['data-page-link'];
    const isExternal = HTMLAttributes.href?.startsWith('http://') || HTMLAttributes.href?.startsWith('https://');
    return [
      'a',
      {
        ...HTMLAttributes,
        ...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        class: isPageLink
          ? 'page-link text-forest underline underline-offset-2 hover:text-dark-teal cursor-pointer'
          : isExternal
            ? 'external-link text-forest underline underline-offset-2 hover:text-dark-teal cursor-pointer'
            : HTMLAttributes.class,
      },
      0,
    ];
  },
});
