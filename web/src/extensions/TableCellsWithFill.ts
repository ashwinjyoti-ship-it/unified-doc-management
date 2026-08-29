/**
 * Table cells/headers that persist a background fill colour.
 * TipTap's stock nodes have no backgroundColor attr.
 */
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

const backgroundColorAttr = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => {
      // Prefer our data attr (stable hex). Fall back to style string before
      // element.style.backgroundColor, which browsers normalize to rgb().
      const data = element.getAttribute('data-background-color')?.trim();
      if (data) return data;
      const style = element.getAttribute('style') || '';
      const match = style.match(/background-color\s*:\s*([^;]+)/i);
      if (match?.[1]?.trim()) return match[1].trim();
      const bgcolor = element.getAttribute('bgcolor')?.trim();
      return bgcolor || null;
    },
    renderHTML: (attributes: { backgroundColor?: string | null }) => {
      if (!attributes.backgroundColor) return {};
      return {
        'data-background-color': attributes.backgroundColor,
        style: `background-color: ${attributes.backgroundColor}`,
      };
    },
  },
};

export const TableCellWithFill = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...backgroundColorAttr,
    };
  },
});

export const TableHeaderWithFill = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...backgroundColorAttr,
    };
  },
});
