# UnifiedDocs Agent API Reference

Use this document to build AI agent skills that control UnifiedDocs via plain-English user requests.

## Authentication

**Recommended for agents:** API key

```http
X-API-Key: udm_xxxxxxxxxxxxxxxx
```

Create a key (one-time, while logged in):

```http
POST /api/auth/api-keys
Authorization: Bearer <user-jwt>
Content-Type: application/json

{ "name": "My Agent" }
```

Response includes `key` — store it securely; it is shown once.

**Alternative:** JWT bearer token from `POST /api/auth/login`.

## Discovery

```http
GET /api/agent/catalog
X-API-Key: <key>
```

Returns machine-readable list of all endpoints, property types, and example workflows.

## Core concepts

| Concept | API representation |
|---------|---------------------|
| Workspace | `GET /api/workspaces` → use first workspace `id` |
| Page | `type: "page"` — rich document with blocks |
| Folder | `type: "folder"` — container in sidebar tree |
| Database | `type: "database"` — table with columns (properties) and rows |
| Canvas | `type: "canvas"` — infinite design canvas with components and tokens |
| Row | Database row; each row has a linked **page** with full editor content |
| Property / Column | `database_properties` — typed columns on a database |
| Block | Structured content unit inside a page |
| Canvas component | A UI element (frame, text, button, etc.) with position, size, styles, and props |
| Design token | Named reusable value (color, spacing, radius, fontSize, fontWeight) |

## Database property types

| Type | Value in `properties` | Options when creating |
|------|----------------------|------------------------|
| `text` | `"string"` | — |
| `number` | `123` | — |
| `date` | `"2026-06-24"` | — |
| `select` | `"Option A"` | `["Option A","Option B"]` |
| `multi_select` | `["Tag1","Tag2"]` | `["Tag1","Tag2","Tag3"]` |
| `checkbox` | `true` / `false` | — |
| `relation` | `["rowId1","rowId2"]` | `{ "relatedDatabaseId": "<db-page-id>" }` |
| `rollup` | computed (read-only) | `{ "relationPropertyId", "targetPropertyId", "aggregation" }` |

Aggregations for rollup: `count`, `count_values`, `sum`, `average`, `min`, `max`, `show_unique`.

## Common agent workflows

### 1. List workspace structure

```http
GET /api/workspaces
GET /api/workspaces/{workspaceId}/pages
```

### 2. Create a page

```http
POST /api/workspaces/{workspaceId}/pages
{ "title": "Meeting notes", "type": "page", "parentId": "{folder-id}", "icon": "📝" }
```

### 3. Read and write page content

```http
GET /api/pages/{pageId}/markdown
PUT /api/pages/{pageId}/markdown
{ "markdown": "# Title\n\nBody text" }
```

Or replace blocks directly:

```http
PUT /api/pages/{pageId}/blocks
{
  "blocks": [
    { "type": "heading1", "content": { "text": "Title", "level": 1 }, "orderIndex": 0 },
    { "type": "paragraph", "content": { "text": "Hello" }, "orderIndex": 1 }
  ]
}
```

### 4. Create a database with custom columns

```http
POST /api/workspaces/{workspaceId}/pages
{ "title": "Tasks", "type": "database" }
→ returns page.id as databaseId

POST /api/pages/{databaseId}/database/properties
{ "name": "Priority", "type": "select", "options": ["High","Medium","Low"] }

POST /api/pages/{databaseId}/database/properties
{ "name": "Tags", "type": "multi_select", "options": ["Bug","Feature","Docs"] }

POST /api/pages/{databaseId}/database/properties
{ "name": "Done", "type": "checkbox" }
```

### 5. Add and update rows

```http
POST /api/pages/{databaseId}/database/rows
{ "title": "Fix login bug" }
→ creates row + linked page

GET /api/pages/{databaseId}/database
→ read property ids from properties[]

PATCH /api/pages/{databaseId}/database/rows/{rowId}
{
  "properties": {
    "{statusPropId}": "In Progress",
    "{tagsPropId}": ["Bug"],
    "{donePropId}": false
  }
}
```

### 6. Search

```http
GET /api/search?q=onboarding
```

