# API changelog

Newest first. Every entry is backward compatible unless it is marked
**BREAKING**, and none are.

## M1: Jamaica setup (2026-10-21)

All changes are additive. The invoice and estimate endpoints used by the
external sync are unchanged.

### Tax rates: new optional `tax_type`
- `POST /api/tax-rates` and `PUT /api/tax-rates/:id` accept
  `tax_type`: `standard` | `zero_rated` | `exempt` | `out_of_scope` | `null`.
  - Omitted on create: `null` (unclassified, same as before).
  - Omitted on edit: the stored value is kept.
  - Any other value: `400`.
- Tax rate responses include `tax_type` (`null` for unclassified rates).
- Changing only `tax_type` patches the rate in place. A rate, name or code
  change still creates a new tax rate, as before.
- Details: [tax-rates.md](tax-rates.md).

### Customers and vendors: new optional `tax_number`
- `POST`/`PUT /api/customers` and `/api/vendors` accept `tax_number`
  (string, the Jamaican TRN). Omitted: unchanged. `null` or `""`: cleared.
- Customer and vendor responses include `tax_number` (`null` when unset).
- Details: [contacts.md](contacts.md).

### New Jamaica endpoints
- `POST /api/jamaica/setup`: runs the idempotent Jamaica setup. Returns
  `{ dry_run, created[], updated[], skipped[] }`. For a dry run, pass
  `dry_run: true` in the body, or `?dry_run=true`. Works while the Jamaica
  feature is off, and turns it on.
- `GET /api/jamaica/settings` and `PUT /api/jamaica/settings`: GCT
  registration settings and the organization TRN. Fail with
  `JAMAICA_FEATURE_NOT_ENABLED` while the feature is off.
- Details: [jamaica.md](jamaica.md).

### Settings: new `tax` and `jamaica` groups
`PUT /api/settings` accepts:
- `tax.calc_after_discount`, `tax.extended_documents`, `tax.default_from_item`
  (booleans, default `false`)
- `tax.input_tax_account_id`, `tax.output_tax_account_id` (numbers)
- `jamaica.gct_registered`, `jamaica.gct_registration_number`,
  `jamaica.gct_registration_date`, `jamaica.filing_frequency`,
  `jamaica.apportionment_enabled`, `jamaica.setup_at`

The `tax.*` settings take effect in M2. Until then they're stored only.
`tax.default_from_item` is never turned on by the setup; it stays opt-in for
the external sync.

### Invoices and bills: rate as of the document date
When a tax rate has dated versions (`tax_rate_versions`, seeded by the
Jamaica setup), invoice and bill lines use the version effective on the
invoice or bill date. Rates without versions behave exactly as before.
Requests are unchanged.

## M0: Foundation (2026-10-20)

### `GET /api/dashboard/boot`: new response field `hidden_modules`
- Type: `string[]`, always present, defaults to `[]`.
- Source: the server env `HIDDEN_MODULES` (comma-separated, lower-cased),
  e.g. `stripe,subscription,workspaces`.
- Used by the webapp to hide menu entries. **Server routes are not disabled.**
- Details: [dashboard.md](dashboard.md).

### `PUT /api/settings`: new option `features.jamaica`
- Boolean, default `false`. Turns on the Jamaica localization. In M0 the flag
  only gates `JamaicaFeatureGuard`; later milestones attach behaviour to it.
- `GET /api/dashboard/boot` lists it in `features[]` as
  `{ "name": "jamaica", "is_accessible": false, "default_accessible": false }`.
- New error type for guarded Jamaica endpoints (none exist yet in M0):
  `JAMAICA_FEATURE_NOT_ENABLED`.
- Details: [settings.md](settings.md).

### Invoice and estimate sync
No change. Invoice and estimate endpoints are untouched in M0.
