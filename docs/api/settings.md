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
| `tax.calc_after_discount` | boolean | `false` | Since M2: tax after line and document discounts, stored per line, on documents created or edited while on |
| `tax.extended_documents` | boolean | `false` | Since M2: tax on receipts, credit notes, vendor credits, expenses and estimates |
| `tax.default_from_item` | boolean | `false` | Since M2: lines that omit `tax_rate_id` use the item's default rate. **Opt-in; the Jamaica setup never sets it.** |
| `tax.input_tax_account_id` | number | unset | Since M2: account for input tax (the setup sets `gct-input-tax`). Tax Payable when unset. |
| `tax.output_tax_account_id` | number | unset | Since M2: account for output tax (the setup sets `tax-payable`). Tax Payable when unset. |
| `tax.withholding_account_id` | number | unset | Since M5: account debited with tax customers withheld from payments (the setup sets `wht-receivable`). When unset, the `wht-receivable` account, created if missing. |
| `jamaica.gct_registered` | boolean | `false` | Since M3: Tax Invoice PDF; switches the `compliance_warnings` checks ([tax-invoice.md](tax-invoice.md)) |
| `jamaica.gct_registration_number` | string | unset | Since M3: printed on Tax Invoices |
| `jamaica.gct_registration_date` | date | unset | |
| `jamaica.filing_frequency` | string | `monthly` | Stored only. The GCT return (M4) takes any period and defaults to last month. |
| `jamaica.apportionment_enabled` | boolean | `false` | Since M4: the GCT return claims input tax in proportion to taxable supplies ([gct-return.md](gct-return.md)) |
| `jamaica.setup_at` | string | unset | Written by the Jamaica setup |

How the `tax.*` options change each document: [document-tax.md](document-tax.md).
In the webapp they are under Preferences → Jamaica (GCT) → **Tax calculation**.

The typed endpoints `GET/PUT /api/jamaica/settings` ([jamaica.md](jamaica.md))
are the preferred way to read and write the `jamaica` group.
