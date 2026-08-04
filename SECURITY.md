# Security review — Phase 6

A code-level review of everything built in Phases 1–5, done directly against
a real local Postgres + Redis (this sandbox can install and run both, even
though it can't reach Prisma's binary CDN — see "What I could and couldn't
verify" below). This is a targeted internal review, not a substitute for a
professional penetration test or an external audit — get one of those before
this handles real money.

## Fixed in this pass

**Critical — insecure default JWT secrets.** `configuration.ts` used to fall
back to hardcoded strings (`'change-me-access-secret'` etc.) if
`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` weren't set. Since those exact
strings are sitting in this public codebase, anyone who's seen it could have
forged valid tokens against any deployment that forgot to set real secrets.
Fixed: the app now calls `validateEnv()` (`src/config/validate-env.ts`)
before it will even boot, and refuses to start if either secret is missing,
too short (<32 chars), or identical to each other. No more silent insecure
fallback — misconfiguration is now a startup crash with a clear error
message, not a live vulnerability.

**High — rate limiting was configured but never enforced.**
`ThrottlerModule.forRoot()` has been registered since Phase 1, but
`ThrottlerGuard` was never actually added to the global guard chain — every
endpoint, including `/auth/login`, has had zero real rate limiting this
whole time. Fixed in `auth.module.ts`, and added tighter per-route limits
(`@Throttle()`) on top of the global default for the highest-risk endpoints:

| Endpoint | Limit |
|---|---|
| `/auth/register` | 5 / min |
| `/auth/login`, `/auth/login/2fa` | 8 / min |
| `/auth/resend-otp`, `/auth/forgot-password` | 3 / min |
| `/auth/verify-otp` | 10 / min |
| All PIN-protected money-movement endpoints (transfers, P2P orders, crypto orders, checkout pay) | 15 / min |

The tighter limit on PIN-protected endpoints matters specifically because a
4-digit PIN is a 10,000-value keyspace — much smaller than a password — so
it needs tighter protection against brute-forcing than general traffic does.

**Medium — `req.ip` wasn't trustworthy behind a reverse proxy.** Render,
Railway, and most PaaS front the app with a proxy hop; without
`app.set('trust proxy', 1)`, Express reports the proxy's IP for every
request, which would make IP-based rate limiting either block everyone
together or not limit anyone meaningfully. Fixed in `main.ts`.

**Low — dead/misleading config.** Removed `BCRYPT_COST`/`security.bcryptCost`
— the app has only ever used `argon2` (a stronger default than bcrypt) for
password and PIN hashing, via that library's own sensible defaults; this
config value did nothing and implied a control that didn't exist.

**Dependency vulnerabilities — fixed the two real ones.** `npm audit`
flagged 29 findings; most trace back to `@nestjs/cli`'s own dev-only
dependency tree (webpack, `@angular-devkit/*`, `ajv`, `glob`, `inquirer`,
`tmp`, `picomatch`) which is never in the production image (`npm ci
--omit=dev`) — those are noise for this app's actual attack surface. Two
were real, in the production dependency tree, and fixed by upgrading:

- `multer` 1.4.5 → `^2.2.0` (multiple DoS CVEs in 1.x's upload cleanup handling)
- `nodemailer` 6.9 → `^9.0.3` (SMTP command injection / SSRF CVEs)
- Removed the `uuid` package entirely — it was a leftover dependency from
  the initial scaffold that nothing in the codebase actually imports
  (`crypto.randomUUID()`/`randomBytes()` are used directly throughout); no
  reason to carry its vulnerability for code that isn't used.

## Found, not fixed — and why

**Moderate — `@nestjs/core` reflected-injection CVE (GHSA-36xv-jgw5-4q75,
CVSS 6.1), plus its ripple effects on `@nestjs/config`,
`@nestjs/platform-express`, `@nestjs/schedule`, `@nestjs/throttler`,
`@nestjs/bullmq`, and their transitive `express`/`body-parser`/`qs`/`lodash`
copies.** The fix requires a coordinated NestJS v10 → v11 major-version
upgrade across roughly ten packages simultaneously — not a patch bump.

I did not do this blind. This sandbox cannot run the application at all
(see below), which means a major framework upgrade here would ship
completely unverified — if it silently broke a guard, a decorator, or a
module registration pattern, there would be no way to catch it before it
reached whoever deploys this. Shipping an unverified major-version bump and
calling it "hardened" would be worse than leaving a well-documented,
moderate-severity, low-exploitability-in-context finding with a clear path
forward. Recommended next step: do this upgrade in its own branch, with a
real environment to test against (this app has never been run end-to-end —
see below), full manual QA of every auth/RBAC path, before merging.

**Should still add — per-user PIN lockout.** OTP codes already have a
tracked `attempts`/`maxAttempts` counter that locks out after 5 wrong
guesses (see `otp.service.ts`). Transaction PINs don't have an equivalent —
they're only protected by the per-IP rate limits added above, which a
distributed attacker (many source IPs) could work around. A real fix needs
a `pinAttempts`/`pinLockedUntil` pair on `User`, incremented in
`AuthService.verifyPin` and checked before allowing another attempt — the
same pattern already proven out for OTP, just not yet applied here.

**Should harden — KYC document upload trusts the client-declared MIME
type.** `multer`'s `fileFilter` only sees the `Content-Type` the browser
declared for the multipart part, not the actual file bytes — a malicious
upload with real HTML/SVG content and a spoofed `image/jpeg` label would
pass validation today. The blast radius is already reduced by an existing
control (helmet's `X-Content-Type-Options: nosniff` header, which stops
most browsers from content-sniffing past the declared type when a document
is later served), but the honest fix is validating actual file signatures
at upload time — the `file-type` package is already sitting in
`node_modules` as a transitive dependency and would do this cleanly.

**Database-level financial invariants aren't enforced by the schema
itself.** I validated (see below) that `WalletsService`'s application-level
guard correctly rejects an overdraft before it reaches the database. But
Prisma's schema DSL (the version pinned here) doesn't have first-class
support for `CHECK` constraints, so there is currently no *database-level*
backstop if that application check were ever bypassed by a bug or a future
contributor writing a raw Prisma call outside `applyLedgerMovementInTx`.
Recommended: add `balance >= 0` and `"frozenBalance" >= 0` check
constraints via a manual SQL migration (Prisma supports raw SQL in
migrations even without native schema-DSL support for this) — defense in
depth, not a replacement for the application-level check.

## What I could and couldn't verify

This sandbox's egress policy categorically blocks `binaries.prisma.sh`
(confirmed directly: `curl -I` returns `403` with `x-deny-reason:
host_not_allowed`) — not a flag or version issue, a hard network block on
that domain specific to this environment. I tried the newer
driver-adapter/WASM approach, multiple Prisma major versions, and the
checksum-skip env var; all still need that domain for either the query
engine or the schema engine. **This means the actual NestJS+Prisma
application has never been run end-to-end in this project, in any phase.**
Every "typechecks cleanly" claim in earlier phases was real but partial —
it proves the code is internally consistent, not that it behaves correctly
at runtime.

What I could do instead, this pass: installed real Postgres 16 and Redis 7
locally (both are reachable via the allowed `archive.ubuntu.com`/
`security.ubuntu.com` mirrors) and hand-derived DDL for the highest-risk
subset of the schema — identity, RBAC, wallets, and the ledger — matching
`schema.prisma` field-for-field. Against that live database I confirmed:

- The exact debit/credit transaction pattern `WalletsService` uses produces
  correct decimal arithmetic with zero rounding error (`NUMERIC(36,18)`,
  not floats) across a simulated transfer
- A duplicate `LedgerEntry.reference` is correctly rejected (the idempotency
  guard behind every ledger write actually works)
- A wallet can't reference a nonexistent currency (foreign key integrity holds)
- A user can't get two wallets in the same currency (the constraint
  `getOrCreateWallet` depends on to avoid race-condition duplicates holds)
- An overdraft attempt is correctly rejected

That's real signal on the part of the system handling actual money — but it
covers roughly 8 of the ~40 models, by hand, not the full schema. It's not
a substitute for `prisma migrate deploy` succeeding in a real environment,
which is the very first thing to run — before anything else — once this
reaches a machine with normal internet access.

## Before this goes anywhere near real users or real money

1. Run this in a real environment (any CI runner, Render, Railway, your own
   laptop with internet access) and confirm `prisma generate` +
   `prisma migrate deploy` succeed, then actually exercise the API —
   register a user, run a transfer, place a crypto order. None of that has
   happened yet.
2. Add the per-user PIN lockout described above.
3. Do the NestJS v11 upgrade deliberately, in its own branch, with real test
   coverage — not as part of this pass.
4. Get an actual professional security review / penetration test. This
   document is a good-faith internal pass, not that.
5. Everything already flagged in the README's per-phase disclaimers still
   applies: KYC/AML screening is a mock, crypto deposit addresses aren't
   real, virtual cards store no real PAN/CVV, the bank-transfer settlement
   is simulated. None of that changed here.
