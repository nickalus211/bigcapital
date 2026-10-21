# M2: GCT engine

**Status:** complete.
**Branch:** `feat/jamaica-m1-setup-emcy21` (on top of M1).

## Scope

Turn on the `tax.*` settings stored in M1:

- **Tax after discounts** (`tax.calc_after_discount`): GCT on the line after
  its discount and its share of the document discount, rounded to cents per
  line and stored on the line.
- **Tax on more documents** (`tax.extended_documents`): sale receipts, credit
  notes, vendor credits, estimates and expenses, with inclusive or exclusive
  amounts, ledger entries and tax lines in the API.
- **Input and output tax accounts** (`tax.input_tax_account_id`,
  `tax.output_tax_account_id`), including cash basis payments.
- **Default tax rate from the item** (`tax.default_from_item`), opt-in.
- **Fixes**: tax line amounts on invoices and bills, and invoice balances
  with line discounts.

Compliance warnings and the "Tax Invoice" PDF are M3.

## Design

- **Stored, not derived.** With `calc_after_discount` on, each line stores
  `taxable_amount` and `line_tax_amount`. `ItemEntry.taxAmount` returns the
  stored value when there is one and otherwise derives it from the rate as
  upstream does. Every existing line has `null`, so saved documents keep
  their figures until someone edits them.
- **One calculator.** `ItemEntriesTaxCalculator.ts` holds the pure maths
  (net line amount, document discount ratio, inclusive or exclusive tax,
  cents rounding). The invoice, bill, receipt, credit note, vendor credit
  and estimate transformers and the expense transformer all call it.
- **Off means upstream.** `ExtendedDocumentsTaxService` returns `null` while
  `tax.extended_documents` is off, and the transformers then build the
  untaxed document exactly as before. Ledger tax lines are added only to
  documents that have a `tax_amount_withheld`, and the tax account is looked
  up only for those, so no Tax Payable account is created for untaxed
  documents.
- **Creditable amount.** Taxed credit notes and vendor credits can be applied
  up to `amount + exclusive tax`. A model getter (`creditAmount`) and the SQL
  status filters (`CREDIT_AMOUNT_SQL`) use the same expression.

## Changes

### Migrations (`packages/server/src/database/tenant/migrations/`)

| File | Change |
|---|---|
| `20261022100000_jm_add_tax_amounts_to_items_entries` | `items_entries.taxable_amount`, `line_tax_amount` (decimal 13,3, nullable) |
| `20261022100100_jm_add_tax_to_extended_documents` | `is_inclusive_tax` and `tax_amount_withheld` on `sales_receipts`, `credit_notes`, `vendor_credits`, `sales_estimates`, `expenses_transactions`; `tax_rate_id`, `tax_rate`, `taxable_amount`, `line_tax_amount` on `expense_transaction_categories` |

Both are additive and need no backfill.

### Server: tax (`modules/TaxRates/`)

| File | Purpose |
|---|---|
| `ItemEntriesTaxCalculator.ts` (new) | Pure tax maths, unit tested |
| `TaxSettings.service.ts` (new) | Typed reader for the `tax.*` settings |
| `TaxAccounts.service.ts` (new) | Output or input tax account, falling back to Tax Payable |
| `ExtendedDocumentsTax.service.ts` (new) | Validates, calculates and writes tax for the extra documents and expenses |
| `subscribers/WriteExtendedDocumentsTaxTransactionsSubscriber.ts` (new) | `tax_rate_transactions` for receipts, credit notes, vendor credits, estimates, expenses |
| `ItemEntriesTaxTransactions.service.ts` | `assocDefaultTaxRateFromItems`, `assocEntriesTaxAmounts`, `transformEntriesTax`; `tax_amount_withheld` resets to 0 when stored amounts say so |
| `TaxRate.module.ts` | Registers and exports the above; imports `AccountsModule` |

### Server: documents

