# Jamaica endpoints

All routes need the usual `Authorization` and `organization-id` headers.

## `POST /api/jamaica/setup` (M1)

Configures the organization for a Jamaican sole trader. It is **idempotent**:
rows are matched by code, slug or key, and existing data is never
overwritten.

- Permission: Preferences → edit. It works while the Jamaica feature is off,
  and turns the feature on.
- It runs automatically when an organization is built with `location: "JM"`.

### What it does

| Area | Action |
|---|---|
| Tax rates | Adds `GCT-STD` 15% (standard), `GCT-ZERO` (zero_rated), `GCT-EXEMPT` (exempt), `GCT-OOS` (out_of_scope), `GCT-TEL` 25% and `GCT-TOUR` 10% (both inactive). Sets `tax_type` on an existing rate with one of these codes only if it has none. |
| Rate versions | One version per GCT rate, effective `2000-01-01`, `verified = false` |
| Default rates | Deactivates upstream's generic 0% rates (`TAX-SALES`, `TAX-PURCHASES`, `TAX-EXEMPT`, `TAX-IMPORTS`) while they're unused, unchanged and untyped |
| Tax parameters | `gct.registration_threshold` (J$10M until 2025-03-31, J$15M from 2025-04-01), `gct.registration_alert_ratio` (0.8), `gct.return_due`. All `verified = false`. |
| Accounts | Adds `gct-input-tax` (10011), `wht-receivable` (10012), `taj-penalties-interest` (40012) and `entertainment-disallowed` (40013). A code already in use is left empty. |
| Account names | `Tax Payable` becomes `GCT Payable (Output Tax)`, and `Owner's Equity` becomes `Owner's Capital`, only while they keep their default names |
| Duplicate slug | Re-slugs the default "Loan" account from `owner-drawings` to `loan`. Deactivates the liability "Owner A Drawings" while it has no transactions (drawings belong in the equity "Drawings" account). |
| Settings | Turns on `features.jamaica`, and sets `tax.calc_after_discount`, `tax.extended_documents`, `tax.input_tax_account_id`, `tax.output_tax_account_id` and `jamaica.filing_frequency` when unset. **Never** sets `tax.default_from_item`. |

### Request

```json
{ "dry_run": true }
```

The body is optional. `?dry_run=true` also works.

### Response

```json
{
  "dry_run": false,
  "created": ["tax_rate:GCT-STD", "account:gct-input-tax"],
  "updated": ["account:tax-payable:name", "setting:features.jamaica"],
  "skipped": ["tax_parameter:gct.return_due@2000-01-01"]
}
```

On a second run, `created` and `updated` are empty.

### CLI

```bash
cd packages/server
pnpm run build && node dist/cli.js tenants:jamaica-setup --tenant <organizationId> [--dry-run]
node dist/cli.js tenants:jamaica-setup --all
```

## `GET /api/jamaica/settings` (M1)

Fails with `JAMAICA_FEATURE_NOT_ENABLED` while the feature is off.

```json
{
  "gct_registered": true,
  "gct_registration_number": "GCT-000123",
  "gct_registration_date": "2025-01-15",
  "filing_frequency": "monthly",
  "apportionment_enabled": false,
  "trn": "123456789",
  "setup_at": "2026-10-21T05:32:22.482Z"
}
```

`trn` is the organization tax number. Edit it with `PUT /api/organization`
(`tax_number`) or in Preferences → General.

## `PUT /api/jamaica/settings` (M1)

Every field is optional. Omitted fields are unchanged, and `null` clears a
value. Returns the same body as `GET`.

```json
{
  "gct_registered": true,
  "gct_registration_number": "GCT-000123",
  "gct_registration_date": "2025-01-15",
  "filing_frequency": "monthly",
  "apportionment_enabled": false
}
```

| Field | Validation |
|---|---|
| `gct_registered`, `apportionment_enabled` | boolean |
| `gct_registration_number` | string |
| `gct_registration_date` | ISO date |
| `filing_frequency` | `monthly` |

## Tax Invoices (M3)

The `jamaica.gct_registered` and `jamaica.gct_registration_number` settings
above now drive the Tax Invoice PDF and the `compliance_warnings` returned
with invoices. See [tax-invoice.md](tax-invoice.md).

## `GET /api/jamaica/gct-return` (M4)

The GCT return for a period. See [gct-return.md](gct-return.md).
