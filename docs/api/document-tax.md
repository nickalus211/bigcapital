# Tax on documents (M2)

How tax is calculated, stored and returned on invoices, bills, sale receipts,
credit notes, vendor credits, estimates and expenses. Four settings in the
`tax` group control it ([settings.md](settings.md)). They are all off by default, and a
tenant with all of them off gets the upstream behaviour, apart from the two
fixes at the end of this page.

| Setting | Off (default) | On |
|---|---|---|
| `tax.calc_after_discount` | Tax is charged on quantity × rate, before discounts, and derived from the rate whenever it is read. | Tax is charged after the line discount and the line's share of the document discount, rounded to cents per line, and stored on the line. |
| `tax.extended_documents` | Only invoices and bills carry tax. Tax fields sent on other documents are ignored. | Receipts, credit notes, vendor credits, estimates and expenses carry tax too. |
| `tax.default_from_item` | A line without a tax rate is untaxed. | A line that **omits** `tax_rate_id` (and `tax_code`) takes the item's sell or purchase tax rate. `tax_rate_id: null` still means no tax. |
| `tax.output_tax_account_id` / `tax.input_tax_account_id` | Tax posts to Tax Payable. | Sales tax posts to the output account; purchase and expense tax posts to the input account. |

The Jamaica setup turns on `calc_after_discount` and `extended_documents` and
sets both accounts. It never turns on `default_from_item`.

## Invoices and bills

`POST /api/sale-invoices`, `PUT /api/sale-invoices/:id`, `POST /api/bills`,
`PUT /api/bills/:id`: **requests are unchanged.**

### Tax after discounts (`tax.calc_after_discount`)

Request (wire format):

```json
{
  "customer_id": 5,
  "invoice_date": "2026-10-01",
  "due_date": "2026-10-31",
  "discount_type": "amount",
  "discount": 23,
  "entries": [
    { "index": 1, "item_id": 1000, "quantity": 2, "rate": 100, "discount": 10, "tax_rate_id": 5 },
    { "index": 2, "item_id": 1000, "quantity": 1, "rate": 50, "tax_rate_id": null }
  ]
}
```

The lines net 180 and 50. The 23 discount is 10% of that 230, so 10% comes
off each line, and the GCT is 180 × 0.9 × 15% = 24.30.

| Field | Setting off | Setting on |
|---|---|---|
| `entries[0].tax_amount` | 30.00 (15% of 2 × 100) | 24.30 |
| `entries[0].taxable_amount` (new) | `null` | 162.00 |
| `entries[0].line_tax_amount` (new) | `null` | 24.30 |
| `tax_amount_withheld` | 30.00 | 24.30 |
| `subtotal` | 230.00 | 230.00 |
| `total` | 237.00 | 231.30 |

- `taxable_amount` and `line_tax_amount` are new on every item entry in
  every response. They stay `null` on lines written while the setting was
  off, including every line saved before M2, and those lines keep their
  derived tax.
- Editing a document while the setting is on recalculates and stores its
  tax. Documents you don't edit keep their totals.
- With inclusive tax (`is_inclusive_tax: true`), the tax is taken out of the
  discounted line: a 115 line less 10% is 103.50, of which 13.50 is GCT.
- While the setting is on, an edit that removes all tax resets
  `tax_amount_withheld` to 0. With the setting off it keeps the old value,
  as upstream does.

### Tax accounts

Output tax on invoices, and on payments received under cash basis, credits
`tax.output_tax_account_id`. Input tax on bills, and on bill payments under
cash basis, debits `tax.input_tax_account_id`. If either setting is unset or
names a deleted account, that tax posts to Tax Payable as before.

The Sales Tax Liability Summary report reads Tax Payable accounts only, so
input GCT posted to the GCT Input Tax asset account no longer nets off there.
The GCT return (M4) reports both sides.

### Default tax rate from the item (`tax.default_from_item`)

| Line sent | Setting off | Setting on |
|---|---|---|
| `{ "item_id": 1000, ... }` (no `tax_rate_id`) | untaxed | item's `sell_tax_rate_id` (invoices, receipts, credit notes, estimates) or `purchase_tax_rate_id` (bills, vendor credits) |
| `{ "item_id": 1000, "tax_rate_id": null }` | untaxed | untaxed |
| `{ "item_id": 1000, "tax_rate_id": 7 }` | rate 7 | rate 7 |
| `{ "item_id": 1000, "tax_code": "GCT-STD" }` | that code | that code |

**If your sync sends lines without `tax_rate_id`, keep this setting off, or
send `tax_rate_id: null` on the lines that must stay untaxed.**

## Sale receipts, credit notes, vendor credits and estimates

