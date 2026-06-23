# Deploying to Cloudflare

This guide covers deploying Unified Doc Management to Cloudflare Workers with D1.

## Prerequisites

- Cloudflare account ([sign up free](https://dash.cloudflare.com/sign-up))
- Wrangler CLI authenticated: `npx wrangler login`

## Step 1: Create D1 Database

```bash
cd worker
npx wrangler d1 create unified-doc-db
```

Copy the `database_id` from the output and update `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "unified-doc-db",
    "database_id": "YOUR_DATABASE_ID_HERE",
    "migrations_dir": "migrations"
  }
]
```

## Step 2: Run Migrations

```bash
npm run db:migrate
```

## Step 3: Set Secrets

```bash
cd worker
npx wrangler secret put JWT_SECRET
# Enter a strong random secret when prompted
```

## Step 4: Build & Deploy

From the project root:

```bash
npm run build
npm run deploy
```

This builds the React frontend and deploys the Worker with static assets.

Your app will be available at: `https://unified-doc-management.<your-subdomain>.workers.dev`

## Step 5: Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages → your worker
2. Click **Triggers** → **Custom Domains**
3. Add your domain (must be on Cloudflare)

## Environment Variables

| Variable | Description | Set via |
|----------|-------------|---------|
| `JWT_SECRET` | Token signing secret | `wrangler secret put` |

## Mobile App (Capacitor)

After deploying, build the mobile wrapper:

```bash
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

Update `capacitor.config.json` server URL to your production Workers URL for native builds.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| D1 not found | Verify `database_id` in wrangler.jsonc |
| 401 on all requests | Check JWT_SECRET is set |
| Assets 404 | Run `npm run build` before deploy |
| WebSocket fails | Durable Objects must be deployed (included in wrangler.jsonc) |

## CI/CD with GitHub

Add these secrets to your GitHub repo:
- `CLOUDFLARE_API_TOKEN` — with Workers and D1 permissions
- `CLOUDFLARE_ACCOUNT_ID`

Example GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run db:migrate
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```
