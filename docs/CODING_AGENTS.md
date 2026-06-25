# Unified Doc Management — Coding Agent Setup Guide

Give this document (or a link to it) to **Claude Code**, **Codex**, **Cursor agents**, or any HTTP-capable coding agent so it can connect to UDM.

**Download / raw link (always latest on `main`):**

https://raw.githubusercontent.com/ashwinjyoti-ship-it/unified-doc-management/main/docs/CODING_AGENTS.md

**View in GitHub:**

https://github.com/ashwinjyoti-ship-it/unified-doc-management/blob/main/docs/CODING_AGENTS.md

**Full API reference (endpoints, property types, examples):**

https://raw.githubusercontent.com/ashwinjyoti-ship-it/unified-doc-management/main/docs/AGENT_API.md

---

## 1. What you need

| Item | Example |
|------|---------|
| **Base URL** | `https://ash-doc.pages.dev/api` (your deployed app + `/api`) |
| **API key** | `udm_xxxxxxxx…` — create in UDM → **Settings → Generate API Key** |
| **Auth header** | `X-API-Key: udm_your_key_here` |

Local dev: `http://localhost:8787/api` (or `http://localhost:5173/api` via Vite proxy).

### Environment variables (recommended)

```bash
export UDM_API_URL="https://ash-doc.pages.dev/api"
export UDM_API_KEY="udm_your_key_here"
```

Every request:

```bash
curl -s -H "X-API-Key: $UDM_API_KEY" "$UDM_API_URL/workspaces"
```

---

## 2. Can the agent mark comments as addressed?

**Yes.** After the agent applies your edits, it should call:

```http
PATCH /api/comments/{commentId}
X-API-Key: udm_...
Content-Type: application/json

{ "status": "resolved" }
```

This works with the same API key — no browser login required. Resolved comments:

- Disappear from **Needs action** in the UI
- Are **excluded** from `GET /api/pages/{pageId}/agent-comments?status=open`
- Can be reopened by the user (UI) or set back with `{ "status": "open" }`

**Required agent loop:**

1. Fetch open instructions only
2. Apply each edit to the page
3. **PATCH each comment to `resolved`** when done
4. Never skip step 3 — otherwise the same instruction appears every run

---

## 3. Standard agent workflow (AI instructions)

```http
# 1. Discover workspace
GET /api/workspaces

# 2. List pages (find target by title or id)
GET /api/workspaces/{workspaceId}/pages

# 3. Get open AI instructions for a page
GET /api/pages/{pageId}/agent-comments?status=open
```

Response includes per comment:

| Field | Meaning |
|-------|---------|
| `agent_prompt` | **Use this** — selected text + instruction combined |
| `selection_quote` | Exact highlighted text |
| `content` | User's instruction only |
| `selection_meta` | `{ from, to, blockType }` offsets in editor |
| `status` | `open` or `resolved` |
| `open_count` | How many open instructions remain on the page |

```http
# 4. Read page content
GET /api/pages/{pageId}/markdown

# 5. Write changes
PUT /api/pages/{pageId}/markdown
{ "markdown": "..." }

# 6. Mark instruction addressed (REQUIRED)
PATCH /api/comments/{commentId}
{ "status": "resolved" }
```

### Example `agent_prompt`

```
Selected text: "hello world"

Instruction: Add a hyphen between these two words
```

Expected result in the page: `hello-world`

---

## 4. Discovery endpoint

Agents can introspect all endpoints without reading this file:

```http
GET /api/agent/catalog
X-API-Key: udm_...
```

Returns auth info, property types, endpoint list, and example workflows.

---

## 5. Copy-paste: Claude Code / Codex instructions

Add to `CLAUDE.md`, `AGENTS.md`, or a project skill:

