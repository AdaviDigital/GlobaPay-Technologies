# GlobaPay — Phase 1

Foundation layer for GlobaPay: authentication, RBAC, device/session management,
and a multi-currency wallet ledger. This is the base later phases (transfers,
crypto trading, P2P/escrow, virtual cards, merchant tools, AI assistant) build on.

## What's included

**Backend** (`/backend` — NestJS + PostgreSQL + Prisma + Redis/BullMQ)
- Registration with email verification OTP; login with optional TOTP-based 2FA
- JWT access tokens + rotating refresh tokens, tied to revocable sessions
- Device tracking, active-session listing, "sign out everywhere"
- Full RBAC: 11 roles, an extensible permission table, guards for both
- Password reset (email link) and authenticated password/PIN change
- Multi-currency wallets auto-provisioned on signup (USD, GBP, EUR, CAD, NGN, AUD),
  backed by a double-entry-style ledger (`LedgerEntry`) so every balance change
  is auditable — this is the choke point later phases (transfers, trading,
  escrow) write through, rather than mutating balances directly
- Currencies are **data, not code** — `Currency` is a table, so adding a new
  fiat currency or crypto token later is an insert, not a deploy
- **Transfers (Phase 2):** wallet-to-wallet (instant, free, in-network),
  currency conversion (own wallets, FX-rate quoted), and local/international
  bank transfers over SWIFT/ACH/SEPA/Faster Payments/local-instant rails —
  all PIN-confirmed and routed through the same ledger
- **FX module:** exchange rates as data (`ExchangeRate` table) with automatic
  inverse and USD-bridge lookups, so a handful of seeded pairs can quote
  almost any combination; a public `/fx/rates` and `/fx/quote` endpoint
- **Fee engine:** a `FeeRule` schedule (percentage + flat, with min/max
  clamps) matched by transfer type, rail, and currency — editable without
  code changes
- **Beneficiaries:** saved GlobaPay-user contacts and bank accounts (SWIFT/
  BIC, ACH routing number, IBAN, UK sort code), owner-scoped CRUD
- **Async settlement:** external bank transfers are debited immediately,
  then queued on BullMQ/Redis for simulated rail settlement (via a
  swappable `MockBankProviderService`) — success completes the transfer,
  failure automatically refunds the wallet
- **Scheduled & recurring transfers:** a future-dated bank transfer is held
  as a template until due; an hourly-tick-independent cron
  (`TransfersSchedulerService`, every minute) fires due recurrences and
  spawns real, independent transfers from them
- **Crypto trading (Phase 3):** market/limit/stop orders across 9 crypto
  assets, priced through the same FX module (rates now include a live-style
  random-walk tick every 30s so prices move). GlobaPay is the counterparty
  on every trade — the same "simple buy/sell" model Coinbase/Binance use for
  retail — rather than a cross-user order book, since there's no real
  external liquidity source behind this yet
- **Portfolio, watchlists, price alerts:** aggregated crypto holdings valued
  in USDT; a starrable watchlist; price alerts that email when a target is
  crossed (checked on the same 30s tick)
- **Deposit addresses:** a demo-grade, clearly-labeled placeholder address
  per crypto asset so the deposit UI has something to render — **not** a
  real blockchain address; see the caveat below
- **KYC & compliance (Phase 4):** tiered verification (Tier 1: BVN/NIN +
  selfie; Tier 2: government ID + proof of address; Tier 3: business — CAC,
  tax ID, directors), document upload with type/size/mime validation, a
  straight-through-approval path for clean submissions, and a compliance
  review queue (approve / reject / needs-more-info) for flagged ones. See
  the compliance disclaimer below — **this is a workflow scaffold, not a
  real compliance solution.**
