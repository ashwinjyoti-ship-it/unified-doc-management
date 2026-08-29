/**
 * Lightweight regression checks for inline markdown ↔ TipTap HTML.
 * Run: npx tsx web/src/lib/pageLinks.selftest.ts
 */
import { inlineMarkupToHtml, serializeInlineNodes } from './pageLinks';
import { blocksToTiptapHtml, markdownToBlocks } from './markdownBlocks';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const parseCases: Array<[string, string]> = [
  ['hello **bold** there', 'hello <strong>bold</strong> there'],
  ['*italic*', '<em>italic</em>'],
  ['~~strike~~', '<s>strike</s>'],
  ['`code`', '<code>code</code>'],
  ['**_both_**', '<strong><em>both</em></strong>'],
  ['`**not bold**`', '<code>**not bold**</code>'],
  [
    '[**x**](https://ex.com)',
    '<a href="https://ex.com" target="_blank" rel="noopener noreferrer" class="external-link"><strong>x</strong></a>',
  ],
  [
    '<span style="color: #C0392B">**red**</span>',
    '<span style="color: #c0392b"><strong>red</strong></span>',
  ],
];

for (const [input, expected] of parseCases) {
  const got = inlineMarkupToHtml(input);
  assert(got === expected, `PARSE\n in: ${input}\n got: ${got}\n exp: ${expected}`);
}

assert(
  serializeInlineNodes([{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }]) === '**bold**',
  'serialize bold',
);
assert(
  serializeInlineNodes([
    {
      type: 'text',
      text: 'red',
      marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#C0392B' } }],
    },
  ]) === '<span style="color: #c0392b">**red**</span>',
  'serialize color+bold',
);
assert(
  serializeInlineNodes([
    { type: 'text', text: 'both', marks: [{ type: 'bold' }, { type: 'italic' }] },
  ]) === '**_both_**',
  'serialize bold+italic',
);
assert(
  serializeInlineNodes([
    {
      type: 'text',
      text: 'Home',
      marks: [{ type: 'bold' }, { type: 'link', attrs: { href: '/page/abc' } }],
    },
  ]) === '**[[Home|abc]]**',
  'serialize wiki+bold',
);

assert(
  inlineMarkupToHtml('See **[[Home|abc]]** please').includes(
    '<strong><a href="/page/abc" data-page-link="true" class="page-link">Home</a></strong>',
  ),
  'parse bold around wiki',
);

const md =
  'Here is a **quote** with *style* and ~~old~~ and `code`.\n\n<span style="color: #2471A3">Blue line</span>';
const blocks = markdownToBlocks(md);
const html = blocksToTiptapHtml(
  blocks.map((b) => ({ type: b.type, content: JSON.stringify(b.content) })),
);
assert(html.includes('<strong>quote</strong>'), 'agent md bold');
assert(html.includes('<em>style</em>'), 'agent md italic');
assert(html.includes('<s>old</s>'), 'agent md strike');
assert(html.includes('<code>code</code>'), 'agent md code');
assert(html.includes('color: #2471a3'), 'agent md color');

console.log('pageLinks.selftest: all passed');