### 7. Link databases (relation + rollup)

```http
POST /api/pages/{tasksDbId}/database/properties
{ "name": "Project", "type": "relation", "options": { "relatedDatabaseId": "{projectsDbId}" } }

POST /api/pages/{projectsDbId}/database/properties
{
  "name": "Open tasks",
  "type": "rollup",
  "options": {
    "relationPropertyId": "{relationPropId}",
    "targetPropertyId": "{statusPropId}",
    "aggregation": "count"
  }
}
```

### 8. Saved views with filters

```http
POST /api/pages/{databaseId}/database/views
{
  "name": "Active bugs",
  "viewType": "table",
  "filters": [
    { "propertyId": "{tagsPropId}", "operator": "contains", "value": "Bug" },
    { "propertyId": "{donePropId}", "operator": "eq", "value": "false" }
  ],
  "sortConfig": [{ "propertyId": "{dueDatePropId}", "direction": "asc" }]
}
```

Filter operators: `eq`, `neq`, `contains`, `empty`, `not_empty`.

### 9. Organize pages

```http
PATCH /api/pages/{pageId}
{ "parentId": "{folderId}", "title": "Renamed", "visibility": "shared" }

POST /api/bulk
{ "action": "move", "pageIds": ["id1","id2"], "parentId": "{folderId}" }
```

### 10. Tags, favorites, comments

```http
POST /api/pages/{pageId}/tags
{ "name": "urgent", "color": "#ff0000" }

POST /api/pages/{pageId}/favorite

POST /api/pages/{pageId}/comments
{ "content": "Please review by Friday" }
```

### 11. Import from URL

```http
POST /api/import-url
{ "url": "https://example.com/article", "workspaceId": "{id}", "parentId": "{folderId}" }
```

### 12. Import Word / documents with embedded images (flowcharts)

Use this when copying a **Word document** (`.docx`) or markdown that contains **base64-embedded diagrams** into Tandem. The server extracts text, uploads embedded images (Word flowcharts, SmartArt, pasted diagrams), and creates proper **image blocks**.

**Multipart (recommended for agents with a local file):**

```http
POST /api/import-document
Content-Type: multipart/form-data
X-API-Key: <key>

file: report.docx
workspaceId: {workspace-id}
mode: new          # new | append | overwrite
title: Architecture Overview   # optional, for mode=new
pageId: {page-id}  # required for append/overwrite
```

**JSON with base64 Word file:**

```http
POST /api/import-document
Content-Type: application/json

{
  "format": "docx",
  "base64": "<base64-encoded .docx bytes>",
  "filename": "report.docx",
  "workspaceId": "{workspace-id}",
  "title": "Architecture Overview"
}
```

**JSON with markdown + inline base64 images:**

```http
POST /api/import-document
Content-Type: application/json

{
  "markdown": "# Flow\n\n![signup flow](data:image/png;base64,iVBORw0KGgo...)",
  "workspaceId": "{workspace-id}"
}
```

Response includes `imagesUploaded` (count) and `hint`. Word flowcharts are stored as **images**, not editable diagram objects.

`PUT /api/pages/:id/markdown` also auto-uploads `data:image/...;base64,...` URLs found in markdown.

