# API changelog

Newest first. Every entry is backward compatible unless it is marked
**BREAKING**, and none are.

## M5: Withholding tax (2026-10-25)

Details and examples: [withholding-tax.md](withholding-tax.md). Additive
only.

### Payments received: new optional request field `withholding_tax_amount`
- Tax the customer withheld from the payment. The deposit account is debited
  with `amount − withholding_tax_amount` and the withheld part with
  `tax.withholding_account_id` (else the `wht-receivable` account). A/R is
  still credited with the full `amount`.
- Omitted on create: no withholding, identical to before. Omitted on edit:
  the stored value is kept. `0` or `null` clears it.
- New error `WITHHOLDING_TAX_EXCEEDS_AMOUNT` (400), only when the field is
  sent above the amount.

### Payments received: new response fields
- `withholding_tax_amount` (`null` when none), `deposit_amount`,
  `local_deposit_amount`, `local_withholding_tax_amount`,
  `formatted_withholding_tax_amount` (`""` when none),
  `formatted_deposit_amount`. On every payment; without withholding,
  `deposit_amount` equals `amount`.

### New endpoints (Jamaica feature)
- `GET|POST /api/jamaica/wht-certificates`,
  `GET|PUT|DELETE /api/jamaica/wht-certificates/:id`: withholding tax
  certificates.
- `GET /api/jamaica/wht-summary?year=`: withheld vs certified tax per
  customer and the S04 line F24 credit.

### Settings and setup
- New setting `tax.withholding_account_id`. The Jamaica setup sets it to
  the `wht-receivable` account and seeds the `wht.specified_services_rate`
  tax parameter (3, unverified). Re-run `POST /api/jamaica/setup` on
  organizations set up before M5; it only adds what is missing.

### Migrations
- `payment_receives.withholding_tax_amount` (nullable).
- New table `wht_certificates`.

### Invoice and estimate sync
No change. Payment sync is unchanged unless it sends the new field.

## M4: GCT return (2026-10-22)

Details: [gct-return.md](gct-return.md). Additive only.

### New endpoint `GET /api/jamaica/gct-return`
- Query: `from_date`, `to_date` (default: last month).
- Returns supplies by tax type, output tax, input tax, the input tax
  apportionment, net GCT (payable or refundable), the due date and filing
  warnings.
- Needs the Jamaica feature (`JAMAICA_FEATURE_NOT_ENABLED` otherwise) and
  the sales tax liability report permission.

### Settings
- `jamaica.apportionment_enabled` now takes effect in the GCT return.

### Invoice and estimate sync
No change.

## Fix: estimate adjustment (2026-10-22)

Applies to every tenant.

- **Estimate `total` adds the `adjustment`.** The server used to subtract
  it, while the webapp form added it. The total isn't stored, so every
  estimate with an adjustment now returns the corrected total, saved ones
  included.

| Estimate | Before | After |
|---|---|---|
| subtotal 100, discount 5, adjustment 10 | `total: 85` | `total: 105` |
| no adjustment | unchanged | unchanged |

Affects `GET /api/sale-estimates/:id`, the list endpoint, and the estimate
PDF and email totals. Invoices made from an estimate were never affected,
because they compute their own totals.

## M3: Tax Invoices (2026-10-21)

Details and examples: [tax-invoice.md](tax-invoice.md). Additive only;
nothing blocks a request.

### Invoices: new response field `compliance_warnings`
- On `POST`, `PUT` and `GET /api/sale-invoices/:id`: an array of
  `{ code, message, lines? }` saying what the invoice is missing to qualify
  as a Tax Invoice (GCT Act s.29). Always present. `[]` while the Jamaica
  feature is off. Not on the list endpoint.

### PDFs and emails
- Invoice PDF/HTML for a GCT-registered organization: "Tax Invoice" title,
  supplier and customer TRNs, GCT registration number, GCT % and GCT per
  line, amounts excluding GCT.
