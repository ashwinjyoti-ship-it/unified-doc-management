# End-to-End Test Report — 2026-06-27

## Result

Overall status: **PASS with warnings**.

The application builds successfully, the backend starts against the migrated local D1 database, the frontend dev server serves the SPA, and a broad API-level end-to-end workflow completed **73/73 checks** successfully.

## Environment

- Repository: `unified-doc-management`
- Date: 2026-06-27
- Frontend: Vite dev server on `http://localhost:5173`
- Backend: Wrangler worker on `http://localhost:8787`
- Local secret created: `worker/.dev.vars` with `JWT_SECRET`
- Local D1 migrations applied with `npm run db:migrate:local`

## Checks Run

| Check | Result | Notes |
| --- | --- | --- |
| `npm run build` | PASS | Vite production build completed. Vite warned that one JS chunk is larger than 500 kB. |
| `npm run build:pages-worker` | PASS | Worker bundle built with esbuild. |
| `tsc -p web/tsconfig.json --noEmit` | WARNING | TypeScript reported pre-existing web type errors; build still passes. |
| `npm run db:migrate:local` | PASS | Applied all local D1 migrations through `010_canvas_recovery.sql`. |
| `curl -I http://localhost:5173/` | PASS | Frontend returned HTTP 200 after starting Vite correctly. |
| `curl -s http://localhost:8787/api/health` | PASS | Backend returned `{ "status": "ok", "version": "1.0.0" }`. |
| API E2E script | PASS | 73/73 workflow checks passed. |

## API Workflows Covered

The API E2E script tested these user-visible workflows:

1. Health check.
2. User registration.
3. Login.
4. Current-user session lookup.
5. User preferences read/update.
6. API key creation.
7. Workspace listing.
8. Workspace rename.
9. Page creation.
10. Folder creation.
11. Page listing.
12. Page fetch.
13. Page rename/move/update.
14. Block saving.
15. Markdown export.
16. Markdown import/update.
17. Version history listing.
18. Page duplication.
19. Recent-page tracking.
20. Favorite add/status/list/remove.
21. Tag create/list/attach/list/detach.
22. Search.
23. Database creation.
24. Database schema read.
25. Database property create/update/delete.
26. Database row create/update/delete.
27. Database view create/update/delete.
28. Embedded database creation and resolution.
29. Canvas page creation.
30. Canvas state read.
31. Canvas component add/update/duplicate/delete/reset.
32. Canvas token add/list/update/delete.
33. Comment create/list/update/apply/delete.
34. Agent-instruction comment listing.
35. Notifications list/read-all.
36. Agent catalog retrieval.
37. Offline sync endpoint.
38. Bulk duplicate endpoint.
39. Cleanup page deletion.
40. Logout.

## Warnings / Limitations

- Browser-level automation could not be installed because `npm install playwright@1.56.1` returned HTTP 403 from the npm registry. As a fallback, I performed API-level workflow testing plus HTTP checks for the frontend and backend servers.
- The first frontend launch used the wrong npm argument forwarding and returned HTTP 404 from Vite. Restarting with `npm --workspace=web run dev -- --host 0.0.0.0` fixed it and the frontend returned HTTP 200.
- `tsc -p web/tsconfig.json --noEmit` currently reports type errors in existing source files even though the production build succeeds.
- Wrangler emitted proxy/`Request.cf` warnings in this environment, but the local worker started and served requests successfully.

## Notable Findings

No blocking runtime defects were found in the tested API workflows.

The main follow-up items are quality/maintenance items:

1. Fix existing TypeScript errors so `tsc -p web/tsconfig.json --noEmit` can be used as a clean CI gate.
2. Consider adding a committed E2E test runner so this 73-check workflow can be repeated without ad-hoc scripting.
3. Consider code-splitting the large frontend bundle flagged by Vite.
4. Add browser automation when registry access allows Playwright or an equivalent tool to be installed.
