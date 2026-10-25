# GCT return (M4)

## `GET /api/jamaica/gct-return`

The GCT return for a period, laid out like the TAJ monthly GCT return (Form
4A style) so it can be typed into eServices.

- Needs the Jamaica feature. While it is off, the endpoint fails with
  `JAMAICA_FEATURE_NOT_ENABLED`.
- Permission: the Sales Tax Liability Summary report permission
  (`read-sales-tax-liability-summary`).
- Read-only. It stores nothing.

### Query

| Param | Default | |
|---|---|---|
| `from_date` | first day of last month | `YYYY-MM-DD` |
| `to_date` | last day of last month | `YYYY-MM-DD` |

### What it counts

Accrual basis: documents **dated** in the period.

| Document | Counted when | Side |
|---|---|---|
| Invoice | delivered | supply |
| Sale receipt | closed | supply |
| Credit note | opened | reduces supplies and output tax |
| Bill | opened | purchase |
| Vendor credit | opened | reduces purchases and input tax |
| Expense | published | purchase |
| Customs entry (M6) | dated in the period | import GCT in input tax, advance GCT credit |

Each line is classified by its tax rate's `tax_type` (`standard`,
`zero_rated`, `exempt`, `out_of_scope`). Lines stored by the M2 engine use
their stored `taxable_amount` and `line_tax_amount`. Older lines derive
them, spreading the document discount over the lines by value. Foreign
currency documents are converted at their exchange rate.

Receipts, credit notes and vendor credits saved without tax (before
`tax.extended_documents` was on) count under "no tax rate".

### Response

```json
{
  "from_date": "2026-10-01",
  "to_date": "2026-10-31",
  "due_date": "2026-11-30",
  "currency_code": "JMD",
  "organization": {
    "name": "Kingston Trader",
    "trn": "123456789",
    "gct_registered": true,
    "gct_registration_number": "GCT-000123"
  },
  "supplies": {
    "standard_rated": [
      { "tax_rate_id": 5, "code": "GCT-STD", "name": "GCT Standard", "rate": 15,
        "taxable_amount": 2822, "tax_amount": 423.3 }
    ],
    "standard_rated_amount": 2822,
    "zero_rated_amount": 145,
    "exempt_amount": 0,
    "out_of_scope_amount": 0,
    "unclassified_amount": 0,
    "no_tax_rate_amount": 2515,
    "total_amount": 2967
  },
  "output_tax": 423.3,
  "purchases": {
    "standard_rated": [
      { "tax_rate_id": 5, "code": "GCT-STD", "name": "GCT Standard", "rate": 15,
        "taxable_amount": 6000, "tax_amount": 900 }
    ],
    "standard_rated_amount": 6000,
    "zero_rated_and_exempt_amount": 0,
    "import_gct": { "taxable_amount": 0, "tax_amount": 0 },
    "input_tax": 900
  },
  "apportionment": {
    "enabled": true,
    "taxable_supplies_amount": 2967,
    "total_supplies_amount": 2967,
    "ratio": 1,
    "claimable_input_tax": 900,
    "disallowed_input_tax": 0
  },
  "advance_gct_credit": 0,
  "net_gct": -476.7,
  "position": "refundable",
  "documents": { "sale_invoices": 30, "sale_receipts": 9, "credit_notes": 7,
                 "bills": 5, "vendor_credits": 10, "expenses": 6,
                 "customs_entries": 0 },
  "warnings": [
    { "code": "SUPPLIES_WITHOUT_TAX_RATE", "message": "Some sales have no tax rate, ..." },
    { "code": "RATES_NOT_VERIFIED", "message": "Some GCT rates used in this period are not verified ..." }
  ]
}
```

| Field | Meaning |
|---|---|
| `supplies.total_amount` | Standard + zero-rated + exempt supplies, the figure the return declares. Out-of-scope, unclassified and unrated lines are reported but left out. |
| `output_tax` | GCT on every sale line in the period, less credit notes. Unclassified lines are included, because GCT was charged on them. |
| `purchases.input_tax` | GCT on bills and expenses, less vendor credits, plus import GCT |
| `purchases.import_gct` | Since M6: import GCT paid at customs ([customs-entries.md](customs-entries.md)) and the value it was charged on |
| `advance_gct_credit` | Since M6: advance GCT paid at customs in the period, credited against the GCT due |
| `apportionment` | While `jamaica.apportionment_enabled` is on, the claimable input tax is input tax × (standard + zero-rated) ÷ (standard + zero-rated + exempt). Otherwise all input tax is claimable and `ratio` is 1. |
| `net_gct` | `output_tax − claimable_input_tax − advance_gct_credit`. Negative means a refund is due, and `position` is `payable`, `refundable` or `nil`. |
| `due_date` | The last Monday-to-Friday of the month after `to_date`. Public holidays aren't considered. |

### Warnings

| Code | When |
|---|---|
| `NOT_GCT_REGISTERED` | `jamaica.gct_registered` is off |
| `UNCLASSIFIED_SUPPLIES` | Sales used a tax rate with no `tax_type` |
| `SUPPLIES_WITHOUT_TAX_RATE` | Registered, and some sales had no tax rate |
| `RATES_NOT_VERIFIED` | A rate used in the period has a version with `verified = false` |

### Webapp

Reports → Taxes → **GCT Return** (shown while the Jamaica feature is on). It
has a period picker and a print button.

### To confirm with an accountant

- The box layout of the current TAJ GCT return, and whether the
  apportionment fraction must use the period's or the year's figures.
- Whether cash-basis registrants need a payments-based version.
- Where import GCT and the advance GCT credit go on the TAJ form.