```markdown
## Unified Doc Management (UDM)

Connect via REST. Do not use the browser UI.

- Base URL: $UDM_API_URL (e.g. https://ash-doc.pages.dev/api)
- Auth: Header `X-API-Key: $UDM_API_KEY`
- Catalog: GET /agent/catalog

### Startup
1. GET /workspaces → use first workspace id
2. GET /workspaces/{id}/pages → resolve page titles to ids
3. GET /search?q=... when unsure which page

### AI instruction loop (every session)
1. GET /pages/{pageId}/agent-comments?status=open
2. For each comment, read `agent_prompt` (selected text + instruction)
3. GET /pages/{pageId}/markdown → edit → PUT /pages/{pageId}/markdown
4. PATCH /comments/{commentId} { "status": "resolved" } after each fix

### Rules
- Database property values use property UUIDs — GET /pages/{dbId}/database first
- Row stable id: database_rows.id; display title from Name or linked page
- Inbox = pages with parent_id null and type != folder
- Row backing pages (is_row_page) are hidden from sidebar — edit via database row API
- Wikilinks: [[Page Title]] in markdown/blocks

Full API: docs/AGENT_API.md in the UDM repo
```

---

## 6. Copy-paste: Cursor / shell one-liners

```bash
# Health check (no auth)
curl -s "$UDM_API_URL/health"

# List workspaces
curl -s -H "X-API-Key: $UDM_API_KEY" "$UDM_API_URL/workspaces"

# Open agent instructions on a page
curl -s -H "X-API-Key: $UDM_API_KEY" \
  "$UDM_API_URL/pages/PAGE_ID/agent-comments?status=open"

# Mark addressed
curl -s -X PATCH -H "X-API-Key: $UDM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}' \
  "$UDM_API_URL/comments/COMMENT_ID"
```

---

## 7. Creating an API key (one-time)

While logged into UDM in the browser:

1. **Settings** → **Generate API Key**
2. Copy the key immediately (shown once)
3. Store in `$UDM_API_KEY` or your agent secrets

Or via JWT (if you already have a session token):

```http
POST /api/auth/api-keys
Authorization: Bearer <jwt>
{ "name": "Claude Code" }
```

---

## 8. Common operations quick reference

| Goal | Method | Path |
|------|--------|------|
| List pages | GET | `/workspaces/{id}/pages` |
| Read page | GET | `/pages/{id}/markdown` |
| Save page | PUT | `/pages/{id}/markdown` |
| Search | GET | `/search?q=...` |
| Create page | POST | `/workspaces/{id}/pages` |
| Move page | PATCH | `/pages/{id}` `{ "parentId": "..." }` |
| Full database | GET | `/pages/{dbId}/database` |
| Update row | PATCH | `/pages/{dbId}/database/rows/{rowId}` |
| Open AI tasks | GET | `/pages/{id}/agent-comments?status=open` |
| Mark addressed | PATCH | `/comments/{id}` `{ "status": "resolved" }` |
| Delete comment | DELETE | `/comments/{id}` |
| API catalog | GET | `/agent/catalog` |

---

## 9. UDM concepts agents must know

### Row identity
- **Stable ID:** `database_rows.id` (UUID)
- **Display title:** linked page title → **Name** property → `"Untitled"`
- **Property values:** keyed by property UUID in `rows[].properties`, not column name

### Inbox
Root pages (`parent_id === null`, not folders): quick capture, daily notes, unfiled pages.

### AI comments vs discussion
- `comment_type: "agent_instruction"` — tasks for the agent; use `status: open|resolved`
- `comment_type: "discussion"` — human comments; no agent loop required

### Rollups
Read-only; computed on `GET .../database` → `rollupValues[rowId][propId]`.

---

## 10. Error handling

| Code | Meaning |
|------|---------|
| 401 | Invalid or missing API key |
| 403 | No access to workspace/page |
| 404 | Page or comment not found |
| 400 | Bad request — read JSON `error` field |

---

## 11. Is MCP required?

**No.** API key + this doc is enough for Claude Code, Codex, and scripts.

Build an MCP server later if you want native Cursor tools (e.g. `list_open_instructions`, `resolve_comment`) — optional UX improvement, not required for access.

---

## 12. Related files in this repo

| File | Purpose |
|------|---------|
| `docs/CODING_AGENTS.md` | This setup guide |
| `docs/AGENT_API.md` | Full endpoint reference and examples |
| `HOW_TO_USE.md` | Human user guide |
| `GET /api/agent/catalog` | Machine-readable endpoint list |

---

*Unified Doc Management — https://github.com/ashwinjyoti-ship-it/unified-doc-management*
