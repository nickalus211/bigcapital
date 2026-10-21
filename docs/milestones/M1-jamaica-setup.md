# M1: Jamaica setup

**Status:** complete.
**Branch:** `feat/jamaica-m1-setup` (based on M0).

## Scope

Configure an organization for a Jamaican sole trader:
- GCT tax rates classified as standard / zero-rated / exempt / out of scope
- effective-dated rate versions and tax parameters (data, not code)
- GCT input and output tax accounts, a WHT receivable account, and
  disallowed-expense accounts
- TRN on customers and vendors
- GCT registration settings
- an idempotent setup that runs automatically for organizations located in
  Jamaica, from the API, from the CLI, or from Preferences

Posting tax to the new accounts and taxing more document types is M2. The
`tax.*` settings are stored now and take effect then.

## Changes

### Migrations (`packages/server/src/database/tenant/migrations/`)

| File | Change |
|---|---|
| `20261021100000_jm_add_tax_type_to_tax_rates` | `tax_rates.tax_type` enum, nullable |
| `20261021100100_jm_create_tax_rate_versions_table` | `tax_rate_versions` (rate, effective_from/to, verified, source_note) |
| `20261021100200_jm_create_tax_parameters_table` | `tax_parameters` (jurisdiction, key, JSON value, effective_from/to, verified, source_note) |
| `20261021100300_jm_add_tax_number_to_contacts` | `contacts.tax_number`, nullable |

All are additive with no backfill. Existing rows behave as before.

### Server: core (generic, default-off)

| File | Change |
|---|---|
| `modules/TaxRates/constants.ts` | `TaxType` enum, `TAX_TYPES` |
| `modules/TaxRates/models/TaxRate.model.ts` | `taxType`, `versions` relation |
| `modules/TaxRates/models/TaxRateVersion.model.ts`, `TaxParameter.model.ts` (new) | Models with an `effectiveOn(date)` modifier, registered in `TaxRatesModule` |
| `modules/TaxRates/dtos/TaxRate.dto.ts`, `TaxRateResponse.dto.ts` | Optional `taxType` |
| `modules/TaxRates/ItemEntriesTaxTransactions.service.ts` | `assocTaxRateFromTaxIdToEntries(entries, asOfDate?)` prefers the rate version effective on the date |
| `modules/SaleInvoices/commands/CommandSaleInvoiceDTOTransformer.service.ts`, `modules/Bills/commands/BillDTOTransformer.service.ts` | Pass the invoice or bill date to the rate lookup |
| `modules/Customers/**`, `modules/Vendors/**` (DTOs, models) | Optional `taxNumber` |
| `constants/metable-options.ts` | `tax.*` and `jamaica.*` setting groups |
| `modules/CLI/commands/TenantsJamaicaSetup.command.ts` (new), `CLI.module.ts`, `package.json` | `tenants:jamaica-setup` |

### Server: Jamaica module (`modules/Jamaica/`)

| File | Purpose |
|---|---|
| `data/gct-rates.ts`, `data/tax-parameters.ts`, `data/jamaica-accounts.ts` | Seed data. Every figure is marked unverified. |
| `setup/JamaicaSetup.service.ts` | Idempotent setup with a dry run (the transaction is rolled back) |
| `setup/JamaicaSetupOnOrganizationBuild.subscriber.ts` | Runs the setup on `organization.build` when `location === 'JM'` |
| `settings/JamaicaSettings.service.ts`, `dtos/JamaicaSettings.dto.ts` | Typed GCT settings and the organization TRN |
| `Jamaica.controller.ts` | `POST /jamaica/setup`, `GET/PUT /jamaica/settings` |

### Webapp

| File | Change |
|---|---|
| `containers/TaxRates/dialogs/TaxRateFormDialog/*` | **Tax type** select |
| `components/Contacts/TaxNumberFormGroup.tsx` (new), customer and vendor form sections and `utils.tsx` | **TRN** field (labelled "Tax number" when the Jamaica feature is off) |
| `containers/Preferences/Jamaica/JamaicaPreferences.tsx` (new), `routes/preferences.tsx`, `constants/preferencesMenu.tsx` | Preferences → **Jamaica (GCT)**: run or preview the setup, GCT registration fields, the TRN (read-only, edited in General). Shown when the Jamaica feature is on. |
| `hooks/query/jamaica/*` (new) | Query and mutation hooks |

