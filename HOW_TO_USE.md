# How to Use Unified Doc Management

Welcome to **Unified Doc Management** — your all-in-one platform for documents, notes, tasks, and databases. This guide walks you through every feature.

---

## Getting Started

### 1. Create an Account

1. Open the application in your browser.
2. Click **Sign up** on the login screen.
3. Enter your name, email, and password (minimum 6 characters).
4. Click **Create Account**.

You'll land in your personal workspace with a **Getting Started** page already created.

### 2. Navigate the Interface

| Area | Purpose |
|------|---------|
| **Sidebar (left)** | Page tree, search, notifications, settings |
| **Main area** | Page editor or database view |
| **Header bar** | Page title, visibility, collaboration avatars, tools |
| **Quick Capture (mobile)** | Floating ⚡ button for fast notes/tasks |

On mobile, tap the **☰ menu** icon to open the sidebar.

---

## Creating & Editing Pages

### Create a New Page

1. Click **+ Page** in the sidebar.
2. A new "Untitled" page opens — click the title to rename it.
3. Start typing in the editor.

### Create a Folder

1. Create a page, then drag it under another page in the sidebar (or set a parent via API).
2. Change the page icon to 📁 for visual clarity.

### Create a Database

1. Click the **🗃️ database icon** next to **+ Page**.
2. Your database comes with default columns: Name, Status, Due Date.
3. Switch between **Table**, **Board**, **Calendar**, and **List** views using the tabs at the top.

---

## Block Editor

The editor supports rich content blocks. Use the toolbar or keyboard shortcuts:

| Block Type | How to Create |
|------------|---------------|
| **Paragraph** | Just start typing |
| **Heading 1/2/3** | Toolbar buttons or `#`, `##`, `###` in markdown mode |
| **Bullet list** | Toolbar list button |
| **Numbered list** | Toolbar numbered list button |
| **To-do / checkbox** | Toolbar checkbox button |
| **Quote** | Toolbar quote button |
| **Code block** | Toolbar code button |
| **Divider** | Toolbar minus button |
| **Image** | Toolbar image button → paste a URL |
| **Link** | Select text → toolbar link button |

Changes **auto-save** after you stop typing (about 1.5 seconds).

### Markdown Mode

1. Click the **📄 code icon** in the page header.
2. Edit raw Markdown directly.
3. Click the icon again to switch back to the visual editor.

You can also export/import `.md` files via the API (`GET/PUT /api/pages/:id/markdown`).

---

## Databases

Databases are special pages with structured data and multiple views.

### Table View
Spreadsheet-style editing. Click any cell to edit inline.

### Board View (Kanban)
Cards grouped by the **Status** column (To Do → In Progress → Done). Drag cards between columns by changing their status in table view.

### Calendar View
Items with a **Due Date** appear on the calendar grid.

### List View
Compact list showing all rows with their property values.

### Custom Properties

Default properties on new databases:
- **Name** (text)
- **Status** (select: To Do, In Progress, Done)
- **Due Date** (date)

Add more via the API: `POST /api/pages/:id/database/properties`

Supported types: text, number, date, select, multi_select, checkbox, relation, rollup.

### Adding Rows

Click **+ New Row** in any database view.

---

## Collaboration

### Real-Time Editing

When multiple users open the same page:
- **Colored avatars** in the header show who is present.
- Edits sync automatically via WebSocket.
- Comments appear instantly for all viewers.

### Comments

1. Click the **💬 comment icon** in the page header.
2. Type your comment in the panel on the right.
3. Press Enter or click Send.

### Mentions

Mention a teammate using the format `@[Name](user-id)` in comments. They'll receive a notification.

### Page Visibility

Use the visibility dropdown in the header:

| Setting | Meaning |
|---------|---------|
| 🔒 **Private** | Only workspace members |
| 👥 **Shared** | Shared with workspace |
| 🌐 **Public** | Accessible to anyone with the link |

---

## Search

1. Click **Search** in the sidebar (or use the search modal).
2. Type your query — results appear as you type.
3. Click a result to open that page.

Search covers page titles and all block content.

---

## Version History

1. Open any page.
2. Click the **🕐 history icon** in the header.
3. Browse previous versions with author and timestamp.
4. Click **Restore** to revert the page to that version.

A new version is saved automatically each time blocks are updated.

---

## Offline Mode

The app works offline as a Progressive Web App (PWA):

1. **Install** the app via your browser's "Add to Home Screen" option.
2. When offline, the sidebar shows **"Offline — changes will sync"**.
3. Edits are queued locally in IndexedDB.
4. When you reconnect, changes sync automatically.

---

## Mobile Features

### Quick Capture

Tap the **⚡ floating button** (bottom-right) to:
- **Note** — Quick text capture, saved as a new page.
- **Task** — Creates a page with a to-do block.

### Touch Editor

The block toolbar is optimized for touch. Long-press text for the formatting bubble menu.

### Push Notifications

Enable notifications in your device settings after installing the PWA. You'll receive alerts for mentions and comments.

---

## Notifications

Access via **🔔 Notifications** in the sidebar.

You'll be notified for:
- **Mentions** in comments
- **Comments** on your pages
- **Updates** to shared content

Unread notifications have a green left border. Click to mark as read and navigate to the page.

---

## Settings & API

### Settings Page

Navigate to **⚙️ Settings** in the sidebar:

- View your account info
- Generate **API keys** for integrations
- Sign out

### API Access

1. Go to Settings → **Generate API Key**.
2. Copy the key (shown once).
3. Use it in requests: `X-API-Key: udm_your_key_here`

Example — fetch a page:
```bash
curl -H "X-API-Key: udm_your_key" \
  https://your-app.workers.dev/api/pages/PAGE_ID
```

Example — create a page:
```bash
curl -X POST \
  -H "X-API-Key: udm_your_key" \
  -H "Content-Type: application/json" \
  -d '{"title": "API Created Page", "type": "page"}' \
  https://your-app.workers.dev/api/workspaces/WORKSPACE_ID/pages
```

---

## Tips & Shortcuts

| Action | Tip |
|--------|-----|
| Rename a page | Click the title in the header |
| New page fast | Sidebar **+ Page** button |
| New database | Sidebar **🗃️** button |
| Search everything | Sidebar **Search** |
| Markdown editing | Header **code file** icon |
| See who is editing | Look for avatars in the header |
| Go back offline | Install as PWA, works without internet |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Changes not saving | Check the "Saving..." indicator; verify you're online |
| Can't see a page | Check visibility settings and workspace membership |
| Search returns nothing | Wait a moment after saving — FTS index updates on save |
| Real-time not working | Refresh the page; WebSocket reconnects automatically |
| Offline changes lost | Don't clear browser data; sync happens on reconnect |

---

## Need Help?

- Check the [README](./README.md) for development and deployment docs.
- Review the API table in Settings for integration endpoints.
- Report issues at: https://github.com/ashwinjyoti-ship-it/unified-doc-management

---

*Unified Doc Management — One Platform. Every Document. Total Control.*
