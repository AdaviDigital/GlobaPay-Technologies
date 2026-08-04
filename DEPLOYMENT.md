# Deployment guide

A practical, in-order runbook for getting GlobaPay live. Read this together
with **SECURITY.md** — nothing here changes what's flagged there (uploads
storage, KYC/AML mocks, the NestJS v11 CVE, etc.).

**Recommended combo:** Vercel (frontend) + Render *or* Railway (backend +
Postgres + Redis). Google Cloud is covered as a third option — it's more
setup work (no single "deploy from Dockerfile" button the way Render/Railway
have) but it's what you'd reach for if you're already on GCP or need Cloud
Run's autoscaling.

Do the steps in this order — the backend needs to exist before the frontend
can point at it, and the frontend's URL needs to exist before you lock down
the backend's CORS.

---

## 0. Prerequisites

- Push this repo to GitHub (or GitLab/Bitbucket) — every platform below
  deploys from a git repo, not a zip upload.
- Generate two secrets now, you'll need them in step 2:
  ```bash
  openssl rand -hex 32   # JWT_ACCESS_SECRET
  openssl rand -hex 32   # JWT_REFRESH_SECRET — must be a DIFFERENT value
  ```
  The backend refuses to boot without both (see `validate-env.ts`) — this
  isn't optional.
- Decide on SMTP now if you want real users to receive OTP codes and
  password-reset emails. Without it, those are only logged to the backend's
  console — fine for testing, not for anyone but you. Any standard SMTP
  provider works (Postmark, SES, Mailgun, Resend's SMTP endpoint, etc.).

---

## 1. Provision Postgres + Redis

Both the backend's database and its BullMQ queues (transfer settlement,
crypto price ticks, P2P auto-refunds) need to exist before the app boots.

- **Render**: `render.yaml` already declares a `globapay-postgres` database
  and a `globapay-redis` service — Render provisions both automatically when
  you deploy via that blueprint (step 2A). Nothing to do here separately.
- **Railway**: from your project, "New" → "Database" → add both **PostgreSQL**
  and **Redis**. Railway exposes their connection strings as
  `DATABASE_URL`/`REDIS_URL`-style variables you'll reference in step 2B.
- **Google Cloud**: provision **Cloud SQL for PostgreSQL** and either
  **Memorystore for Redis** or a managed Redis (Upstash is simpler to wire
  up than Memorystore's VPC networking if you want to move faster). Note
  the connection details for step 2C.

---

## 2. Deploy the backend

Pick one.

### 2A. Render

1. New → **Blueprint** → point it at your repo. Render reads
   `backend/render.yaml` and provisions the web service + Postgres + Redis
   together.
2. Before the first deploy finishes, set the two env vars the blueprint
   marks `sync: false` (Render won't set these for you):
   - `FRONTEND_URL` — you don't have this yet; put a placeholder
     (`https://placeholder.vercel.app`) and come back after step 4.
   - `CORS_ORIGINS` — same placeholder for now.
   `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are set to `generateValue: true`
   in the blueprint, so Render generates strong ones automatically — you
   don't need to paste the ones from step 0 unless you want to.
3. Render runs `preDeployCommand: npx prisma migrate deploy` automatically
   on every deploy — your schema is applied before the app starts.
4. Once it's live, open a shell (Render dashboard → your service → "Shell")
   and run the seed script once:
   ```bash
   npm run prisma:seed
   ```
   This loads the 11 roles, ~15 permissions, starter currencies, FX rates,
   and fee schedule — the app has no users/roles/currencies without it.
5. Note your backend URL: `https://globapay-api.onrender.com` (or whatever
   Render assigned). You'll need it in step 3.

### 2B. Railway

1. New Project → Deploy from GitHub repo → select this repo, set the
   service's **root directory to `backend`** (Railway needs to know which
   subfolder has the Dockerfile, since this is a monorepo).
2. Railway reads `backend/railway.json`: it builds from the Dockerfile and
   runs `npx prisma migrate deploy && node dist/main.js` as the start
   command — migrations apply automatically on every deploy.
