# M6: Customs entries

**Status:** complete.
**Branch:** `feat/jamaica-m1-setup-emcy21` (on top of M5).

## Scope

- **Customs entries (C78)** under `/api/jamaica/customs-entries`, with a
  `calculate` endpoint that works an entry out without saving it:
  - CIF from FOB, freight and insurance
  - Customs Duty from the tariff rate, SCF 0.3% and EPL 0.5% of CIF
  - ASD, SCT and CAF as given
  - import GCT 15% and advance GCT 5% of CIF + CD + SCF + EPL + ASD + SCT
  - any computed amount can be replaced by the C78 figure
- **Landed cost:** the duties and fees are added to the cost of the goods on
  the linked bill, spread over its inventory lines by value or quantity.
- **GCT:** import GCT is input tax and advance GCT is a credit on the GCT
  return.
- **Webapp:** Purchases → **Customs Entries** (list and live-calculating
  form), and the import GCT and advance GCT lines on the GCT Return page.

Not in scope: customs entries in a foreign currency (amounts are entered in
JMD at the customs rate), freight and insurance invoices (record them as
bills and allocate them with the upstream landed cost screen), brokers'
fees, and the SCT rate tables (M12).

## Design

- **Reuse the upstream landed cost engine.** Bigcapital already moves a
  cost into inventory: an expense line flagged `landed_cost` is allocated to
  a bill's lines. That writes `LandedCost` GL entries (Dr Inventory, Cr the
  expense account), inventory transactions, and recomputes the items'
  average cost. A customs entry creates that expense and allocation itself,
  so the duties reach the inventory valuation and COGS. In the manual check,
  a Widget bought at 5,000 had an average cost of 6,294.44 after the entry.
- **Three postings, one transaction:**

  | Posting | Dr | Cr |
  |---|---|---|
  | Expense (duties and fees) | Customs Duties & Fees 23,300 | Bank 23,300 |
  | Landed cost (to the bill) | Inventory 12,944.44 + 10,355.56 | Customs Duties & Fees 23,300 |
  | `CustomsEntry` (taxes) | GCT Input Tax 18,120; Advance GCT 6,040 | Bank 24,160 |

  The taxes post separately because expense lines can only use expense
  accounts. The landed cost allocate and revert services now accept an
  outer transaction (an optional `trx`), so all three post or none do.
  Editing reverses all three and posts them again. Without a bill, the
  duties stay on Customs Duties & Fees, a cost of goods sold account.
- **The C78 decides.** The calculator suggests every amount, but whatever
  amount is sent is stored and posted. Amounts that differ from the
  computed ones are reported in `overrides`.
- **Rates are data.** `customs.*` tax parameters are seeded as unverified,
  and built-in defaults are used where a parameter is missing.
- **Separate Nest module** (`JamaicaCustomsModule`). `JamaicaModule` is
  imported by the sales modules, so it can't depend on expenses and landed
  costs without an import cycle.
- **Guard:** deleting an expense that a customs entry posted is refused.
  The listener sets `suppressErrors: false`, which Nest needs before a
  listener can block an operation.

## Upstream fix

`BaseLandedCostService.validateAllocateCostItems` compared the lists the
wrong way round. It refused an allocation unless it listed every line of
the bill, and it accepted line ids from other bills. Customs entries
allocate to inventory lines only, which surfaced it. Now any subset of the
bill's lines is accepted and foreign lines are refused. See the changelog's
"Fixes that apply to every tenant".

## Changes

| Area | File | Change |
|---|---|---|
| Migration | `20261026100000_jm_create_customs_entries_table.ts` | `customs_entries` |
| Server | `modules/Jamaica/customs/customs-entry.calculator.ts` (new) | Duties, taxes, allocation by weight |
| Server | `modules/Jamaica/customs/CustomsEntries.service.ts` (new) | Calculate, CRUD, post and unpost |
| Server | `modules/Jamaica/customs/CustomsEntryGL.ts`, `CustomsAccounts.service.ts`, `CustomsExpenseGuard.subscriber.ts`, `models/CustomsEntry.model.ts`, `CustomsEntries.controller.ts`, `JamaicaCustoms.module.ts` (new) | Ledger, accounts, expense guard, model, endpoints, module |
| Server | `modules/Jamaica/dtos/CustomsEntry.dto.ts` (new) | DTOs (OpenAPI) |
| Server | `modules/Jamaica/gct-return/*`, `dtos/GctReturn.dto.ts` | Import GCT and the advance GCT credit |
| Server | `modules/Jamaica/data/*`, `setup/JamaicaSetup.service.ts` | Accounts, rate parameters, `features.landed_cost` |
| Server | `modules/EE/BillLandedCosts/BaseLandedCost.service.ts`, `commands/AllocateLandedCost.service.ts`, `commands/RevertAllocatedLandedCost.service.ts` | Optional `trx`; allocation items fix |
| Server | `modules/Expenses/Expenses.module.ts`, `EE/BillLandedCosts/BillLandedCosts.module.ts`, `App/App.module.ts` | Exports, module registration |
| Server | `modules/BankingTransactions/constants.ts`, `i18n/en/transaction_type.json` | "Customs Entry" transaction type label |
| SDK | `shared/sdk-ts/src/jamaica.ts` | Customs entry functions; regenerated schema |
| Webapp | `containers/Purchases/CustomsEntries/CustomsEntries.tsx` (new) | The page |
| Webapp | `containers/FinancialStatements/GctReturn/GctReturn.tsx` | Import GCT and advance GCT lines |
| Webapp | `routes/dashboard.tsx`, `constants/sidebarMenu.tsx`, `hooks/query/jamaica/*` | Route, menu, hooks |

