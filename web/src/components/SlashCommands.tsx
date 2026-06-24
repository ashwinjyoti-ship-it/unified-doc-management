import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import SlashCommandList, {
  slashCommands,
  createPageLinkCommand,
  createNewDatabaseCommand,
  createMessagePageCommand,
  type SlashCommandItem,
  type SlashCommandListRef,
} from './SlashCommandList';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      onImageUpload: undefined as ((file: File) => Promise<string>) | undefined,
      onPageLinkRequest: undefined as ((props: { editor: import('@tiptap/react').Editor; range: { from: number; to: number } }) => void) | undefined,
      onNewDatabaseRequest: undefined as ((props: { editor: import('@tiptap/react').Editor; range: { from: number; to: number } }) => void) | undefined,
      onMessagePageRequest: undefined as ((props: { editor: import('@tiptap/react').Editor; range: { from: number; to: number } }) => void) | undefined,
    };
  },

  addProseMirrorPlugins() {
    const onImageUpload = this.options.onImageUpload;
    const onPageLinkRequest = this.options.onPageLinkRequest;
    const onNewDatabaseRequest = this.options.onNewDatabaseRequest;
    const onMessagePageRequest = this.options.onMessagePageRequest;

    let items = onImageUpload
      ? slashCommands.map((item) =>
          item.title === 'Image'
            ? {
                ...item,
                command: ({ editor, range }: { editor: import('@tiptap/react').Editor; range: { from: number; to: number } }) => {
                  editor.chain().focus().deleteRange(range).run();
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    try {
                      const url = await onImageUpload(file);
                      editor.chain().focus().setImage({ src: url }).run();
                    } catch (err) {
                      console.error('Image upload failed:', err);
                    }
                  };
                  input.click();
                },
              }
            : item
        )
      : slashCommands;

    if (onPageLinkRequest) {
      items = [...items, createPageLinkCommand(onPageLinkRequest)];
    }
    if (onNewDatabaseRequest) {
      items = [...items, createNewDatabaseCommand(onNewDatabaseRequest)];
    }
    if (onMessagePageRequest) {
      items = [...items, createMessagePageCommand(onMessagePageRequest)];
    }

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
          props.command({ editor, range });
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
