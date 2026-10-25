# M5: Withholding tax

**Status:** complete.
**Branch:** `feat/jamaica-m1-setup-emcy21` (on top of M4).

## Scope

- **Payments received carry the tax the customer withheld**
  (`withholding_tax_amount`). The deposit account gets the amount less the
  withheld tax, and the withheld tax goes to Withholding Tax Receivable. The
  invoices are still settled in full.
- **Withholding tax certificates:** CRUD under `/api/jamaica/wht-certificates`.
- **Yearly summary** (`GET /api/jamaica/wht-summary`): per customer, the tax
  withheld from payments against the tax certified, the missing
  certificates, and the S04 line F24 credit.
- **Webapp:** "Tax withheld by customer" on the payment received form, and
  Reports → Taxes → **Withholding Tax**.

Not in scope: withholding on sale receipts (cash sales), withholding the
business itself must deduct from its suppliers, and the S04 itself (M8).

## Design

- **Withheld tax is part of the payment.** The customer owes the full
  invoice; it pays part to the trader and part to TAJ on the trader's
  behalf. So A/R is credited with the full `amount`, and the debit is split
  between the deposit account and the receivable:

  | Account | Dr | Cr |
  |---|---|---|
  | Deposit account | 970 | |
  | Withholding Tax Receivable | 30 | |
  | Accounts receivable | | 1,000 |

  Cash basis uses the same split, spread over the invoices paid by amount.
- **Generic core, Jamaica defaults.** The payment field and the
  `tax.withholding_account_id` setting live in the core payment and tax
  modules and work for any tenant. When the setting is unset, the
  `wht-receivable` account (seeded by the M1 setup) is used, or created. The
  account is only resolved for payments with withholding tax, so other
  payments post exactly as before.
- **Edits keep the stored value when the field is omitted**, so an API
  client that doesn't know the field can edit a payment without losing it.
- **Certificates are the claim.** The summary's S04 credit is the certified
  tax. Withheld tax without a certificate shows as "Certificate missing" and
  raises a warning.
- **Tax year:** calendar year. Payments count by date. Certificates count
  by `tax_year`, which defaults to the year of `period_to` (else of the
  certificate date), because certificates are often issued in January for
  the year before.
- **Pure calculator.** `wht-summary.calculator.ts` works out the summary
  from normalized lines; `WhtSummaryService` loads them.

## Changes

| Area | File | Change |
|---|---|---|
| Migration | `20261025100000_jm_add_withholding_tax_to_payment_receives.ts` | `payment_receives.withholding_tax_amount` decimal(13,2), nullable |
| Migration | `20261025100100_jm_create_wht_certificates_table.ts` | `wht_certificates` table |
| Server | `modules/PaymentReceived/dtos/PaymentReceived.dto.ts`, `types/*`, `models/PaymentReceived.ts` | Field, `depositAmount` and local virtual attributes |
| Server | `modules/PaymentReceived/commands/PaymentReceivedAccrualGL.ts`, `PaymentReceivedCashGL.ts`, `PaymentReceivedGLEntries.ts` | Split debit, withholding account |
| Server | `modules/PaymentReceived/commands/PaymentReceivedDTOTransformer.ts`, `PaymentReceivedValidators.service.ts` | `WITHHOLDING_TAX_EXCEEDS_AMOUNT` |
| Server | `modules/PaymentReceived/queries/PaymentReceivedTransformer.ts`, `dtos/PaymentReceivedResponse.dto.ts` | Formatted fields, OpenAPI |
| Server | `modules/TaxRates/TaxSettings.service.ts`, `TaxAccounts.service.ts`, `constants/metable-options.ts` | `tax.withholding_account_id`, `getWithholdingTaxAccountId` |
| Server | `modules/Jamaica/withholding/*` (new) | Certificate model, services, calculator |
| Server | `modules/Jamaica/dtos/WhtCertificate.dto.ts` (new), `Jamaica.controller.ts`, `Jamaica.module.ts` | Endpoints |
| Server | `modules/Jamaica/setup/JamaicaSetup.service.ts`, `data/*` | Sets the withholding account, seeds `wht.specified_services_rate` |
| SDK | `shared/sdk-ts/src/jamaica.ts` | `fetchWhtSummary`, certificate functions; regenerated schema |
| Webapp | `containers/Sales/PaymentsReceived/PaymentReceiveForm/*` | Field, 3% shortcut, deposit amount in the footer, validation |
| Webapp | `containers/FinancialStatements/WithholdingTax/WithholdingTax.tsx` (new) | The report page |
| Webapp | `routes/dashboard.tsx`, `constants/financialReportsMenu.tsx`, `constants/sidebarMenu.tsx`, `hooks/query/jamaica/*` | Route, menus, hooks |

