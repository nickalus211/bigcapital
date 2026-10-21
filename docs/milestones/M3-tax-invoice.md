# M3: Tax Invoices

**Status:** complete.
**Branch:** `feat/jamaica-m1-setup-emcy21` (on top of M2).

## Scope

- **Compliance warnings** (GCT Act s.29) on invoices, returned by the API and
  shown in the invoice drawer. They never block a request.
- **Tax Invoice PDF** for a GCT-registered organization: title, supplier and
  customer TRNs, GCT registration number, GCT rate and amount per line,
  amounts excluding GCT.
- **Tax lines** on the receipt, credit note and estimate PDFs, and on the
  invoice, receipt, estimate and credit note emails. (Carried over from M2.)
- **Invoice and bill form previews** after the document discount. (Carried
  over from M2.)
- Bugs found on the way: credit note and manual journal numbering, the
  receipt PDF, and webapp edit totals.

Not in scope: blocking or locking non-compliant invoices (the requirements
document asks for it, but the API rules say warnings only), debit notes, and
warnings on credit notes.

## Design

- **Rules are pure.** `modules/Jamaica/tax-invoice/tax-invoice-rules.ts`
  takes the organization and the invoice and returns warnings, so it is unit
  tested without a database. `JamaicaTaxInvoiceService` loads the data
  around it.
- **Core calls the Jamaica module, and it is inert while the feature is
  off.** `GetSaleInvoice`, `SaleInvoiceApplication` (create and edit) and
  `SaleInvoicePdf` call `JamaicaTaxInvoiceService`. With the Jamaica feature
  off it returns `[]` and `{}` after one feature-flag read.
- **The templates gained generic props.** `bigtitle`, `companyTaxNumbers`,
  `customerTaxNumber` and `showLineTax` on the invoice template, and
  `taxes`/`showTaxes` on the others, default to the upstream output. Only
  the Jamaica service sets them.

## Changes

### Server

| File | Change |
|---|---|
| `modules/Jamaica/tax-invoice/tax-invoice-rules.ts` (new) | Warning codes, TRN check and formatting, rules |
| `modules/Jamaica/tax-invoice/JamaicaTaxInvoice.service.ts` (new) | Organization context, invoice warnings, Tax Invoice PDF attributes |
| `modules/Jamaica/Jamaica.module.ts` | Provides and exports the service |
| `modules/SaleInvoices/queries/GetSaleInvoice.service.ts`, `SaleInvoices.application.ts`, `SaleInvoices.module.ts`, `dtos/SaleInvoiceResponse.dto.ts` | `complianceWarnings` on get, create and edit |
| `modules/SaleInvoices/queries/SaleInvoicePdf.service.ts` | Merges the Tax Invoice attributes |
| `modules/TaxRates/document-pdf-tax.ts` (new) + receipt, credit note and estimate PDF services | Tax lines, total with tax, line amounts without tax |
| Invoice, receipt, estimate and credit note mail template transformers | `taxes` attribute |
| `modules/CreditNotes/commands/CommandCreditNoteDTOTransform.service.ts`, `modules/ManualJournals/commands/CreateManualJournal.service.ts` | `await` the next auto number |
| `modules/SaleReceipts/utils.ts` | Receipt PDF number, message and statement |

### Shared

| Package | Change |
|---|---|
| `pdf-templates` | Invoice: `bigtitle`, `companyTaxNumbers`, `customerTaxNumber`, `showLineTax` (+ labels). Receipt, credit note, estimate: `taxes`, `showTaxes`. |
| `email-components` | Invoice, receipt, estimate, credit note emails: `taxes` |
| `sdk-ts` | Regenerated (`complianceWarnings`) |

### Webapp

| File | Change |
|---|---|
| `containers/Drawers/InvoiceDetailDrawer/InvoiceComplianceWarnings.tsx` (new), `InvoiceDetailTab.tsx` | Warnings callout |
| `containers/Entries/DocumentTax.tsx` | `useAfterDiscountTaxRatio` |
| Invoice and bill form `utils.tsx` | Tax preview after the document discount |
| Invoice, bill, receipt, credit note, vendor credit, estimate form `utils.tsx` | Edit forms recompute line tax from the rate |
| `containers/Entries/utils.tsx` | `getEntriesTotal` treats empty amounts as 0 |

