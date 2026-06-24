import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import SlashCommandList, { slashCommands, type SlashCommandItem, type SlashCommandListRef } from './SlashCommandList';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      onImageUpload: undefined as ((file: File) => Promise<string>) | undefined,
      onSlashItemSelected: undefined as ((props: {
        editor: import('@tiptap/react').Editor;
        range: { from: number; to: number };
        item: SlashCommandItem;
      }) => void) | undefined,
    };
  },

  addProseMirrorPlugins() {
    const onSlashItemSelected = this.options.onSlashItemSelected;

    const items = slashCommands;

    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,

        items: ({ query }: { query: string }) =>
          items.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
          ),

        command: ({ editor, range, props }: { editor: import('@tiptap/react').Editor; range: { from: number; to: number }; props: SlashCommandItem }) => {
          if (onSlashItemSelected) {
            onSlashItemSelected({ editor, range, item: props });
            return;
          }
          props.command?.({ editor, range });
        },

        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: props.items,
                  command: (item: SlashCommandItem) => props.command(item),
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                zIndex: 100000,
                touch: true,
                maxWidth: 'calc(100vw - 1rem)',
                popperOptions: {
                  strategy: 'fixed',
                  modifiers: [{ name: 'preventOverflow', options: { padding: 8 } }],
                },
              });
            },

            onUpdate(props: SuggestionProps<SlashCommandItem>) {
              component?.updateProps({
                items: props.items,
                command: (item: SlashCommandItem) => props.command(item),
              });
              if (popup?.[0] && props.clientRect) {
                popup[0].setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              }
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
