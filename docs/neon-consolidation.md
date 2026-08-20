# Neon consolidation

The primary application schema and accounting data now live in the configured
Neon PostgreSQL database. The primary Prisma client prefers
`NEON_DATABASE_URL` and falls back to `DATABASE_URL`.

## Database layout

The tenant-aware Prisma models are the source of truth for new application and
sync writes:

- `Company`, `User`, memberships, authentication tokens, and subscriptions
- `SyncSource`, `SyncApiKey`, and `AccountingCompany`
- `BillEntry`, `BillItem`, `PaymentVoucher`, and `PaymentAllocation`

The former snake_case report tables and obsolete user-level `Apikey` table
are removed by a forward Prisma migration. Runtime ingestion and reports use
only the tenant-aware models. Old `bill_data` rows now correspond to
`BillItem` records attached to `BillEntry`.

## Demo tenant

The preserved legacy dataset was imported into a dedicated tenant using stable
IDs from `config/demoTenant.js`. Anonymous reports use this tenant unless
`DEMO_COMPANY_ID` overrides it.

The imported accounting company uses external company ID `1`, matching the
legacy `CompNo`.

## Commands

Deploy primary migrations to Neon:

```bash
npm run migrate:neon:schema
```

The one-time import script was removed after its successful run. Future schema
changes should be added under `prisma/migrations` and deployed with the same
command.
