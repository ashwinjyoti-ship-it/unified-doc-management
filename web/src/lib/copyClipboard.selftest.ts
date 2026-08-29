/**
 * Regression checks for clipboard table-grid styling.
 * Run: npx tsx web/src/lib/copyClipboard.selftest.ts
 *
 * Mirrors sanitizeCopiedHtml's table pass using linkedom (Node has no DOMParser).
 */
import { parseHTML } from 'linkedom';

const TABLE_BORDER = '1px solid #c5d0c8';
const TABLE_HEADER_BG = '#f4f1ed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function appendStyle(el: Element & { getAttribute: (n: string) => string | null; setAttribute: (n: string, v: string) => void }, css: string) {
  const existing = el.getAttribute('style') || '';
  el.setAttribute('style', existing ? `${existing};${css}` : css);
}

function styleTablesForExternalPaste(root: ParentNode) {
  root.querySelectorAll('table').forEach((table) => {
    table.setAttribute('border', '1');
    table.setAttribute('cellpadding', '6');
    table.setAttribute('cellspacing', '0');
    appendStyle(table, `border-collapse:collapse;width:100%;border:${TABLE_BORDER}`);
  });
  root.querySelectorAll('th, td').forEach((cell) => {
    const isHeader = cell.tagName === 'TH';
    appendStyle(
      cell,
      `border:${TABLE_BORDER};padding:6px 8px;vertical-align:top;${
        isHeader ? `background:${TABLE_HEADER_BG};font-weight:600;` : ''
      }`,
    );
  });
}

const rawTable = `
<p>Quote</p>
<table>
  <tbody>
    <tr><th><p>Item</p></th><th><p>Amount</p></th></tr>
    <tr><td><p>SM58</p></td><td><p>₹600</p></td></tr>
  </tbody>
</table>
<p>Thanks</p>
`.trim();

const { document } = parseHTML(`<!doctype html><html><body>${rawTable}</body></html>`);
styleTablesForExternalPaste(document.body);
const out = document.body.innerHTML;

assert(/<table[^>]*border="1"/.test(out), `table border attr: ${out.slice(0, 200)}`);
assert(/border-collapse:\s*collapse/.test(out), 'border-collapse');
assert(/<th[^>]*style="[^"]*border:1px solid/.test(out), 'th inline border');
assert(/<td[^>]*style="[^"]*border:1px solid/.test(out), 'td inline border');
assert(out.includes('SM58'), 'cell text kept');
assert(out.includes('Thanks'), 'after-table text kept');

console.log('copyClipboard.selftest: all passed');