## Full endpoint index

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (no auth) |
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/api-keys` | Create API key |
| GET/PATCH | `/api/auth/preferences` | Theme preferences |
| GET | `/api/workspaces` | List workspaces |
| PATCH | `/api/workspaces/:id` | Rename workspace |
| GET | `/api/workspaces/:id/pages` | List pages |
| POST | `/api/workspaces/:id/pages` | Create page/folder/database |
| GET | `/api/pages/:id` | Get page + blocks |
| PATCH | `/api/pages/:id` | Update page metadata |
| DELETE | `/api/pages/:id` | Delete page |
| PUT | `/api/pages/:id/blocks` | Save blocks |
| GET/PUT | `/api/pages/:id/markdown` | Markdown export/import |
| GET | `/api/pages/:id/versions` | Version history |
| POST | `/api/pages/:id/restore/:versionId` | Restore version |
| GET | `/api/pages/:id/database` | Full database state |
| POST | `/api/pages/:id/database/properties` | Add column |
| PATCH | `/api/pages/:id/database/properties/:propId` | Rename/change column |
| DELETE | `/api/pages/:id/database/properties/:propId` | Delete column |
| POST | `/api/pages/:id/database/rows` | Add row |
| PATCH | `/api/pages/:id/database/rows/:rowId` | Update row |
| DELETE | `/api/pages/:id/database/rows/:rowId` | Delete row |
| POST/PATCH/DELETE | `/api/pages/:id/database/views/...` | Saved views |
| GET | `/api/pages/:id/markdown` | Read page as markdown |
| PUT | `/api/pages/:id/markdown` | Full page rewrite (avoid for comment edits) |
| POST | `/api/pages/:id/edit-section` | Surgical text replace |
| GET/POST | `/api/pages/:id/comments` | Comments |
| GET | `/api/pages/:id/agent-comments?status=open` | AI agent instructions |
| POST | `/api/comments/:id/apply` | Apply instruction surgically + resolve |
| PATCH | `/api/comments/:id` | Resolve/update comment |
| DELETE | `/api/comments/:id` | Delete comment |
| GET | `/api/search?q=` | Search |
| GET | `/api/notifications` | Notifications |
| GET | `/api/favorites` | Favorites |
| GET | `/api/recent` | Recent pages |
| POST | `/api/pages/:id/duplicate` | Duplicate page |
| POST | `/api/bulk` | Bulk delete/move |
| POST | `/api/fetch-url` | Fetch URL content |
| POST | `/api/import-url` | Import URL as page |
| POST | `/api/import-document` | Import .docx or markdown with base64 images |
| GET/POST | `/api/workspaces/:id/tags` | Workspace tags |
| GET/POST/DELETE | `/api/pages/:id/tags` | Page tags |
| POST | `/api/uploads` | File upload |
| GET | `/api/agent/catalog` | Machine-readable catalog |
| GET | `/api/pages/:id/canvas` | Get canvas components + tokens |
| POST | `/api/pages/:id/canvas/components` | Add component |
| PATCH | `/api/pages/:id/canvas/components/:compId` | Update component (position/size/styles/props) |
| DELETE | `/api/pages/:id/canvas/components/:compId` | Delete component |
| GET | `/api/pages/:id/canvas/tokens` | Get design tokens |
| PUT | `/api/pages/:id/canvas/tokens` | Replace all design tokens |
| POST | `/api/pages/:id/canvas/reset` | Delete all components (tokens preserved) |

## Canvas / Design workflow

### 12. Read a canvas and generate UI code

```http
# Get the full component tree and design tokens
GET /api/pages/{canvasPageId}/canvas
```

Response shape:

```json
{
  "components": [
    {
      "id": "uuid",
      "type": "frame|group|rect|text|button|input|image",
      "name": "Hero",
      "parent_id": null,
      "position": { "x": 0, "y": 0 },
      "size": { "w": 1440, "h": 900 },
      "styles": { "background": "#fff" },
      "props": { "text": "Get started" },
      "variants": {},
      "viewport": null,
      "order_index": 0
    }
  ],
  "tokens": [
    { "id": "uuid", "name": "primary", "type": "color", "value": "#004228" }
  ]
}
```

Use this JSON to generate React / HTML / any framework. Tips:
- `frame` → layout wrapper (`<section>`, `<div>`, etc.)
- `text` → heading or paragraph using `props.text`
- `button` → `<button>` with styles mapped to CSS or Tailwind classes
- `input` → `<input>` with `props.placeholder`
- Design tokens → CSS variables or Tailwind config values

### 13. Apply an agent instruction to a canvas component

```http
# Fetch open design instructions
GET /api/pages/{canvasPageId}/agent-comments?status=open
```

Each item has `anchor_kind: "component"` and an enriched `agent_prompt`:

```
Component: "Button / Primary"

Instruction: Make the border radius 0
```

```http
# Patch the component and resolve the comment in one call
POST /api/comments/{commentId}/apply
Content-Type: application/json