## API changes

See [../api/CHANGELOG.md](../api/CHANGELOG.md#m6-customs-entries-2026-10-25)
and [../api/customs-entries.md](../api/customs-entries.md). New Jamaica
endpoints, additive GCT return fields, the expense delete guard, and the
landed cost fix. Invoice and estimate sync is unchanged.

## Upgrading an existing organization

Run the migrations, then re-run the Jamaica setup. It adds the two accounts
and the rate parameters and turns on landed costs. If the setup isn't
re-run, the accounts are created on first use and the default rates are
used.

## Test evidence

- **Unit (server): 387/387**, including:
  - `customs-entry.calculator.spec.ts` (7): the worked example, ASD and SCT
    in the GCT base but not CAF, C78 overrides, cents rounding, and
    allocation by weight (rounding, by value, no weight)
  - `gct-return.calculator.spec.ts` (+3): import GCT in input tax with the
    advance credit, apportionment of import GCT, nothing changes without
    imports
  - `BaseLandedCost.service.spec.ts` (+1): allocating to some of a bill's
    lines
- **`test/jamaica-customs.e2e-spec.ts`: 9/9** on the JM organization, in a
  random future month, using a bill of 10 widgets at 5,000, 5 gadgets at
  8,000 and a 1,000 service:
  - calculate: CIF 100,000, CD 20,000, SCF 300, EPL 500, import GCT 18,120,
    advance GCT 6,040, duties 23,300, total 47,460; allocation 12,944.44
    and 10,355.56, none on the service
  - create: expense, landed cost and `CustomsEntry` legs on the right
    accounts; the bill's landed cost tab shows 23,300
  - GCT return for the month: `import_gct` 120,800 / 18,120, advance credit
    6,040, net −24,160
  - deleting the posted expense is refused
  - edit with a C78 duty of 10,000, no advance GCT and allocation by
    quantity: duties 13,300, import GCT 16,620, overrides listed, 8,866.67
    and 4,433.33; the first posting is gone
  - validation: duplicate number, income account as payment account, draft
    bill, bill without inventory lines
  - no bill: the duties stay on Customs Duties & Fees
  - delete removes all three postings, and the bill can be deleted again
  - the endpoints are refused for the US organization
- **Manual check** on the JM organization: after one entry, the inventory
  valuation for the two items went from 50,000 and 40,000 to 62,944.44 and
  50,355.56. Average costs went from 5,000 and 8,000 to 6,294.44 and
  10,071.11.
- **Webapp:** typecheck and lint clean. In Chromium, the new entry form
  showed the live summary and allocation, saved, and listed the entry. The
  edit form loaded the stored entry with the computed amounts as
  placeholders. The GCT Return for the month showed "Imports · GCT paid at
  customs" and the advance GCT credit.

**Full server e2e suite: 68 files, 389/389 tests passed**, one file per
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
| `item-categories` 3/3 | `items` 13/13 | `jamaica-customs` 9/9 | `jamaica-gct-return` 3/3 |
| `jamaica-gct` 10/10 | `jamaica-tax-invoice` 5/5 | `jamaica-withholding` 5/5 | `jamaica` 11/11 |
| `manual-journal` 8/8 | `organization` 3/3 | `payment-links` 1/1 | `payment-received` 8/8 |
| `payment-services` 3/3 | `pdf-templates` 4/4 | `resource` 1/1 | `roles` 6/6 |
| `sale-estimates` 11/11 | `sale-invoices` 11/11 | `sale-receipts` 6/6 | `settings` 3/3 |
| `tax-engine-compat` 7/7 | `tax-rates` 3/3 | `transactions-locking` 6/6 | `users-invite` 1/1 |
| `users` 5/5 | `vendor-credits-apply-bill` 4/4 | `vendor-credits-refund` 3/3 | `vendor-credits` 4/4 |
| `vendors` 4/4 | `views` 1/1 | `warehouse-transfers` 7/7 | `warehouses` 5/5 |

## Known limitations

- **Amounts are in JMD.** Convert the FOB at the customs rate before
  entering it; the goods bill itself can be in a foreign currency.
- **Allocation is all or nothing per entry.** To split one C78 over several
  bills, record one entry per bill.
- **Editing the generated expense or landed cost directly** isn't blocked
  (deleting the expense is). Change the customs entry instead.
- The landed cost GL date is the bill date (upstream behaviour). The
  expense and tax postings use the entry date.
- The advance GCT credit is taken in the month of the entry. TAJ may treat
  it differently (see the open verification items).
- A customs entry counts as one expense in the GCT return's
  `documents.expenses`, with no tax rate.