## API changes

See [../api/CHANGELOG.md](../api/CHANGELOG.md#m5-withholding-tax-2026-10-25)
and [../api/withholding-tax.md](../api/withholding-tax.md). One optional
request field and new response fields on payments received, and new
Jamaica endpoints. Invoice and estimate sync is unchanged.

## Upgrading an existing organization

Run the migrations, then re-run the Jamaica setup (Preferences → Jamaica, or
`POST /api/jamaica/setup`). It adds `tax.withholding_account_id` and the
`wht.specified_services_rate` parameter and skips everything else.

## Test evidence

- **Unit (server): 376/376**, including:
  - `wht-summary.calculator.spec.ts` (3): withheld vs certified per
    customer, statuses and sort order, totals and the S04 credit, rounding,
    an empty year
  - `PaymentReceivedAccrualGL.spec.ts` (3, new): no withholding, the split,
    a foreign currency payment
  - `PaymentReceivedCashGL.spec.ts`: withholding spread over two invoices
- **`test/jamaica-withholding.e2e-spec.ts`: 5/5** on the JM organization,
  in a random future year:
  - a 10,000 payment with 300 withheld: deposit 9,700, receivable 300, A/R
    10,000, the invoice paid in full
  - an edit without the field keeps 300; `0` clears it and its ledger line
  - 101 withheld on a 100 payment is refused
  - certificates and the summary: withheld 450, certified 300, uncertified
    150, S04 credit 300, statuses, `CERTIFICATES_MISSING`; tax year from
    `period_to`; edit, delete, not found
  - the summary is refused for the US organization (Jamaica feature off)
- **`test/payment-received.e2e-spec.ts`: 8/8**, with a new compatibility
  case on the US organization: a payment without the field has
  `withholding_tax_amount: null`, `deposit_amount` equal to `amount`, and
  the full amount on the deposit account.
- **Manual check** on the JM organization: payment PAY-00001 (1,000, 30
  withheld) posts Dr Undeposited Funds 970, Dr Withholding Tax Receivable
  30, Cr A/R 1,000 on the accrual basis, and Cr income 1,000 on the cash
  basis; both bases balance.
- **Webapp:** typecheck and lint clean. In Chromium, the payment form shows
  the field, the 3% shortcut and the deposit amount, and saving sent
  `withholding_tax_amount: 25`. The Withholding Tax page showed the 2026
  summary, and adding a certificate from it turned the customer to
  "Certified" with an S04 credit of J$25.00.

**Full server e2e suite: 67 files, 380/380 tests passed**, one file per
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
| `item-categories` 3/3 | `items` 13/13 | `jamaica-gct-return` 3/3 | `jamaica-gct` 10/10 |
| `jamaica-tax-invoice` 5/5 | `jamaica-withholding` 5/5 | `jamaica` 11/11 | `manual-journal` 8/8 |
| `organization` 3/3 | `payment-links` 1/1 | `payment-received` 8/8 | `payment-services` 3/3 |
| `pdf-templates` 4/4 | `resource` 1/1 | `roles` 6/6 | `sale-estimates` 11/11 |
| `sale-invoices` 11/11 | `sale-receipts` 6/6 | `settings` 3/3 | `tax-engine-compat` 7/7 |
| `tax-rates` 3/3 | `transactions-locking` 6/6 | `users-invite` 1/1 | `users` 5/5 |
| `vendor-credits-apply-bill` 4/4 | `vendor-credits-refund` 3/3 | `vendor-credits` 4/4 | `vendors` 4/4 |
| `views` 1/1 | `warehouse-transfers` 7/7 | `warehouses` 5/5 |  |

## Known limitations

- **Bank matching** against an invoice creates a payment for the bank
  amount with no withholding tax, so a bank deposit of 970 can't settle a
  1,000 invoice with 30 withheld. Record the payment with the withheld tax
  in the payment form instead, and exclude the bank line.
- Sale receipts (cash sales) have no withholding field.
- Certificates aren't linked to payments; the summary compares totals per
  customer and year.
- Deleting a customer with certificates leaves the certificates.
- The 3% rate, the payment threshold and the list of specified services are
  unverified, and the webapp shortcut always offers 3% of the amount.
