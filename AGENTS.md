# Dashboard Backend Guide

## What this app is

This repository is the backend for a business/accounting dashboard. It is a
CommonJS Node.js API built with Express 5. It handles:

- user registration, email verification, login, refresh-token rotation,
  logout, and password resets;
- companies, company memberships, and role-based sync-source provisioning;
- API-key authentication for an external accounting-data sync client;
- sales and purchase reports, including KPIs, monthly trends, party summaries,
  item summaries, and transaction details;
- sales/purchase outstanding balances calculated from bills, returns, and
  payment allocations;
- placeholder dashboard-summary and cashflow endpoints.

The intended product flow is:

1. A user registers and a company is created with that user as `OWNER`.
2. The user verifies their email and signs in.
3. An `OWNER` or `ADMIN` provisions a sync source and receives its API key once.
4. An external accounting application sends bill/payment data using that key.
5. The dashboard reads the synchronized accounting data and serves reports.

That flow is not fully connected yet: report APIs read the legacy Neon schema,
while the new authenticated sync endpoint currently logs/acknowledges its body
without writing it to either database.

## Current architecture

The request path normally follows:

`route -> validation/auth middleware -> controller -> service (where present) -> db query -> Prisma`

Key locations:

- `server.js`: starts the HTTP server on hard-coded port `5000`.
- `app.js`: configures Express, JSON/form limits, cookies, CORS, and routers.
- `routes/`: API paths and middleware wiring.
- `controllers/`: HTTP status codes and response shapes.
- `services/`: thin report-service wrappers plus Resend email delivery.
- `db/`: Prisma queries and report calculations.
- `schema/validatorSchema.js`: Zod request schemas and normalization.
- `middleware/verifyToken.js`: JWT access-token authentication.
- `middleware/apiKeyAuth.js`: sync API-key authentication.
- `utils/token.js`: access/refresh/verification token generation and hashing.
- `prisma/`: both database schemas and migrations for the primary schema.
- `test/` and `test/unit/`: Jest/Supertest route and unit tests.
- `generated/`: generated Prisma clients; do not edit these files manually.

There is no global Express error handler in `app.js`. Controllers that call
`next(error)` may fall through to Express's default error handling.

## Two-database transition

Do not treat the two Prisma clients as interchangeable.

### Primary application database (`DATABASE_URL`)

Configured by `prisma.config.js`, modeled in `prisma/schema.prisma`, and exposed
as `prisma` from `lib/prisma.js`. It stores:

- users, companies, memberships, and roles;
- email verification, password-reset, and rotating refresh tokens;
- sync sources and hashed sync API keys;
- the newer tenant-aware accounting models: `BillEntry`, `BillItem`,
  `PaymentVoucher`, and `PaymentAllocation`.

Tenant-aware records carry `companyId` and `syncSourceId`. Preserve those
boundaries in all queries and writes.

### Legacy report database (`NEON_DATABASE_URL`)

Configured by `neon.prisma.config.js`, modeled in
`prisma/neon.schema.prisma`, and exposed as `neonprisma` from `lib/neon.js`.
Current sales, purchase, outstanding, and item reports read its snake_case
tables (`bill_entries`, `bill_data`, `payment_vouchers`, and
`bill_payment_allocations`).

The report database has no company/tenant columns. Report endpoints therefore
are not tenant-scoped in their current implementation.

Run `npm run generate` after changing either Prisma schema. It generates both
clients under `generated/prisma` and `generated/neon`.

## Domain rules and accounting codes

Current report logic uses these transaction codes:

| Meaning | Code(s) |
| --- | --- |
| Sale | `S` |
| Sales return | `SR` |
| Purchase | `P`, `OP`, `FJ` |
| Purchase return | `PR` |
| Bank receipt used against sales | `BR` |
| Bank payment used against purchases | `BP` |

Reports use a hard-coded half-open period of `2025-04-01` through
`2026-04-01` in `controllers/reportControllerFactory.js` and
`controllers/itemReportController.js`. Most supplied query filters are not yet
used. Party and item detail inputs are trimmed and uppercased by Zod because
lookups use exact database values.

Outstanding calculations match allocations to a bill by normalized
`bill_no + party`, subtract adjusted amounts and party returns, and report
overpayments and average payment time. Preserve both parts of that matching key
to avoid applying payments to the wrong party's bill.

## API map

All current routes are under `/api/v1`.

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify-email?token=...`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/verify-password-reset-token?token=...`
- `POST /auth/reset-password?token=...`
- `POST /auth/refresh`
- `POST /auth/logout`

