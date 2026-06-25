import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DatabaseEmbedView from '../components/DatabaseEmbedView';

export const DatabaseEmbed = Node.create({
  name: 'databaseEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-database-id'),
        renderHTML: (attributes) => ({
          'data-database-id': attributes.databaseId,
        }),
      },
      title: {
        default: 'Database',
        parseHTML: (element) => element.getAttribute('data-title') || 'Database',
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="database-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'database-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseEmbedView);
  },
});
