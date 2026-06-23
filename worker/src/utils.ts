const encoder = new TextEncoder();

export function generateId(): string {
  return crypto.randomUUID();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const computed = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

export async function createToken(userId: string, sessionId: string, secret: string): Promise<string> {
  const payload = btoa(JSON.stringify({ userId, sessionId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string, secret: string): Promise<{ userId: string; sessionId: string } | null> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = await sign(payload, secret);
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(atob(payload));
    if (data.exp < Date.now()) return null;
    return { userId: data.userId, sessionId: data.sessionId };
  } catch {
    return null;
  }
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashApiKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function blocksToMarkdown(blocks: Array<{ type: string; content: string }>): string {
  return blocks
    .map((block) => {
      const content = JSON.parse(block.content || '{}');
      switch (block.type) {
        case 'heading1':
          return `# ${content.text || ''}`;
        case 'heading2':
          return `## ${content.text || ''}`;
        case 'heading3':
          return `### ${content.text || ''}`;
        case 'bulletList':
          return (content.items || []).map((i: string) => `- ${i}`).join('\n');
        case 'numberedList':
          return (content.items || []).map((i: string, idx: number) => `${idx + 1}. ${i}`).join('\n');
        case 'todo':
          return `- [${content.checked ? 'x' : ' '}] ${content.text || ''}`;
        case 'code':
          return `\`\`\`${content.language || ''}\n${content.code || ''}\n\`\`\``;
        case 'quote':
          return `> ${content.text || ''}`;
        case 'divider':
          return '---';
        case 'table':
          if (!content.rows?.length) return '';
          const header = content.rows[0]?.join(' | ') || '';
          const sep = content.rows[0]?.map(() => '---').join(' | ') || '';
          const body = content.rows.slice(1).map((r: string[]) => r.join(' | ')).join('\n');
          return `${header}\n${sep}\n${body}`;
        case 'image':
          return `![${content.alt || ''}](${content.url || ''})`;
        case 'embed':
          return `[${content.title || 'Embed'}](${content.url || ''})`;
        default:
          return content.text || '';
      }
    })
    .join('\n\n');
}

export function markdownToBlocks(md: string): Array<{ type: string; content: object }> {
  const lines = md.split('\n');
  const blocks: Array<{ type: string; content: object }> = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading1', content: { text: line.slice(2) } });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'heading2', content: { text: line.slice(3) } });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'heading3', content: { text: line.slice(4) } });
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      blocks.push({
        type: 'todo',
        content: { text: line.slice(6), checked: line.startsWith('- [x]') },
      });
    } else if (line.startsWith('- ')) {
      const items = [line.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) {
        i++;
        items.push(lines[i].slice(2));
      }
      blocks.push({ type: 'bulletList', content: { items } });
    } else if (/^\d+\. /.test(line)) {
      const items = [line.replace(/^\d+\. /, '')];
      while (i + 1 < lines.length && /^\d+\. /.test(lines[i + 1])) {
        i++;
        items.push(lines[i].replace(/^\d+\. /, ''));
      }
      blocks.push({ type: 'numberedList', content: { items } });
    } else if (line.startsWith('```')) {
      const lang = line.slice(3);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', content: { language: lang, code: codeLines.join('\n') } });
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', content: { text: line.slice(2) } });
    } else if (line === '---') {
      blocks.push({ type: 'divider', content: {} });
    } else if (line.trim()) {
      blocks.push({ type: 'paragraph', content: { text: line } });
    }
    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', content: { text: '' } });
  }

  return blocks;
}
