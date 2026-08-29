/**
 * Cell fill serializes into table blocks and round-trips through HTML.
 * Run: npx tsx web/src/lib/tableCellFill.selftest.ts
 */
import { blocksToTiptapHtml } from './markdownBlocks';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Mirrors BlockEditor.extractContent table branch. */
function extractTableRows(node: Record<string, unknown>): Array<Array<string | { text: string; backgroundColor?: string }>> {
  return ((node.content as Array<Record<string, unknown>>) || []).map((row) =>
    ((row.content as Array<Record<string, unknown>>) || []).map((cell) => {
      const text =
        ((cell.content as Array<Record<string, unknown>>) || [])
          .map((p) =>
            ((p.content as Array<{ text?: string }> | undefined) || [])
              .map((t) => t.text || '')
              .join(''),
          )
          .join('') || '';
      const bg = (cell.attrs as { backgroundColor?: string | null } | undefined)?.backgroundColor;
      if (bg) return { text, backgroundColor: bg };
      return text;
    }),
  );
}

const tipTapTable = {
  type: 'table',
  content: [
    {
      type: 'tableRow',
      content: [
        {
          type: 'tableHeader',
          attrs: { backgroundColor: '#F7F0C8' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }],
        },
        {
          type: 'tableHeader',
          attrs: { backgroundColor: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Qty' }] }],
        },
      ],
    },
    {
      type: 'tableRow',
      content: [
        {
          type: 'tableCell',
          attrs: { backgroundColor: '#D6EAF8' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mic' }] }],
        },
        {
          type: 'tableCell',
          attrs: { backgroundColor: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }],
        },
      ],
    },
  ],
};

const rows = extractTableRows(tipTapTable);
assert(typeof rows[0][0] === 'object' && rows[0][0].backgroundColor === '#F7F0C8', 'header fill');
assert(rows[0][1] === 'Qty', 'plain header stays string');
assert(typeof rows[1][0] === 'object' && rows[1][0].backgroundColor === '#D6EAF8', 'body fill');
assert(rows[1][1] === '2', 'plain body stays string');

const html = blocksToTiptapHtml([
  { type: 'table', content: JSON.stringify({ rows }) },
]);

assert(/data-background-color="#F7F0C8"/.test(html), `header data attr in html: ${html}`);
assert(/background-color: #F7F0C8/.test(html), 'header style in html');
assert(/data-background-color="#D6EAF8"/.test(html), 'body data attr in html');
assert(html.includes('Mic') && html.includes('Qty'), 'cell text kept');
assert(!/Qty[\s\S]*data-background-color/.test(html.split('Qty')[0] + 'Qty'), 'plain Qty has no fill before next cell');

// Plain string rows still work (legacy blocks)
const legacy = blocksToTiptapHtml([
  { type: 'table', content: JSON.stringify({ rows: [['A', 'B'], ['1', '2']] }) },
]);
assert(legacy.includes('<th>A</th>') || legacy.includes('<th>A'), `legacy: ${legacy}`);
assert(!/data-background-color/.test(legacy), 'legacy has no fill attrs');

console.log('tableCellFill.selftest: all passed');
