# Unified Doc Management

A cross-platform productivity application for creating, organizing, and collaborating on structured and unstructured content. Built with React, Cloudflare Workers, and D1.

## Features

- **Block-based editor** — Rich text, headings, lists, to-do, code blocks, images, embeds
- **Markdown support** — View and edit pages as `.md` files
- **Real-time collaboration** — Multi-user editing via WebSockets (Durable Objects)
- **Hierarchical pages** — Folders, sub-pages, and backlinks
- **Databases** — Table, board (kanban), calendar, and list views with custom properties
- **Full-text search** — Search across all content
- **Offline support** — Auto-sync when back online (PWA + IndexedDB)
- **Auth & permissions** — Private, shared, and public pages
- **Notifications** — Mentions, comments, and updates
- **Version history** — Restore previous page versions
- **API access** — REST API with API key authentication
- **Mobile** — Touch-optimized editor, quick capture, PWA installable

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)

### Local Development

```bash
# Install dependencies
npm install

# Run D1 migrations locally
npm run db:migrate:local

# Start dev servers (frontend + worker)
npm run dev
```

- **Web app**: http://localhost:5173
- **API/Worker**: http://localhost:8787

The Vite dev server proxies `/api` requests to the Worker.

### Build & Deploy to Cloudflare

```bash
# Build frontend and worker
npm run build

# Create D1 database (first time only)
wrangler d1 create unified-doc-db
# Update database_id in worker/wrangler.jsonc with the returned ID

# Run migrations on remote D1
npm run db:migrate

# Set production JWT secret
wrangler secret put JWT_SECRET

# Deploy
npm run deploy
```

## Project Structure

```
├── web/                  # React frontend (Vite + Tailwind + TipTap)
│   └── src/
│       ├── components/   # UI components
│       ├── lib/          # API client, store, offline sync
│       └── hooks/        # Collaboration hooks
├── worker/               # Cloudflare Worker backend
│   ├── src/
│   │   ├── routes/       # API routes
│   │   └── collab-room.ts # Durable Object for real-time
│   └── migrations/       # D1 SQL migrations
└── Design/               # Deep Forest design system
```

## Design System

The UI follows the **Deep Forest** design system with:
- Primary: `#004228` (Deep Forest green)
- Background: Warm off-white gradient
- Typography: Poppins
- Rounded corners, soft shadows, professional SaaS aesthetic

See `Design/deep_forest_ Design System.pdf` for full specifications.

## API Documentation

All API endpoints require authentication via `Authorization: Bearer <token>` or `X-API-Key: <key>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/workspaces` | List workspaces |
| GET | `/api/workspaces/:id/pages` | List pages |
| POST | `/api/workspaces/:id/pages` | Create page |
| GET | `/api/pages/:id` | Get page with blocks |
| PUT | `/api/pages/:id/blocks` | Save blocks |
| GET | `/api/pages/:id/markdown` | Export as markdown |
| PUT | `/api/pages/:id/markdown` | Import markdown |
| GET | `/api/pages/:id/versions` | Version history |
| POST | `/api/pages/:id/restore/:versionId` | Restore version |
| GET | `/api/pages/:id/database` | Get database |
| GET | `/api/search?q=` | Full-text search |
| GET | `/api/ws/:pageId` | WebSocket for real-time |

## License

MIT