No migrations.

## API changes

See [../api/CHANGELOG.md](../api/CHANGELOG.md#m3-tax-invoices-2026-10-21)
and [../api/tax-invoice.md](../api/tax-invoice.md).

- **Additive:** `compliance_warnings` on the invoice get, create and edit
  responses (`[]` for non-Jamaica tenants).
- **Requests:** unchanged.

## Test evidence

- **Unit (server): 362/362** across 76 suites, including
  `tax-invoice-rules.spec.ts` (7 cases: TRN check and formatting, a
  compliant invoice, supplier details, invalid TRN, business vs individual
  customer, line warnings with line numbers, unregistered organization
  charging GCT).
- **`test/jamaica-tax-invoice.e2e-spec.ts`: 5/5:**
  - warnings on create and on get (customer address, customer TRN,
    line 2 without a rate)
  - none for a compliant invoice
  - an invalid customer TRN
  - Tax Invoice HTML: title, both TRNs, the GCT registration number,
    "Amount excl. GCT", the line's GCT 27.00
  - taxed receipt HTML: the tax line, the total 115.00, the receipt number
- **`test/tax-engine-compat.e2e-spec.ts`: 6/6** on the shared US
  organization, including two M3 cases: `compliance_warnings: []` on create
  and get, a plain "Invoice" PDF without TRNs, and credit notes numbered
  from the auto-increment.
- **`test/jamaica-gct.e2e-spec.ts`: 10/10** (M2, rerun).
- **Full server e2e suite**: see the table below.
- **Rendered output** (HTML endpoints, screenshotted in Chromium):
  - Tax Invoice INV-00014: subtotal excl. GCT 230.00 − discount 23.00 +
    GCT 24.30 = 231.30
  - credit note with GCT 27.00 and total 257.00
  - estimate and receipt with their GCT lines
- **Webapp in Chromium:**
  - the invoice drawer shows the warnings callout
  - the INV-00014 edit form previews GCT J$24.30 and a total of J$231.30,
    the same as the server. Before the fixes it showed J$2,298.87: the
    total bug, plus the discount applied twice.
- Webapp typecheck and lint clean (one existing unused-variable warning in
  `BillForm/utils.tsx`).

**Full server e2e suite: 65 files, 370/370 tests passed**, one file per
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
| `item-categories` 3/3 | `items` 13/13 | `jamaica-gct` 10/10 | `jamaica-tax-invoice` 5/5 |
| `jamaica` 11/11 | `manual-journal` 8/8 | `organization` 3/3 | `payment-links` 1/1 |
| `payment-received` 7/7 | `payment-services` 3/3 | `pdf-templates` 4/4 | `resource` 1/1 |
| `roles` 6/6 | `sale-estimates` 11/11 | `sale-invoices` 11/11 | `sale-receipts` 6/6 |
| `settings` 3/3 | `tax-engine-compat` 6/6 | `tax-rates` 3/3 | `transactions-locking` 6/6 |
| `users-invite` 1/1 | `users` 5/5 | `vendor-credits-apply-bill` 4/4 | `vendor-credits-refund` 3/3 |
| `vendor-credits` 4/4 | `vendors` 4/4 | `views` 1/1 | `warehouse-transfers` 7/7 |
| `warehouses` 5/5 |  |  |  |

## Known limitations

- Warnings cover invoices only. Credit notes that adjust a Tax Invoice don't
  yet reference it or carry warnings. Debit notes don't exist yet.
- An invoice isn't blocked or locked when it fails a rule.
- Tax Invoice layout: when amounts are tax-inclusive and there is a
  document discount, "Subtotal excl. GCT − Discount + GCT" doesn't add up to
  the total on the page, because the discount is shown including GCT. The
  total itself is right.
- The invoice drawer's line "Amount" column still shows the line including
  exclusive GCT (upstream).
- Emails and the receipt, credit note and estimate PDFs don't print TRNs or
  the "Tax Invoice" title.
- PDFs were checked as HTML. There is no Gotenberg here to render the PDF
  itself, but the PDF is built from the same HTML.
- The requirements document mentions sequential numbering. Bigcapital
  already auto-increments invoice numbers, but it accepts manual numbers and
  doesn't check for gaps.