3. Add environment variables (Railway's "Variables" tab). Reference the
   Postgres/Redis services you created in step 1 using Railway's variable
   references (e.g. `${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`),
   plus:
   ```
   JWT_ACCESS_SECRET=<from step 0>
   JWT_REFRESH_SECRET=<from step 0>
   NODE_ENV=production
   FRONTEND_URL=https://placeholder.vercel.app   # fix in step 5
   CORS_ORIGINS=https://placeholder.vercel.app   # fix in step 5
   ```
4. After the first successful deploy, open a shell (Railway dashboard →
   your service → the terminal icon) and run:
   ```bash
   npm run prisma:seed
   ```
5. Note your backend URL from the "Settings" → "Networking" tab (generate a
   public domain if one isn't assigned yet).

### 2C. Google Cloud Run

This one's more manual — there's no blueprint file to point at, just the
same `backend/Dockerfile`.

1. **Build and push the image** (from the `backend/` directory):
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/globapay-api
   ```
2. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy globapay-api \
     --image gcr.io/YOUR_PROJECT_ID/globapay-api \
     --platform managed \
     --region YOUR_REGION \
     --allow-unauthenticated \
     --add-cloudsql-instances YOUR_PROJECT_ID:YOUR_REGION:globapay-postgres \
     --set-env-vars NODE_ENV=production,JWT_ACCESS_SECRET=...,JWT_REFRESH_SECRET=...,DATABASE_URL=...,REDIS_URL=...,FRONTEND_URL=...,CORS_ORIGINS=...
   ```
   Use the Cloud SQL instance's connection name for `--add-cloudsql-instances`,
   and a `DATABASE_URL` that points at the Cloud SQL Auth Proxy socket
   (`postgresql://user:pass@/dbname?host=/cloudsql/CONNECTION_NAME`) rather
   than a public IP.
3. **Run migrations once**, since Cloud Run doesn't have Render/Railway's
   "run this before each deploy" hook built in — easiest is a one-off Cloud
   Run **Job** (not the service) running `npx prisma migrate deploy`, or
   run it locally against the Cloud SQL proxy before your first deploy.
4. **Seed once**, the same way — a one-off job or a local run against the
   proxy:
   ```bash
   npm run prisma:seed
   ```
5. ⚠️ **Cloud Run's filesystem is fully ephemeral and the service can run
   multiple instances at once** — KYC document uploads (which write to
   local disk in this build, see the Dockerfile's own comment about this)
   will not reliably persist or be visible across instances here, more so
   than on Render/Railway where at least a single instance's disk persists
   between requests. **Don't run the KYC upload flow against Cloud Run
   as-is** — swap `KycController`'s disk storage for a Cloud Storage bucket
   first. This is the one part of the stack where Cloud Run's deployment
   model genuinely requires a code change, not just config.
6. Note the Cloud Run URL Google assigns
   (`https://globapay-api-xxxxx.run.app`).

---

## 3. Point the frontend at the backend (temporarily)

Whichever backend URL you got in step 2, the frontend needs it as
`NEXT_PUBLIC_API_URL` **with `/api/v1` appended** — the backend's global
prefix and versioning mean every real route lives under that path (only
`/health` doesn't). Example:

```
NEXT_PUBLIC_API_URL=https://globapay-api.onrender.com/api/v1
```

Keep this handy for step 4.

---

## 4. Deploy the frontend

### Vercel (recommended)

1. New Project → import the same repo → when Vercel asks for the **root
   directory**, set it to `frontend` (monorepo, same reasoning as Railway
   above). Vercel reads `frontend/vercel.json` and auto-detects Next.js —
   no other config needed.
2. Add the environment variable from step 3:
   ```
   NEXT_PUBLIC_API_URL=https://globapay-api.onrender.com/api/v1
   ```
3. Deploy. Note the resulting URL (`https://your-app.vercel.app`, or your
   custom domain if you attach one).

### Alternative: Google Cloud Run (frontend)

The frontend has its own `Dockerfile` (Next.js `output: 'standalone'`) if
you'd rather keep everything on GCP:

```bash
cd frontend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/globapay-frontend
gcloud run deploy globapay-frontend \
  --image gcr.io/YOUR_PROJECT_ID/globapay-frontend \
  --platform managed \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=https://globapay-api-xxxxx.run.app/api/v1
```

Vercel is still simpler for a Next.js app specifically (zero-config,
automatic preview deployments per PR) — reach for Cloud Run here mainly if
you want everything under one cloud bill/IAM boundary.

---

## 5. Close the loop: fix CORS and go back to real secrets

Now that the frontend has a real URL, go back to your backend's env vars
(Render/Railway dashboard, or `--update-env-vars` on Cloud Run) and set:

```
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGINS=https://your-app.vercel.app
```

Multiple origins (e.g. a Vercel preview URL plus your production domain)
are comma-separated in `CORS_ORIGINS` — check `main.ts`'s CORS setup if you
need more than one. Redeploy/restart the backend for this to take effect —
without it, the frontend's requests will be blocked by CORS, and
`FRONTEND_URL` specifically is what gets embedded in password-reset email
links, so a stale value there sends users to the wrong place.

---

## 6. Smoke test

Don't skip this — none of this has been run end-to-end before it reaches a
real environment (see SECURITY.md for why). In order:

1. `curl https://your-backend-url/health` → should return
   `{"status":"ok",...}`.
2. Open the frontend, register a new account.
3. If SMTP isn't configured yet, check the backend's logs for the OTP code
   (it's logged, not silently dropped) and verify with it.
4. Log in, confirm your default fiat wallets show up (proves the seed data
   loaded and `getOrCreateWallet`/registration worked end to end).
5. Set a transaction PIN, then send a small wallet-to-wallet transfer to a
   second test account — this exercises the ledger, the auth guards, and
   RBAC permission checks together.
6. If you configured `OPENAI_API_KEY`, try the Assistant page; if not,
   confirm it shows the "not configured" state cleanly rather than erroring.

---

## Quick reference: required vs optional env vars

| Variable | Required? | Where it's used |
|---|---|---|
| `DATABASE_URL` | **Required** | Postgres connection |
| `REDIS_URL` | **Required** | BullMQ (transfer settlement, price ticks, auto-refunds) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **Required** — app won't boot without them | Session tokens |
| `FRONTEND_URL` | **Required** | Password reset email links |
| `CORS_ORIGINS` | **Required** | Which origins the API accepts requests from |
| `PORT` | Optional (defaults 4000) | Most platforms set this for you |
| `SMTP_*` | Optional | Real OTP/reset emails — without it, logged to console only |
| `OPENAI_API_KEY` | Optional | AI assistant — returns 503 cleanly if unset |
| `NEXT_PUBLIC_API_URL` | **Required** (frontend) | Must include the `/api/v1` suffix |

---

## Before real users touch this

Everything in **SECURITY.md**'s "before this goes anywhere near real users
or real money" section still applies after deployment — this guide gets
the app running, not audited. The two most deployment-specific items from
that list:

- **KYC uploads need real object storage** before you rely on them past a
  demo — local disk doesn't survive a redeploy on any of these platforms,
  and doesn't work at all across Cloud Run's multiple instances.
- **Run `prisma migrate deploy` and the seed script before the first real
  user hits the app** — an unmigrated or unseeded database will fail on
  the very first registration (no default roles to assign).