| Area | Files | Change |
|---|---|---|
| Item entries | `TransactionItemEntry/models/ItemEntry.ts` | `taxableAmount`, `lineTaxAmount`; stored tax wins in `taxAmount` |
| Invoices | `CommandSaleInvoiceDTOTransformer.service.ts`, `ledger/InvoiceGLEntries.ts`, `queries/SaleInvoiceTaxEntry.transformer.ts`, `SaleInvoice.transformer.ts`, `GetInvoicePaymentLink.transformer.ts` | Tax pipeline, output account, per-rate tax line from the lines, balance net of line discounts |
| Bills | `BillDTOTransformer.service.ts`, `BillsGLEntries.ts`, `Bill.transformer.ts`, `Bills.module.ts` | Tax pipeline, input account |
| Payments | `PaymentReceivedGLEntries.ts`, `BillPaymentGLEntries.ts` and their modules | Cash basis tax to the output/input account |
| Receipts, credit notes, vendor credits, estimates | `dtos/*.dto.ts`, `*DTOTransform*.ts`, `models/*.ts`, `*GL*.ts`, `queries/*Transformer.ts`, `queries/Get*.service.ts`, `dtos/*Response.dto.ts`, `*.module.ts`; `Edit{CreditNote,VendorCredit}.service.ts` | `isInclusiveTax`, totals with exclusive tax, ledger tax lines, `taxes[]`, creditable amount |
| Expenses | `dtos/Expense*.ts`, `models/Expense*.ts`, `CommandExpenseDTO.transformer.ts`, `subscribers/ExpenseGL*.ts`, `queries/Expense.transformer.ts`, `Expenses.module.ts` | Category tax, input tax ledger line, `total_amount` incl. exclusive tax |

### Webapp

| File | Change |
|---|---|
| `containers/Entries/DocumentTax.tsx` (new) | Settings and tax rates hooks, inclusive/exclusive select, tax total lines with the document discount applied |
| Receipt, credit note, vendor credit and estimate forms (`utils.tsx`, entries editor, footer) | Tax rate column, inclusive/exclusive select, tax lines and total while `tax.extended_documents` is on |
| Expense form (`types.ts`, `utils.tsx`, `components.tsx`, `ExpenseFormEntries*.tsx`, `ExpenseFormFooterRight.tsx`) | Same, on expense categories. Defaults to inclusive. |
| `containers/Entries/components.tsx` | The tax column follows settings that load after the first render |
| `containers/Preferences/Jamaica/TaxCalculationCard.tsx` (new) | Preferences → Jamaica (GCT) → **Tax calculation** |
| `hooks/query/settings/*` | `useSettingsTax` |

### SDK

Regenerated OpenAPI types; `fetchSettingsTax`.

## API changes

