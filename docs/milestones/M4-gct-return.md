# M4: GCT return

**Status:** complete.
**Branch:** `feat/jamaica-m1-setup-emcy21` (on top of M3).

Shipped just before M4: the estimate total now adds the adjustment instead
of subtracting it (commit `2f5c27d3`, changelog "Fix: estimate adjustment").

## Scope

- `GET /api/jamaica/gct-return`: the GCT return for a period (Form 4A
  style):
  - supplies by tax type, with standard-rated supplies per rate
  - output tax net of credit notes
  - input tax from bills and expenses, net of vendor credits
  - input tax apportionment
  - net GCT, the due date and filing warnings
- Reports → Taxes → **GCT Return** page, printable.

Not in scope: import GCT and the 5% advance GCT at customs (M6), filing or
exporting to TAJ (M10), cash-basis returns, and storing filed returns.

## Design

- **From documents, not the ledger.** The return needs the value of zero-
  rated and exempt supplies, which carry no tax and so leave nothing on the
  tax accounts. Documents also give the tax type of every line. For a check,
  the October 2026 output and input tax match the GCT Payable and GCT Input
  Tax ledger balances exactly (423.30 and 900.00).
- **Pure calculator.** `gct-return.calculator.ts` takes normalized lines
  (`side`, `sign`, `taxRateId`, `taxableAmount`, `taxAmount`) and the tax
  rates, and works out the return. `GctReturnService` loads the period's
  documents and builds those lines.
- **Stored amounts first.** Lines stored by the M2 engine
  (`taxable_amount`, `line_tax_amount`) are used as they are. Older lines
  derive them and spread the document discount over the lines by value.
- **Apportionment** uses the period's own figures:
  (standard + zero-rated) ÷ (standard + zero-rated + exempt). It is only
  applied while `jamaica.apportionment_enabled` is on.

## Changes

| Area | File | Change |
|---|---|---|
| Server | `modules/Jamaica/gct-return/gct-return.calculator.ts` (new) | Return calculation, due date |
| Server | `modules/Jamaica/gct-return/GctReturn.service.ts` (new) | Loads the documents, builds lines, warnings |
| Server | `modules/Jamaica/dtos/GctReturn.dto.ts` (new) | Query and response DTOs (OpenAPI) |
| Server | `modules/Jamaica/Jamaica.controller.ts`, `Jamaica.module.ts` | `GET /jamaica/gct-return` |
| SDK | `shared/sdk-ts/src/jamaica.ts` | `fetchGctReturn`, `GctReturn` type; regenerated schema |
| Webapp | `containers/FinancialStatements/GctReturn/GctReturn.tsx` (new) | The report page |
| Webapp | `routes/dashboard.tsx`, `constants/financialReportsMenu.tsx`, `constants/sidebarMenu.tsx` | Route and menu entries (Jamaica feature) |
| Webapp | `hooks/query/jamaica/*` | `useGctReturn` |

No migrations.

## API changes

See [../api/CHANGELOG.md](../api/CHANGELOG.md#m4-gct-return-2026-10-22) and
[../api/gct-return.md](../api/gct-return.md). One new read-only endpoint.
Nothing else changes.

## Test evidence

- **Unit (server): 369/369**, including `gct-return.calculator.spec.ts`
  (7 cases):
  - supplies by type, credit notes netted, per-rate lines sorted
  - input tax netting
  - zero-rated refund position
  - apportionment on and off
  - due date, including moving back from a weekend
- **`test/jamaica-gct-return.e2e-spec.ts`: 3/3** on the JM organization,
  using a random future month:
  - setup: invoices of 1,000 standard, 300 zero-rated and 400 exempt; a
    draft invoice of 5,000 (excluded); a 200 standard credit note; a 400
    bill; a 115 inclusive expense
  - apportionment off: standard 800, total 1,500, output 120, input 75,
    net payable 45, due date in April
  - apportionment on: ratio 0.7333, claimable 55, disallowed 20, net 65
  - the endpoint is refused for the US organization (Jamaica feature off)
- **Manual check:** the October 2026 return on the JM organization. Output
  GCT 423.30 and input GCT 900.00 match the ledger balances of GCT Payable
  and GCT Input Tax for October.
- **Webapp:** typecheck and lint clean. The page was checked in Chromium
  with the October 2026 period: header, warnings, supplies and purchases
  tables, apportionment, and "Net GCT refundable J$476.70".

**Full server e2e suite:** running; results are added when it finishes.

## Known limitations

- The layout follows the structure of the TAJ return but not its exact box
  numbers. Confirm the mapping with an accountant before filing.
- Apportionment uses the period's figures. TAJ may require an annual
  adjustment.
- The due date skips weekends but not public holidays.
- No import GCT or advance GCT yet (M6).
- Documents are counted by date and status. Editing a document from an
  earlier period changes that period's return, and filed returns are not
  locked or stored. Use transaction locking after filing.
