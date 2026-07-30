/** Build a paste-ready instruction agents can use to connect to Tandem via REST. */

export function resolveAgentApiBaseUrl(origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  if (!origin) return 'https://ash-doc.pages.dev/api';
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'https://ash-doc.pages.dev/api';
    }
    return `${origin.replace(/\/$/, '')}/api`;
  } catch {
    return 'https://ash-doc.pages.dev/api';
  }
}

export function buildAgentConnectInstructions(apiKey: string, baseUrl = resolveAgentApiBaseUrl()): string {
  return `When the user mentions Tandem, tandem workspace, agent comments, or ash-doc pages, connect to Tandem via REST immediately. This applies on local Cursor, cloud agents, and any machine — no local plugins, skills, or files required.

**Universal connection (always use Shell + curl):**
- Base URL: ${baseUrl}
- Auth: X-API-Key: ${apiKey}
- Catalog: GET /agent/catalog
- Do NOT use the browser UI. Do NOT depend on ~/.cursor paths or local scripts.

**Startup every Tandem session:**
1. GET /workspaces
2. GET /workspaces/{workspaceId}/pages
3. GET /search?q=... when unsure which page

**Every session:**
1. GET /pages/{pageId}/agent-comments?status=open
2. Read agent_prompt for each comment
3. Apply fixes: POST /comments/{commentId}/apply {new_text} (preferred for selections), POST /pages/{pageId}/edit-section {old_text,new_text}, or PUT /pages/{pageId}/markdown {markdown} for full rewrites
4. PATCH /comments/{commentId} {status:resolved} if not auto-resolved

Do NOT PUT full markdown for selection-scoped instructions.`;
}