- Taxed receipts, credit notes and estimates (`tax.extended_documents`)
  print their tax lines and their total with tax.
- Invoice, receipt, estimate and credit note emails list the tax lines.

### Webapp only
- With `tax.calc_after_discount` on, the invoice and bill forms preview tax
  after the document discount. Edit forms recompute line tax from the rate.
  The API is unchanged.

### Fixes that apply to every tenant
- **Credit notes and manual journals created without a number** were saved
  with the number `"{}"`. They now take the next auto-increment number.
- **Receipt PDF** printed a placeholder number and sample notes.
- **Webapp:** an invoice, bill, receipt, credit note or estimate opened for
  editing showed a wrong total until a line was changed (the empty line's
  amount was added as text, so 230 became "2300"). Saved figures were never
  affected.

### Invoice and estimate sync
Requests are unchanged. Invoice responses gain `compliance_warnings`.

## M2: GCT engine (2026-10-21)

Details and before/after examples: [document-tax.md](document-tax.md).
Requests are unchanged or gain optional fields. Responses gain fields. Two
fixes change numbers for every tenant (last section).

### Invoices and bills
- With `tax.calc_after_discount` on, tax is charged after the line discount
  and the line's share of the document discount, rounded to cents per line.
  Only documents created or edited while the setting is on are affected.
- New response fields on every item entry: `taxable_amount` and
  `line_tax_amount` (`null` when not stored, e.g. every line saved before M2).
- Output tax posts to `tax.output_tax_account_id` and input tax to
  `tax.input_tax_account_id` (Tax Payable when unset), including the cash
  basis entries of payments received and bill payments.
- With `tax.default_from_item` on, a line that omits `tax_rate_id` and
  `tax_code` takes the item's sell or purchase tax rate. `tax_rate_id: null`
  still means no tax. **Off by default; the Jamaica setup leaves it off.**

### Sale receipts, credit notes, vendor credits, estimates
- New optional request field `is_inclusive_tax`. The existing
  `entries[].tax_rate_id` / `entries[].tax_code` take effect while
  `tax.extended_documents` is on. While it is off, both are ignored as before.
- New response fields: `is_inclusive_tax`, `tax_amount_withheld` (`null` when
  untaxed), `tax_amount_withheld_formatted`, `taxes[]`, and
  `entries[].taxable_amount` / `line_tax_amount`.
- `total` includes exclusive tax. Taxed receipts, credit notes and vendor
  credits post tax lines to the ledger.
- Credit notes and vendor credits: `credits_remaining` and the open/closed
  filters include exclusive tax on taxed credits.

### Expenses
- New optional request fields `is_inclusive_tax` and
  `categories[].tax_rate_id`, used while `tax.extended_documents` is on.
- New response fields: `is_inclusive_tax`, `tax_amount_withheld`,
  `tax_amount_withheld_formatted`, and on categories `tax_rate_id`,
  `tax_rate`, `taxable_amount`, `line_tax_amount`, `tax_amount`,
  `amount_excluding_tax`.
- `total_amount` is the amount paid, so it includes exclusive tax.

### Settings
The `tax.*` options from M1 now take effect: see
[settings.md](settings.md#tax-and-jamaica-groups-m1).

### Fixes that apply to every tenant
- **Invoice `taxes[].tax_rate_amount`** is the sum of the tax on the lines at
  that rate. It used to be the rate applied to the whole subtotal, which
  overstated it when some lines were untaxed. `taxes[].tax_rate` is the rate
  stored with the document.
- **Invoice `balance`, `subtotal` and `total` subtract line discounts**, as
  bills already did. Invoices with a line discount used to post an
  unbalanced journal. Invoices without line discounts are unchanged, and
  saved invoices keep their stored balance until they are edited.

### Invoice and estimate sync
An integration that sends no tax and no line discounts sees no change, as
long as `tax.default_from_item` stays off. If it sends line discounts on
invoices, see the balance fix above.

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