`POST`/`PUT` on `/api/sale-receipts`, `/api/credit-notes`,
`/api/vendor-credits` and `/api/sale-estimates`.

### Requests

- New optional `is_inclusive_tax` (boolean, default `false`).
- `entries[].tax_rate_id` and `entries[].tax_code` were already accepted. They
  now take effect while `tax.extended_documents` is on.
- While the setting is off, `is_inclusive_tax` and any tax on the lines are
  ignored, exactly as before.
- While the setting is on, unknown tax codes and ids are rejected with
  `ITEM_ENTRY_TAX_RATE_CODE_NOT_FOUND` / `ITEM_ENTRY_TAX_RATE_ID_NOT_FOUND`,
  as on invoices.

```json
{
  "customer_id": 5,
  "deposit_account_id": 1002,
  "receipt_date": "2026-10-02",
  "is_inclusive_tax": false,
  "entries": [
    { "index": 1, "item_id": 1000, "quantity": 2, "rate": 100, "discount": 10, "tax_rate_id": 5 },
    { "index": 2, "item_id": 1000, "quantity": 1, "rate": 50 }
  ]
}
```

### Responses (`GET /api/<document>/:id`)

New fields:

| Field | Type | Setting off | Example with the setting on |
|---|---|---|---|
| `is_inclusive_tax` | boolean | `false` | `false` |
| `tax_amount_withheld` | number \| null | `null` | `27` |
| `tax_amount_withheld_formatted` | string | `"J$0.00"` | `"J$27.00"` |
| `taxes` | array | `[]` | `[{ "tax_rate_code": "GCT-STD", "tax_rate": 15, "tax_rate_amount": 27, ... }]` |
| `entries[].taxable_amount`, `entries[].line_tax_amount` | number \| null | `null` | `180`, `27` |

`total` includes exclusive tax: for the receipt above, 230 + 27 = 257.
`taxes` is filled on the single-document endpoints. The list endpoints
return `taxes: []`.

### Ledger

| Document | Tax entry |
|---|---|
| Sale receipt | credit output tax |
| Credit note | debit output tax (reverses the sale) |
| Vendor credit | credit input tax (reverses the purchase) |
| Estimate | none (estimates don't post) |

### Credits remaining

On a taxed credit note or vendor credit, the amount that can be refunded or
applied is the lines' amount **plus exclusive tax**. `credits_remaining` and
the open/closed filters use that amount. Untaxed credits are unchanged.

## Expenses

`POST /api/expenses`, `PUT /api/expenses/:id`.

### Requests

- New optional `is_inclusive_tax` (boolean, default `false`).
- New optional `categories[].tax_rate_id` (integer).
- Both are ignored while `tax.extended_documents` is off.

```json
{
  "payment_date": "2026-10-02",
  "payment_account_id": 1002,
  "is_inclusive_tax": true,
  "categories": [
    { "index": 1, "expense_account_id": 1024, "amount": 1150, "tax_rate_id": 5 },
    { "index": 2, "expense_account_id": 1024, "amount": 100 }
  ]
}
```

### Responses

- `is_inclusive_tax`, `tax_amount_withheld` (`null` when untaxed),
  `tax_amount_withheld_formatted`.
- `categories[]`: `tax_rate_id`, `tax_rate`, `taxable_amount`,
  `line_tax_amount`, `tax_amount`, `amount_excluding_tax`.
- `total_amount` is what was paid: Σ `amount`, plus the tax when it is
  exclusive. In the example: 1,250, of which 150 is GCT.

The expense posts 1,000 + 100 to the expense account, 150 to input tax, and
credits 1,250 to the payment account. The expense's `landed_cost_amount`
excludes the tax.

## Changes for every tenant

These two apply whatever the settings are.

### `taxes[].tax_rate_amount` on invoices and bills

It used to be the rate applied to the **whole** subtotal. It is now the sum
of the tax on the lines charged at that rate.

| Invoice | Before | After |
|---|---|---|
| 100 at 10% + 300 untaxed | `tax_rate_amount: 40` | `tax_rate_amount: 10` |
| every line at 10% | unchanged | unchanged |

`tax_rate` in the same object is now the rate stored with the document (a
dated version, if there is one) rather than the tax rate's current rate.

### Invoice balance with line discounts

An invoice's `balance` (and so `subtotal` and `total`) ignored line
discounts, while its ledger credited the discounted amount. Such invoices
posted an unbalanced journal, for example 200 Dr / 180 Cr. The balance now
subtracts line discounts, as bills, receipts and credit notes already did.

| Invoice | Before | After |
|---|---|---|
| 2 × 100 less 10% on the line | `balance: 200`, `total: 200` | `balance: 180`, `total: 180` |
| no line discounts | unchanged | unchanged |

Invoices saved before M2 keep their stored balance until they are edited.