{
  "component_patch": {
    "styles": { "borderRadius": "0px" },
    "props": {}
  }
}
```

`component_patch` deep-merges `styles` and `props`; `position` and `size` are replaced if present.  
The backend saves a `snapshot_before` for diff display, resolves the comment, and broadcasts the update via WebSocket.

### 14. Manage canvas components

```http
# Add a component
POST /api/pages/{canvasPageId}/canvas/components
{
  "type": "button",
  "name": "CTA Button",
  "position": { "x": 100, "y": 200 },
  "size": { "w": 160, "h": 44 },
  "styles": { "background": "#004228", "color": "#fff" },
  "props": { "text": "Get started" }
}

# Move or resize
PATCH /api/pages/{canvasPageId}/canvas/components/{compId}
{ "position": { "x": 200, "y": 300 } }

# Style update
PATCH /api/pages/{canvasPageId}/canvas/components/{compId}
{ "styles": { "borderRadius": "8px" } }

# Delete
DELETE /api/pages/{canvasPageId}/canvas/components/{compId}
```

### 15. Design tokens

```http
GET /api/pages/{canvasPageId}/canvas/tokens

PUT /api/pages/{canvasPageId}/canvas/tokens
{
  "tokens": [
    { "name": "primary", "type": "color", "value": "#004228" },
    { "name": "radius-md", "type": "radius", "value": "8px" }
  ]
}
```

Token types: `color`, `spacing`, `radius`, `fontSize`, `fontWeight`.

---

## Concepts for agents

### Row identity
- **Stable row ID:** `database_rows.id` (UUID) — use in API paths and relation values.
- **Display title:** linked page title → **Name** property → `"Untitled"`.
- **Property values:** keyed by property UUID in `rows[].properties`, not column name.
- Row backing pages have `is_row_page: 1` and are hidden from the sidebar tree.

### Inbox
Pages with `parent_id: null` and `type !== 'folder'` appear in Inbox (Quick Capture, Daily Note, drag to inbox).

### Wikilinks
`[[Page Title]]` in block content creates backlinks when saved. Optional form: `[[Title|page-id]]`.

### Rollups
Read-only computed values on `GET .../database` → `rollupValues[rowId][propId]`. Aggregates linked rows via a relation property.

### AI agent instructions
Users can select text and add `agent_instruction` comments. Fetch open items:

```http
GET /api/pages/{pageId}/agent-comments?status=open
```

Each item includes:
- `content` — the user's instruction (e.g. "Add a hyphen between these two words")
- `selection_quote` — the exact text selected in the editor (e.g. "hello world")
- `selection_meta` — `{ from, to, blockType }` character offsets in the page
- `agent_prompt` — combined string ready for LLM use:

```
Selected text: "hello world"

Instruction: Add a hyphen between these two words
```

**Preferred agent workflow (surgical edit):**

```http
POST /api/comments/{commentId}/apply
{ "new_text": "hello-world" }
```

Uses `selection_quote` as `old_text`. Resolves the comment by default. Returns `open_count`.

```http
POST /api/pages/{pageId}/edit-section
{
  "old_text": "hello world",
  "new_text": "hello-world",
  "comment_id": "{commentId}",
  "occurrence": "first",
  "require_unique": false
}
```

- `404` + `code: "not_found"` — `old_text` not in page (quote may not match markdown; try longer context)
- `409` + `code: "ambiguous"` — multiple matches; use `require_unique: true` or longer `old_text`

Resolve without editing:

```http
PATCH /api/comments/{commentId}
{ "status": "resolved" }
```

**Agent workflow:** Fetch `?status=open`. For each instruction, POST `/apply` with only the edited selection — **never PUT full markdown** for selection-scoped tasks.

Delete a comment:

```http
DELETE /api/comments/{commentId}
```

## Error handling

- `401` — invalid or missing auth
- `403` — no workspace access
- `404` — page/resource not found
- `400` — validation error (check `error` field in JSON body)

## Notes for skill authors

1. Always call `GET /api/workspaces` first to obtain `workspaceId`.
2. Use `GET /api/workspaces/:id/pages` to resolve titles → ids before updates.
3. Database property values are keyed by **property id** (UUID), not name — read them from `GET .../database` first.
4. Row titles sync with linked page titles; editing either updates both.
5. All authenticated endpoints accept `X-API-Key` — no browser session required.
