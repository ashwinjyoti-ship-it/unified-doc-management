/**
 * Regression checks for clipboard table-grid styling helpers.
 * Run: npx tsx web/src/lib/copyClipboard.selftest.ts
 */
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const TABLE_BORDER = '1px solid #c5d0c8';
const TABLE_HEADER_BG = '#f4f1ed';

/** Same decision as styleTablesForExternalPaste for header default background. */
function headerBgCss(existingStyle: string, isHeader: boolean): string {
  const hasBg = /background(-color)?\s*:/i.test(existingStyle);
  return `${isHeader ? 'font-weight:600;' : ''}${isHeader && !hasBg ? `background:${TABLE_HEADER_BG};` : ''}`;
}

assert(
  headerBgCss('', true).includes(`background:${TABLE_HEADER_BG}`),
  'plain header gets default bg',
);
assert(
  !headerBgCss('background-color: #D6EAF8', true).includes(`background:${TABLE_HEADER_BG}`),
  'filled header keeps custom fill',
);
assert(
  !headerBgCss('background-color: #D6EAF8', false).includes('background:'),
  'filled body cell does not get header bg',
);
assert(
  headerBgCss('', false) === '',
  'plain body cell gets no bg rule',
);

const sampleCellStyle = `border:${TABLE_BORDER};padding:6px 8px;vertical-align:top;${headerBgCss('background-color: #D6EAF8', false)}`;
assert(sampleCellStyle.includes('border:1px solid'), 'border applied');
assert(!sampleCellStyle.includes(TABLE_HEADER_BG), 'custom fill not overwritten');

console.log('copyClipboard.selftest: all passed');