See [../api/CHANGELOG.md](../api/CHANGELOG.md#m2-gct-engine-2026-10-21) and
[../api/document-tax.md](../api/document-tax.md) for before/after examples.

In short:
- **Requests:** new optional `is_inclusive_tax` on receipts, credit notes,
  vendor credits, estimates and expenses, and `categories[].tax_rate_id` on
  expenses. Nothing else changes.
- **Responses:** new fields only.
- **Sync:** an integration that sends no tax and no line discounts sees no
  change, as long as `tax.default_from_item` stays off.
- **Every tenant:** invoice `taxes[].tax_rate_amount` now sums the lines at
  each rate, and invoice balances now subtract line discounts.

## Test evidence

Environment: MariaDB 10.6 and Redis 7 in Docker, Node 22. See
[../setup/local-mamp.md](../setup/local-mamp.md#without-mamp-docker).

- **Unit (server): 355/355** across 75 suites, including
  `ItemEntriesTaxCalculator.spec.ts` (9 cases) and the new
  `ItemEntriesTaxTransactions.service.spec.ts` cases: default rate from the
  item (omitted vs `null` vs explicit), stored amounts on and off.
- **`test/jamaica-gct.e2e-spec.ts`: 10/10** on the JM organization:
  - invoice: GCT after line and document discounts (24.30), stored line
    amounts, `taxes[]`, balanced journal, output account
  - invoice edit that removes the tax resets `tax_amount_withheld` to 0
  - bill: input GCT on the GCT Input Tax account
  - receipt (257 = 230 + 27), credit note (credits remaining 257), vendor
    credit (inclusive, 15 of 115), estimate, expense (inclusive 1,150 →
    1,000 + 150): totals, balanced journals, tax accounts
  - default rate from the item: off leaves the line untaxed; on fills an
    omitted rate and leaves `tax_rate_id: null` untaxed
- **`test/tax-engine-compat.e2e-spec.ts`: 4/4** on the shared organization
  (all `tax.*` off): tax still on the pre-discount amount with no stored
  line tax; line-discount invoice balanced (balance 180); tax line sums the
  taxed lines only; receipt tax ignored (total 100, `tax_amount_withheld`
  null, two ledger lines).
- **Full server e2e suite**, one file per process: see the table below.
- **Webapp:** typecheck and lint clean. Checked in Chromium against the
  running API:
  - JM organization: receipt, credit note and expense forms show the tax
    rate column and the inclusive/exclusive select.
  - A receipt entered in the form previewed GCT J$15.00 and a total of
    J$115.00, and saved with `tax_amount_withheld` 15 and the line's tax
    stored.
  - The Tax calculation card loads and saves the settings.
  - US organization: the receipt form is unchanged.

**Full server e2e suite: 64 files, 363/363 tests passed**, one file per
process, with no Jest retries used:

| | | | |
|---|---|---|---|
| `accounts` 10/10 | `api-keys` 2/2 | `attachments` 1/1 | `auth` 3/3 |
| `balance-sheet` 41/41 | `bank-rules` 5/5 | `banking-accounts` 2/2 | `banking-categorize` 3/3 |
| `banking-exclude` 5/5 | `banking-matching` 3/3 | `banking-pending` 1/1 | `banking-recognized` 2/2 |
| `banking-transactions` 3/3 | `banking-uncategorized` 3/3 | `bill-landed-costs` 9/9 | `bill-payments` 8/8 |
| `bills` 9/9 | `branches` 5/5 | `cash-flow-statement-beginning` 2/2 | `cash-flow-statement` 3/3 |
| `contacts` 3/3 | `credit-note-refunds` 1/1 | `credit-notes-apply-invoice` 1/1 | `credit-notes` 4/4 |
| `currencies` 5/5 | `customers` 5/5 | `dashboard` 3/3 | `expenses` 5/5 |
| `export` 1/1 | `financial-statements` 20/20 | `gl-accounting-basis` 17/17 | `gl-purchases` 10/10 |
| `gl-sales` 13/13 | `import` 1/1 | `inventory-adjustment` 5/5 | `inventory-cost` 1/1 |
| `item-categories` 3/3 | `items` 13/13 | `jamaica-gct` 10/10 | `jamaica` 11/11 |
| `manual-journal` 8/8 | `organization` 3/3 | `payment-links` 1/1 | `payment-received` 7/7 |
| `payment-services` 3/3 | `pdf-templates` 4/4 | `resource` 1/1 | `roles` 6/6 |
| `sale-estimates` 11/11 | `sale-invoices` 11/11 | `sale-receipts` 6/6 | `settings` 3/3 |
| `tax-engine-compat` 4/4 | `tax-rates` 3/3 | `transactions-locking` 6/6 | `users-invite` 1/1 |
| `users` 5/5 | `vendor-credits-apply-bill` 4/4 | `vendor-credits-refund` 3/3 | `vendor-credits` 4/4 |
| `vendors` 4/4 | `views` 1/1 | `warehouse-transfers` 7/7 | `warehouses` 5/5 |

## Known limitations

- **PDFs and emails:** only the invoice template prints tax lines. A taxed
  receipt, credit note or estimate PDF shows a total that includes tax but no
  tax line. Moved to M3 (Tax Invoice).
- **Invoice and bill form preview:** these forms still preview tax the
  upstream way, before the document discount. The saved figures are right.
  The new document forms apply the document discount in their preview.
- **Sales Tax Liability Summary** reads Tax Payable accounts only. Input GCT
  on the GCT Input Tax asset account doesn't appear there. M4 (GCT return)
  reports both.
- **Upstream behaviour kept:**
  - A credit note or vendor credit's creditable amount ignores its document
    discount and adjustment.
  - An expense category's `unallocated_cost_amount` uses the amount with tax.
  - **The estimate `total` subtracts the adjustment on the server**, while
    the webapp adds it. If your quote sync sends `adjustment`, the stored
    total is wrong. This is upstream behaviour and M2 doesn't change it. Ask
    if you want it fixed.
- Turning `tax.calc_after_discount` off again leaves the stored line tax on
  documents saved while it was on, until they are edited.
