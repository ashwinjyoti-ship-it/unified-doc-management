/** API endpoints shown in Settings and referenced by docs. Keep in sync with worker/src/routes/agent.ts */
export const API_ENDPOINT_GROUPS = [
  {
    title: 'Auth & discovery',
    endpoints: [
      'GET /api/health',
      'POST /api/auth/register · login',
      'GET /api/auth/me · preferences',
      'POST /api/auth/api-keys',
      'GET /api/agent/catalog — full machine-readable list',
    ],
  },
  {
    title: 'Workspaces & pages',
    endpoints: [
      'GET /api/workspaces',
      'GET /api/workspaces/:id/pages',
      'POST /api/workspaces/:id/pages — page, folder, database',
      'GET /api/pages/:id — page + blocks',
      'PATCH /api/pages/:id — title, parent, visibility',
      'DELETE /api/pages/:id',
      'PUT /api/pages/:id/blocks',
      'GET · PUT /api/pages/:id/markdown',
      'GET /api/pages/:id/versions',
      'POST /api/pages/:id/restore/:versionId',
      'POST /api/pages/:id/duplicate',
      'POST /api/bulk — delete or move pages',
    ],
  },
  {
    title: 'Database',
    endpoints: [
      'GET /api/pages/:id/database',
      'POST /api/pages/:id/database/properties',
      'PATCH /api/pages/:id/database/properties/:propId',
      'DELETE /api/pages/:id/database/properties/:propId',
      'POST /api/pages/:id/database/rows',
      'PATCH /api/pages/:id/database/rows/:rowId',
      'DELETE /api/pages/:id/database/rows/:rowId',
      'POST · PATCH · DELETE /api/pages/:id/database/views/...',
    ],
  },
  {
    title: 'Comments & AI instructions',
    endpoints: [
      'GET · POST /api/pages/:id/comments',
      'GET /api/pages/:id/agent-comments?status=open',
      'PATCH /api/comments/:id — resolve (status: resolved)',
      'DELETE /api/comments/:id',
    ],
  },
  {
    title: 'Notifications',
    endpoints: [
      'GET /api/notifications',
      'PATCH /api/notifications/:id/read',
      'POST /api/notifications/read-all',
    ],
  },
  {
    title: 'Search, tags, favorites',
    endpoints: [
      'GET /api/search?q=',
      'GET /api/favorites · /api/recent',
      'POST /api/pages/:id/favorite',
      'GET · POST /api/pages/:id/tags',
      'GET · POST /api/workspaces/:id/tags',
    ],
  },
  {
    title: 'Import & files',
    endpoints: [
      'POST /api/fetch-url',
      'POST /api/import-url',
      'POST /api/uploads',
      'GET /api/ws/:pageId — realtime collaboration',
    ],
  },
] as const;
