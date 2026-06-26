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
    return [
      'a',
      {
        ...HTMLAttributes,
        class: isPageLink
          ? 'page-link text-forest underline underline-offset-2 hover:text-dark-teal cursor-pointer'
          : HTMLAttributes.class,
      },
      0,
    ];
  },
});