Access tokens are HS256 JWTs with a 15-minute lifetime and are sent as
`Authorization: Bearer <token>`. Refresh tokens last 30 days, are stored only as
SHA-256 hashes, rotate on use, and are delivered in an HTTP-only
`refresh_token` cookie scoped to `/api/v1/auth`. Reuse revokes the token family.
Verification and reset secrets are also stored only as hashes.

### Sync setup and ingestion

- `GET /companies/:companyId/sync-sources` — JWT required; any company member.
- `POST /companies/:companyId/sync-sources` — JWT and verified email required;
  only `OWNER` or `ADMIN`; plaintext API key is returned only on creation.
- `POST /billdata` — sync API key required through a Bearer token or temporary
  `x-api-key` compatibility header.

Sync keys look like `sync_<prefix>.<secret>` and only their SHA-256 hash is
stored. `middleware/apiKeyAuth.js` attaches trusted `companyId` and
`syncSourceId` as `req.syncAuth`; ingestion code must use that trusted context,
never tenant identifiers supplied in the request body.

### Dashboard and reports

- `GET /dashboard/summary` — JWT required, but currently returns the authenticated
  user immediately; the placeholder dashboard query is unreachable.
- `GET /reports/sales/{KPI-summary,monthly,customers,items}`
- `GET /reports/sales/customer?party=...`
- `GET /reports/sales/item?item=...`
- `GET /reports/purchases/{KPI-summary,monthly,suppliers,items}`
- `GET /reports/purchases/supplier?party=...`
- `GET /reports/purchases/item?item=...`
- `GET /reports/outstanding/{sales,purchases}`
- `GET /reports/cashflow` — placeholder returning an empty data array.

Report and cashflow routes currently have no JWT middleware. Treat that as a
known unfinished security/tenant-isolation area, not an intentional guarantee
that accounting data is public.

## Environment and local commands

Required runtime configuration is loaded from the environment (normally a
local `.env`, which must not be committed):

- `DATABASE_URL`
- `NEON_DATABASE_URL`
- `JWT_SECRET_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CLIENT_URL`
- `NODE_ENV` (`production` enables secure, `SameSite=None` refresh cookies)

Useful commands:

```bash
npm install
npm run generate
npm run dev
npm start
npm test
npm run lint
```

The API listens on `http://localhost:5000`. CORS currently allows only
`http://localhost:5173`, with credentials enabled. Request bodies are limited
to 50 MB.

Prisma migration work should target the primary schema explicitly through
`prisma.config.js`. The legacy Neon config has no migration directory and is
currently a read/report model.

## Working conventions

- Use CommonJS (`require`/`module.exports`) and the existing layered layout.
- Put request parsing, authorization, and response status handling in
  controllers/middleware; put Prisma access in `db/`.
- Validate new external input with Zod and wire it through `validate(...)`.
- Never return password hashes, stored token hashes, or sync-key hashes.
- Never log plaintext credentials or full accounting payloads. The current
  `syncController` logs its payload and should be corrected when ingestion is
  implemented.
- Scope every new primary-database accounting query by trusted `companyId` and,
  where relevant, `syncSourceId`.
- Use parameterized Prisma APIs or `Prisma.sql`; do not interpolate user input
  into raw SQL strings.
- Add or update Jest tests with behavior changes. Mock database/email boundaries
  in route/unit tests as the existing suite does.
- Before finishing a change, run the narrow relevant tests, then `npm test` and
  `npm run lint` when practical.
- Do not edit `package-lock.json` unless dependencies actually changed.
- Do not manually edit `generated/` or commit secrets and local `.env` files.

## Known incomplete or surprising behavior

- `POST /api/v1/billdata` authenticates a sync key but only logs and acknowledges
  the payload; it does not validate or persist accounting records.
- Reports read the legacy Neon database rather than the new tenant-aware models.
- Report routes are unauthenticated and not tenant-scoped.
- Report dates are hard-coded to the 2025-26 financial year.
- Dashboard summary and cashflow database queries are placeholders.
- `GET /dashboard/summary` returns user data instead of a financial summary.
- `routes/apikeyRouter.js` is unfinished, logs a randomly generated key when
  imported, and is not mounted by `app.js`; use `SyncApiKey`, not the old
  user-level `Apikey`, for accounting sync work.
- `README.md` currently contains a raw accounting SQL query rather than project
  setup documentation; this file is the reliable repository overview for now.
