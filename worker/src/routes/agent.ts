/**
 * Machine-readable API catalog for AI agents and skills.
 * All listed endpoints accept X-API-Key or Authorization: Bearer <token>.
 */
import { Hono } from 'hono';
import type { Env } from '../types';

const agent = new Hono<{ Bindings: Env }>();

const CATALOG = {
  name: 'UnifiedDocs API',
  version: '1.0.0',
  baseUrl: '/api',
  authentication: {
    methods: [
      {
        type: 'api_key',
        header: 'X-API-Key',
        description: 'Create via POST /api/auth/api-keys (requires login once). Preferred for agents.',
      },
      {
        type: 'bearer',
        header: 'Authorization: Bearer <token>',
        description: 'JWT from POST /api/auth/login or /api/auth/register.',
      },
    ],
  },
  databasePropertyTypes: [
    { type: 'text', valueShape: 'string' },
    { type: 'long_text', valueShape: 'string (multiline)' },
    { type: 'number', valueShape: 'number' },
    { type: 'date', valueShape: 'string (YYYY-MM-DD)' },
    { type: 'select', valueShape: 'string', options: 'string[]' },
    { type: 'multi_select', valueShape: 'string[]', options: 'string[]' },
    { type: 'checkbox', valueShape: 'boolean' },
    { type: 'relation', valueShape: 'string[] (row ids)', options: '{ relatedDatabaseId: string }' },
    {
      type: 'rollup',
      valueShape: 'computed (read-only)',
      options: '{ relationPropertyId, targetPropertyId, aggregation: count|count_values|sum|average|min|max|show_unique }',
    },
  ],
  endpoints: [
    { method: 'GET', path: '/api/health', auth: false, description: 'Health check' },
    { method: 'POST', path: '/api/auth/register', auth: false, body: { email: 'string', password: 'string', name: 'string' } },
    { method: 'POST', path: '/api/auth/login', auth: false, body: { email: 'string', password: 'string' } },
    { method: 'POST', path: '/api/auth/logout', auth: true },
    { method: 'GET', path: '/api/auth/me', auth: true, description: 'Current user' },
    { method: 'POST', path: '/api/auth/api-keys', auth: true, body: { name: 'string' }, description: 'Create API key for agent' },
    { method: 'GET', path: '/api/auth/preferences', auth: true },
    { method: 'PATCH', path: '/api/auth/preferences', auth: true, body: { theme: 'light|dark|system' } },

    { method: 'GET', path: '/api/workspaces', auth: true, description: 'List workspaces' },
    { method: 'PATCH', path: '/api/workspaces/:workspaceId', auth: true, body: { name: 'string' } },
    { method: 'GET', path: '/api/workspaces/:workspaceId/pages', auth: true, description: 'List all pages in tree' },
    {
      method: 'POST',
      path: '/api/workspaces/:workspaceId/pages',
      auth: true,
      body: {
        title: 'string?',
        parentId: 'string?',
        type: 'page|folder|database',
        icon: 'string?',
        embedInPageId: 'string? (page id — embed database inline on this page; use with type=database)',
      },
      description: 'Create page, folder, or database. Use embedInPageId with type=database for inline embed.',
    },

    { method: 'GET', path: '/api/pages/:pageId', auth: true, description: 'Get page with blocks and backlinks' },
    {
      method: 'PATCH',
      path: '/api/pages/:pageId',
      auth: true,
      body: { title: 'string?', icon: 'string?', parentId: 'string|null?', visibility: 'private|shared|public' },
    },
    { method: 'DELETE', path: '/api/pages/:pageId', auth: true },
    {
      method: 'PUT',
      path: '/api/pages/:pageId/blocks',
      auth: true,
      body: { blocks: 'Array<{ id?, type, content, orderIndex }>' },
      description: 'Replace all blocks (auto-versioned)',
    },
    { method: 'GET', path: '/api/pages/:pageId/markdown', auth: true },
    { method: 'PUT', path: '/api/pages/:pageId/markdown', auth: true, body: { markdown: 'string' } },
    {
      method: 'POST',
      path: '/api/pages/:pageId/edit-section',
      auth: true,
      body: {
        old_text: 'string (exact substring to replace)',
        new_text: 'string',
        comment_id: 'string? (resolve comment on success)',
        occurrence: 'first|all|number? (default first)',
        require_unique: 'boolean? (409 if old_text matches more than once)',
      },
      description: 'Surgical text replacement — prefer over PUT markdown for agent comment edits',
    },
    { method: 'GET', path: '/api/pages/:pageId/versions', auth: true },
    { method: 'POST', path: '/api/pages/:pageId/restore/:versionId', auth: true },

    { method: 'GET', path: '/api/pages/:pageId/database', auth: true, description: 'Properties, rows, views, relations, rollups' },
    {
      method: 'POST',
      path: '/api/pages/:pageId/database/properties',
      auth: true,
      body: { name: 'string', type: 'see databasePropertyTypes', options: 'varies by type' },
      description: 'Add database column',
    },
    {
      method: 'PATCH',
      path: '/api/pages/:pageId/database/properties/:propId',
      auth: true,
      description: 'Rename column, change type, or update options',
    },
    {
      method: 'DELETE',
      path: '/api/pages/:pageId/database/properties/:propId',
      auth: true,
      description: 'Delete column (cannot delete Name)',
    },
    {
      method: 'POST',
      path: '/api/pages/:pageId/database/rows',
      auth: true,
      body: { properties: 'Record<propId, value>?', title: 'string?' },
      description: 'Add row (creates linked page)',
    },
    {
      method: 'PATCH',
      path: '/api/pages/:pageId/database/rows/:rowId',
      auth: true,
      body: { properties: 'Record<propId, value>?', orderIndex: 'number?' },
    },
    { method: 'DELETE', path: '/api/pages/:pageId/database/rows/:rowId', auth: true },
    {
      method: 'POST',
      path: '/api/pages/:pageId/database/views',
      auth: true,
      body: { name: 'string', viewType: 'table|board|calendar|gallery|list', filters: '[]', sortConfig: '[]' },
    },
    { method: 'PATCH', path: '/api/pages/:pageId/database/views/:viewId', auth: true },
    { method: 'DELETE', path: '/api/pages/:pageId/database/views/:viewId', auth: true },

    { method: 'GET', path: '/api/pages/:pageId/comments', auth: true },
    { method: 'POST', path: '/api/pages/:pageId/comments', auth: true, body: { content: 'string', blockId: 'string?' } },
    { method: 'GET', path: '/api/search?q=', auth: true, description: 'Full-text search' },

    { method: 'GET', path: '/api/notifications', auth: true },
    { method: 'PATCH', path: '/api/notifications/:id/read', auth: true },
    { method: 'POST', path: '/api/notifications/read-all', auth: true },

    { method: 'GET', path: '/api/favorites', auth: true },
    { method: 'GET', path: '/api/recent', auth: true },
    { method: 'POST', path: '/api/pages/:pageId/view', auth: true, description: 'Record page view' },
    { method: 'POST', path: '/api/pages/:pageId/favorite', auth: true },
    { method: 'DELETE', path: '/api/pages/:pageId/favorite', auth: true },
    { method: 'GET', path: '/api/pages/:pageId/favorite', auth: true },
    { method: 'POST', path: '/api/pages/:pageId/duplicate', auth: true },

    {
      method: 'POST',
      path: '/api/bulk',
      auth: true,
      body: { action: 'delete|move', pageIds: 'string[]', parentId: 'string?' },
    },
    { method: 'POST', path: '/api/fetch-url', auth: true, body: { url: 'string' }, description: 'Fetch URL as markdown' },
    {
      method: 'POST',
      path: '/api/import-url',
      auth: true,
      body: { url: 'string', workspaceId: 'string', parentId: 'string?' },
      description: 'Import URL as new page',
    },

    { method: 'GET', path: '/api/workspaces/:workspaceId/tags', auth: true },
    { method: 'POST', path: '/api/workspaces/:workspaceId/tags', auth: true, body: { name: 'string', color: 'string?' } },
    { method: 'GET', path: '/api/pages/:pageId/tags', auth: true },
    { method: 'POST', path: '/api/pages/:pageId/tags', auth: true, body: { tagId: 'string?', name: 'string?', color: 'string?' } },
    { method: 'DELETE', path: '/api/pages/:pageId/tags/:tagId', auth: true },

    { method: 'POST', path: '/api/uploads', auth: true, description: 'multipart file upload' },
    { method: 'GET', path: '/api/uploads/:userId/:filename', auth: false, description: 'Download uploaded file' },
    { method: 'GET', path: '/api/ws/:pageId', auth: false, description: 'WebSocket for realtime collaboration' },
    { method: 'POST', path: '/api/sync', auth: true, description: 'Offline sync queue' },
    { method: 'POST', path: '/api/seed/knowledge-base', auth: true },
    { method: 'POST', path: '/api/seed/migrate-knowledge-base', auth: true },

    { method: 'GET', path: '/api/pages/:pageId/agent-comments', auth: true, description: 'Open AI agent instructions' },
    {
      method: 'POST',
      path: '/api/comments/:id/apply',
      auth: true,
      body: {
        new_text: 'string (replacement for selection_quote)',
        old_text: 'string? (defaults to comment selection_quote)',
        occurrence: 'first|all|number?',
        require_unique: 'boolean?',
        resolve: 'boolean? (default true — mark comment resolved)',
      },
      description: 'Apply agent instruction surgically; uses selection_quote as old_text',
    },
    { method: 'PATCH', path: '/api/comments/:id', auth: true, description: 'Update/resolve comment (status: open|resolved)' },
    { method: 'DELETE', path: '/api/comments/:id', auth: true, description: 'Delete a comment' },

    { method: 'GET', path: '/api/agent/catalog', auth: true, description: 'This catalog' },
  ],
  agentWorkflows: [
    {
      intent: 'Create a task database with tags and done checkboxes',
      steps: [
        'POST /api/workspaces/:id/pages { type: "database", title: "Tasks" }',
        'POST /api/pages/:dbId/database/properties { name: "Tags", type: "multi_select", options: ["Bug","Feature"] }',
        'POST /api/pages/:dbId/database/properties { name: "Done", type: "checkbox" }',
        'POST /api/pages/:dbId/database/rows { title: "My task" }',
        'PATCH /api/pages/:dbId/database/rows/:rowId { properties: { [propId]: true } }',
      ],
    },
    {
      intent: 'Create an inline database embedded on an existing page',
      steps: [
        'POST /api/workspaces/:id/pages { type: "database", title: "Tasks", embedInPageId: "<host-page-id>" }',
        '→ creates database page and appends database_embed block to host page (no navigation)',
        'POST /api/pages/:dbId/database/properties ... (optional columns)',
        'POST /api/pages/:dbId/database/rows { title: "Row 1" }',
      ],
    },
    {
      intent: 'Apply open AI instructions (surgical edit — preferred)',
      steps: [
        'GET /api/pages/:pageId/agent-comments?status=open',
        'For each comment: POST /api/comments/:commentId/apply { "new_text": "<edited selection>" }',
        '→ uses selection_quote as old_text, replaces exactly once, resolves comment',
        'Or: POST /api/pages/:pageId/edit-section { old_text, new_text, comment_id }',
        'Do NOT PUT full markdown for selection-scoped instructions',
      ],
    },
    {
      intent: 'Write content on a page',
      steps: [
        'GET /api/pages/:pageId/markdown',
        'PUT /api/pages/:pageId/markdown { markdown: "..." }',
        'Or PUT /api/pages/:pageId/blocks with block array',
      ],
    },
    {
      intent: 'Find and update a page by search',
      steps: [
        'GET /api/search?q=keyword',
        'PATCH /api/pages/:pageId { title, visibility }',
      ],
    },
  ],
};

agent.get('/agent/catalog', (c) => {
  const url = new URL(c.req.url);
  return c.json({
    ...CATALOG,
    baseUrl: `${url.origin}/api`,
    documentationFile: 'docs/AGENT_API.md',
  });
});

export default agent;
