# Local database workflow

The Prisma migration files in `prisma/migrations` are the schema source of
truth. Neon has a `_prisma_migrations` table recording which migrations were
applied, but a new local PostgreSQL database can replay the same committed SQL
files without copying that table from Neon.

## Create and populate a local database

Set the local environment without leaving the Neon URL active:

```dotenv
NEON_DATABASE_URL=
DATABASE_URL="postgresql://postgres:dashboard@127.0.0.1:5432/dashboard_local?schema=public"
NODE_ENV="development"
```

In development, the application and Prisma CLI use `DATABASE_URL`. Production
runtime uses `NEON_DATABASE_URL` when `NODE_ENV=production`.

Apply the committed migrations and explicitly run the development seed:

```bash
npm run db:setup:local
```

The seed is idempotent for its own stable tenants and records. It creates:

- an anonymous report tenant using the IDs in `config/demoTenant.js`;
- a separate authenticated local account with one verified owner;
- an active subscription, sync source, accounting company, and local sync key;
- two accounting companies named `Sunrise Textiles Private Limited` and
  `Moonlight Fabrics LLP`;
- four financial years (`2022-2023` through `2025-2026`) for each accounting
  company;
- 1,000 sales and 1,000 purchases in total, evenly distributed as 125 of each
  transaction type per accounting company per financial year;
- one item per bill plus deterministic receipts, payments, and allocations.
  Sixty percent of bills are fully paid, 20 percent are partially paid, and 20
  percent are unpaid so outstanding reports contain meaningful mixed states.

Local credentials printed by the seed are:

```text
Email: owner@example.com
Password: LocalDev123!
Sync API key: sync_local_seed.local-development-only
```

By default the seed refuses production or non-local database URLs. This keeps
`npm run seed:local` from accidentally modifying Neon. `ALLOW_REMOTE_SEED=1`
exists for an intentional disposable remote development database, but should
not be used for production.

## Test against local PostgreSQL

Run the normal test suite and the opt-in database integration test:

```bash
npm test -- --runInBand
RUN_POSTGRES_INTEGRATION=1 npm test -- test/integration/syncPostgres.integration.test.js --runInBand
```

Start the API and exercise health, authentication, and anonymous reports:

```bash
npm run dev
curl http://localhost:5000/health
curl http://localhost:5000/api/v1/reports/sales/KPI-summary
curl http://localhost:5000/api/v1/reports/outstanding/sales
```

## Promote schema changes to Neon

Create and test new migrations against the local development database:

```bash
npx prisma migrate dev --config prisma.config.js --name describe_the_change
npm test -- --runInBand
```

Commit both `prisma/schema.prisma` and the generated directory under
`prisma/migrations`. In deployment, provide the Neon connection URL and run:

```bash
npm run migrate:schema
```

Production migration deployment should normally run in CI or a release phase.
Do not run `npm run seed:local` against the production Neon database.

Schema migrations do not copy development rows to Neon. If data itself must be
moved, use one of these separate workflows:

1. Run the accounting sync client against the Neon-backed API to repopulate
   accounting data.
2. For a one-time full database move, restore a PostgreSQL dump into a new,
   empty Neon database or branch, validate it, and only then switch the app.

Do not restore a full local dump over an existing Neon database with live data;
that can conflict with existing IDs, migration history, and customer records.
