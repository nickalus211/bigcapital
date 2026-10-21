# Settings

## `PUT /api/settings`

Saves tenant settings. Only keys declared in
`packages/server/src/constants/metable-options.ts` are accepted.

### New option (M0): `features.jamaica`

Request:

```json
{
  "options": [{ "group": "features", "key": "jamaica", "value": true }]
}
```

- Type: boolean. Default: `false`.
- Effect in M0: Jamaica-guarded endpoints become available. There are none yet;
  later milestones add them. The webapp shows Jamaica-only UI once the flag is on.
- Guarded endpoints called while the flag is off fail with error type
  `JAMAICA_FEATURE_NOT_ENABLED`.
- The webapp toggle is Preferences → Features → **Jamaica Localization**.

Before M0, the request above was rejected as an undeclared setting key.

### `tax` and `jamaica` groups (M1)

| Option | Type | Default | Effect |
|---|---|---|---|
| `tax.calc_after_discount` | boolean | `false` | M2: GCT is calculated after line discounts on new or edited documents |
| `tax.extended_documents` | boolean | `false` | M2: tax on receipts, credit notes, vendor credits, expenses and estimates |
| `tax.default_from_item` | boolean | `false` | M2: lines that omit tax use the item's default rate. **Opt-in; the Jamaica setup never sets it.** |
| `tax.input_tax_account_id` | number | unset | M2: account for input GCT (the setup sets `gct-input-tax`) |
| `tax.output_tax_account_id` | number | unset | M2: account for output GCT (the setup sets `tax-payable`) |
| `jamaica.gct_registered` | boolean | `false` | M3: Tax Invoice title and compliance warnings |
| `jamaica.gct_registration_number` | string | unset | M3: printed on Tax Invoices |
| `jamaica.gct_registration_date` | date | unset | |
| `jamaica.filing_frequency` | string | `monthly` | M4: GCT return period |
| `jamaica.apportionment_enabled` | boolean | `false` | M4: input tax apportionment |
| `jamaica.setup_at` | string | unset | Written by the Jamaica setup |

The typed endpoints `GET/PUT /api/jamaica/settings` ([jamaica.md](jamaica.md))
are the preferred way to read and write the `jamaica` group.