- **P2P marketplace & escrow (Phase 5):** sell-side offers for crypto or
  gift cards. Crypto orders settle instantly and atomically (both legs are
  programmatically guaranteed, so there's nothing to genuinely dispute).
  Gift-card orders use real escrow — the seller's proceeds sit in their
  wallet's `frozenBalance` until the buyer confirms the delivered code, with
  a dispute path (resolved by `escrow:manage` roles) and an hourly cron that
  auto-refunds buyers whose seller never delivered in time. Reviews/ratings
  land on completed orders.
- **Virtual cards (Phase 5):** issuance, freeze/unfreeze/terminate, spending
  limits (daily/monthly), a statement, and a purchase simulator that debits
  the linked wallet through the same ledger as everything else. **No real
  PAN or CVV is ever generated or stored** — this is a spending-control
  record, not a functional payment card; see the disclaimer below.
- **Merchant & checkout tools (Phase 5):** merchant account with an
  API-key-on-creation flow (shown once, never recoverable), payment links,
  invoices, a public checkout flow (any logged-in GlobaPay user can pay), a
  settlement dashboard, and best-effort webhook delivery (fire-and-forget,
  no retry queue in this build) for a merchant's `webhookUrl`.

**Frontend** (`/frontend` — Next.js 15 + React 19 + Tailwind)
- Landing page, registration, login, OTP verification, forgot/reset password,
  login-time 2FA challenge
- Dashboard shell (sidebar + topbar) with a client-side auth guard
- Wallet overview and full wallet list, pulling live balances from the API
- **Transfer page (Phase 2):** tabbed flows for sending to a GlobaPay user,
  converting between currencies, and bank transfers (with rail selection and
  optional scheduling), each PIN-confirmed, plus a transfer history feed
- **Beneficiaries page (Phase 2):** add/remove GlobaPay contacts and bank
  accounts
- **Crypto page (Phase 3):** live-ish price list with one-click watchlist
  toggling, a buy/sell/limit/stop trade panel, order history, portfolio
  valuation, price alerts, and a deposit-address modal
- **Verification page (Phase 4):** tier progress, the active tier's form and
  document uploader, and submission history
- **Compliance page (Phase 4):** the review queue, visible in the nav only to
  `COMPLIANCE_OFFICER`/`ADMIN`/`SUPER_ADMIN` roles — see "Testing the
  compliance flow" below for how to reach it, since registration only ever
  creates `INDIVIDUAL` accounts
- **P2P page (Phase 5):** browse/buy offers, manage your own listings, and
  an orders view with delivery/confirm/dispute actions where relevant
- **Cards page (Phase 5):** issue, freeze, limit, and simulate purchases on
  virtual cards, each with an inline statement
- **Merchant page (Phase 5):** account setup, a revenue dashboard, payment
  link and invoice management with copyable checkout URLs
- **Public checkout page (Phase 5)** at `/checkout/[reference]` — works for
  both payment links and invoices; anyone can view it, only a logged-in
  GlobaPay user can pay
- **Assistant page (Phase 7):** a chat interface grounded in the user's own
  data (via tool-calling, not RAG — see below), plus a financial health
  score, spending-by-category, budgets, and fraud alerts
- **Admin page (Phase 7):** visible only to `ADMIN`/`SUPER_ADMIN`/
  `FINANCE_MANAGER` roles — platform analytics, user search with
  suspend/reactivate, feature flags, fee-rule toggles, and an audit log
  viewer
- Security page: 2FA setup with QR code, transaction PIN, active sessions
- Settings page for profile editing

## ⚠️ Compliance disclaimer — read before going anywhere near real users

`ScreeningService` (backend, `/backend/src/kyc/screening.service.ts`) does a
**keyword match against a hardcoded demo list** — it is not connected to
OFAC, the UN sanctions list, or any licensed PEP/sanctions data provider.
BVN and NIN numbers are stored exactly as submitted; they are **not**
verified against Nigeria's actual BVN/NIN registries. This exists so the
review queue, risk score, and approval flow have something realistic to
work against in this build. Before this handles a real user's identity or
money:
- Replace `ScreeningService`'s internals with a licensed provider (e.g.
  ComplyAdvantage, Refinitiv World-Check, Dow Jones Risk & Compliance) for
  sanctions/PEP screening
- Replace the raw BVN/NIN storage with a real identity-verification
  integration (e.g. Smile ID, Youverify, Dojah) that actually confirms the
  numbers against Nigeria's registries
- Get the whole KYC/AML program reviewed by an actual compliance
  professional — this is a workflow scaffold (submission → documents →
  screening → review → approval), not legal or regulatory advice, and
  nothing here should be read as such

### Testing the compliance flow

Registration only ever creates `INDIVIDUAL` users, so to see the
`/dashboard/compliance` review queue, promote a test user's role after
signing up:

```sql
-- after registering a user, find their id and the COMPLIANCE_OFFICER role id, then:
INSERT INTO "UserRole" ("userId", "roleId") VALUES ('<user-id>', '<compliance-officer-role-id>');
```

or via Prisma Studio (`npx prisma studio` from `/backend`) — open `User` →
add a row in `UserRole` linking that user to the `COMPLIANCE_OFFICER` role.
Sign out and back in afterward so the new role lands in a fresh access token.
The same trick works for the `/dashboard/admin` page — link to `ADMIN`,
`SUPER_ADMIN`, or `FINANCE_MANAGER` instead.

## Phase 7 — AI assistant, gift card validation, admin dashboard