### SDK (`shared/sdk-ts`)

Regenerated OpenAPI types. New `src/jamaica.ts`: `fetchJamaicaSettings`,
`editJamaicaSettings`, `runJamaicaSetup`.

## API changes

Additive only; see [../api/CHANGELOG.md](../api/CHANGELOG.md#m1-jamaica-setup-2026-10-21),
[tax-rates.md](../api/tax-rates.md), [contacts.md](../api/contacts.md),
[jamaica.md](../api/jamaica.md) and [settings.md](../api/settings.md).
**The invoice and estimate payloads used by the external sync are
unchanged**, and the new `tax.default_from_item` stays off.

## Running it

| Where | How |
|---|---|
| New organization | Build it with `location: "JM"`; the setup runs automatically |
| Existing organization (UI) | Preferences → Features → Jamaica Localization on, then Preferences → Jamaica (GCT) → **Run setup** |
| API | `POST /api/jamaica/setup` (`{"dry_run": true}` to preview) |
| CLI | `node packages/server/dist/cli.js tenants:jamaica-setup --tenant <orgId> \| --all [--dry-run]` |

## Test evidence

- Unit specs:
  - `ItemEntriesTaxTransactions.service.spec.ts` (3 cases: no date, version
    on date, fallback)
  - `database.constants.spec.ts`
  - full server unit suite passes
- `test/jamaica.e2e-spec.ts`: **11/11**:
  - setup ran on building the JM organization
  - GCT rates and types seeded, `TAX-*` defaults inactive, GCT-TEL/TOUR
    inactive
  - idempotent (second run creates and updates nothing)
  - dry run via query and via body
  - GCT settings saved, omitted fields kept
  - settings rejected while the feature is off
  - tax rate with type; unknown type gives 400
  - customer and vendor TRN stored
- Backward compatibility on the shared organization (feature off):
  - `customers.e2e` **5/5**, including "no tax number gives `tax_number: null`"
  - `tax-rates.e2e` **3/3**, including "no tax type gives `tax_type: null`"
  - `vendors.e2e` **4/4**
- Manual checks (JM organization "Kingston Trader"):
  - Setup report: 6 GCT rates, 6 versions, 4 parameters and 4 accounts
    created; renames applied; Loan re-slugged; Owner A Drawings inactive.
    A rerun reported nothing to change.
  - UI: Preferences → Jamaica (GCT) page, Preview changes (a dry run;
    see the bug below), TRN on the customer form, Tax type in the tax rate
    dialog.
- **Full server e2e suite on MAMP MySQL 5.7, one file per process: all
  62 suites pass** (including `jamaica`, `sale-invoices`, `bills`,
  `gl-sales`, `gl-purchases`, `payment-received`, `financial-statements`).
- Bug found and fixed after the first M1 commit: the invoice and bill
  transformers wrapped the dated rate lookup in a plain arrow function.
  `async/compose` only awaits functions declared `async`, so **creating or
  editing an invoice or bill hung** (fix: `2fb3c0054`). The baseline's
  `sale-invoices` and `payment-received` suites caught it.
- Bug found and fixed in testing: the SDK sends POST parameters as the
  body, so "Preview changes" first ran the **real** setup (harmless here,
  since it's idempotent). The endpoint now accepts `dry_run` in the body,
  and an e2e case covers it.

## Known limitations

- Rates and thresholds are seeded `verified = false`. There is no UI for
  rate versions or tax parameters yet; add them with SQL.
- The seeded rate versions start `2000-01-01`. The historical GCT rate
  changes were not researched.
- Tax rate import/export ignores `tax_type` (upstream's import/export
  metadata for tax rates is commented out).
- The e2e suite needs the pre-built `jm@example.com` organization; see
  [../setup/local-mamp.md](../setup/local-mamp.md).
- Upstream behaviour kept as is: editing a tax rate's rate, name or code
  deletes the row and inserts a new one, and its versions cascade-delete
  with it.