**AI assistant.** Uses the OpenAI SDK directly with tool-calling, not
LangChain or a vector DB/RAG pipeline — the assistant answers questions
grounded in the user's own live transaction data (wallets, transfers,
budgets, portfolio), which is a database-query problem, not a
document-search one, so a RAG layer doesn't fit the shape of what it's
doing. `LlmProviderService` (`/backend/src/ai/llm-provider.service.ts`) is
the swap point for a different provider. **Requires `OPENAI_API_KEY`** —
without it, `/ai/*` endpoints return a clear 503 rather than a fake
response; the frontend shows this state instead of pretending the
assistant works. The assistant's tools are read-only — it can explain your
finances but can't move money or change settings on your behalf. Financial
health scoring, expense categorization, and fraud alerts are all
deterministic rule-based logic (not LLM judgment calls), so they work
identically whether or not an API key is configured. "Voice assistant"
from the original feature list was not built — it needs a speech-to-text
provider, a separate integration this pass didn't add.

**Gift card validation.** Runs automatically when a seller delivers a code
on a P2P gift-card order: a real format check against known brand code
patterns, and a real duplicate-code check (has this exact code been
delivered before? — a genuine fraud signal). Image OCR
(`/backend/src/giftcards/ocr-provider.service.ts`) is a mocked, pluggable
provider — real OCR needs AWS Textract/Google Vision/Azure Document
Intelligence, deliberately not wired in here. Flagged/rejected results
surface in the compliance queue; they never block the seller from
delivering.

**Broader admin dashboard.** User search with suspend/reactivate (fully
audited via `UserStatusChange`), platform analytics (users, transfer
volume, fee revenue by currency), feature flags, fee-rule and
exchange-rate management, and — new in this pass — the `AuditLog` table
that existed since Phase 1 but was never actually written to. It now logs
logins, password changes, KYC decisions, and dispute resolutions; extending
it to more actions is a matter of adding `auditLog.record()` calls where it
matters.

## Not yet built (later phases)

Real crypto custody integrations need licensed providers and security
review before they touch real funds — that's deliberately out of scope for
this pass, as is a real OCR provider, a real sanctions/PEP data provider,
and a real card-issuing partner (see the disclaimers above and below). The
mock bank provider simulates settlement (including a small random failure
rate) purely for realistic UX; it is not connected to any real banking
rail. **Crypto deposit addresses are demo placeholders, not real wallets.**
**Virtual cards store no real PAN or CVV.** **Merchant webhook delivery is
fire-and-forget** with no retry queue — a production version would want
that on BullMQ, the same way transfer settlement already is.

## Local development

Requires Docker, or Node 20 + a local Postgres/Redis.

```bash
# 1. Copy env files, then set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in
#    backend/.env — the app refuses to start without them (see SECURITY.md).
#    Generate each with: openssl rand -hex 32
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 2. Start Postgres + Redis + the API
docker compose up --build

# 3. In a separate terminal, run migrations and seed roles/permissions/currencies
cd backend
npm install
npx prisma migrate dev --name init
npm run prisma:seed

# 4. Start the frontend
cd ../frontend
npm install
npm run dev
```

The API runs on `http://localhost:4000/api/v1`, the frontend on `http://localhost:3000`.
Without SMTP configured, OTP codes and password reset links are logged to the
backend console instead of emailed — check the terminal running `docker compose`
(or `npm run start:dev`) after registering.

## Deploying

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step runbook**
(Vercel + Render/Railway, or Google Cloud Run end to end). Quick summary:

- **Backend** → Render (`render.yaml`) or Railway (`railway.json`) as a Docker
  service; `Dockerfile` is a plain Node 20 multi-stage build that also runs on
  Google Cloud Run as-is. Set `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `FRONTEND_URL`, and `CORS_ORIGINS` in the platform's
  environment settings — the app will not start without the two JWT secrets;
  see `validate-env.ts`. Do not commit real secrets.
- **Frontend** → Vercel (`vercel.json`, zero-config for Next.js) or the included
  `Dockerfile` (Next `output: 'standalone'`) for Render/Railway/Cloud Run. Set
  `NEXT_PUBLIC_API_URL` to the deployed backend's URL, including the `/api/v1` suffix.
- Run `npx prisma migrate deploy` against production before the API's first
  boot (Render's `preDeployCommand` and Railway's `startCommand` already do
  this); then run `npm run prisma:seed` once to load roles/permissions/currencies.

## Security

See **[SECURITY.md](./SECURITY.md)** for the full review: what's been fixed
(insecure default secrets, rate limiting that was configured but never
enforced, dependency CVEs, a few other findings), what's found-but-deferred
and why, and — importantly — what has and hasn't actually been verified
against a real running instance of this app. Short version: passwords and
PINs are hashed with Argon2id, OTP codes are hashed at rest, access tokens
are short-lived with rotating refresh tokens, every route requires auth by
default, and the app now refuses to boot with missing or weak secrets. None
of that adds up to an audit — read SECURITY.md before this goes anywhere
near real users or real money.
