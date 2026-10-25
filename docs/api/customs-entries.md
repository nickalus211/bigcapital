# Customs entries (M6)

A customs entry records what was paid to Jamaica Customs to clear an
import, from the C78 declaration. Saving one:

1. posts the **duties and fees** (CD, SCF, EPL, ASD, SCT, CAF) as a
   published expense to *Customs Duties & Fees*, paid from the payment
   account;
2. when a goods **bill** is given, allocates them to the bill's inventory
   lines as a landed cost, which moves them into inventory (Dr Inventory,
   Cr Customs Duties & Fees) and raises the items' average cost;
3. posts **import GCT** to the input tax account (`tax.input_tax_account_id`,
   *GCT Input Tax*) and **advance GCT** to *Advance GCT*, paid from the
   payment account (`CustomsEntry` ledger entries).

Import GCT then counts as input tax on the GCT return, and advance GCT is
credited against the GCT due. See [gct-return.md](gct-return.md).

All endpoints need the Jamaica feature (`JAMAICA_FEATURE_NOT_ENABLED`
otherwise) and the expense permissions (view, create, edit, delete).
Amounts are in the base currency (JMD at the customs exchange rate).

## How the amounts are worked out

| Amount | Default |
|---|---|
| CIF | FOB + freight + insurance |
| Customs Duty (CD) | CIF × `customs_duty_rate` % (the tariff rate of the goods) |
| SCF | CIF × 0.3% (`customs.scf_rate`) |
| EPL | CIF × 0.5% (`customs.epl_rate`) |
| ASD, SCT, CAF | as given (0 when omitted) |
| Import GCT base | CIF + CD + SCF + EPL + ASD + SCT |
| Import GCT | base × 15% (`customs.import_gct_rate`) |
| Advance GCT | base × 5% (`customs.advance_gct_rate`) |
| Duties and fees | CD + SCF + EPL + ASD + SCT + CAF |
| Total paid | duties and fees + import GCT + advance GCT |

The rates are `tax_parameters` seeded as unverified (`rates.verified` is
`false`), and the defaults above are used where a parameter is missing.
**Any computed amount can be sent instead** (`customs_duty_amount`,
`scf_amount`, `epl_amount`, `import_gct_amount`, `advance_gct_amount`): the
C78 is what was paid. Amounts that differ from the computed ones are listed
in `overrides`. Send `advance_gct_amount: 0` when no advance GCT was charged.
Each amount is rounded to cents.

The duties are spread over the bill's **inventory** lines by value
(quantity × rate, the default) or by quantity (`allocation_method`). Service
lines get nothing. The rounding difference goes to the largest line.

## `POST /api/jamaica/customs-entries/calculate`

Works out an entry without saving it (200). Body: the fields below, all
optional except `fob_amount`; `entry_date` picks the rates (default today).

```json
{
  "entry_date": "2026-09-10",
  "bill_id": 11,
  "fob_amount": 90000,
  "freight_amount": 8000,
  "insurance_amount": 2000,
  "customs_duty_rate": 20,
  "caf_amount": 2500
}
```

```json
{
  "fob_amount": 90000, "freight_amount": 8000, "insurance_amount": 2000,
  "cif_amount": 100000,
  "customs_duty_rate": 20, "customs_duty_amount": 20000,
  "scf_amount": 300, "epl_amount": 500,
  "asd_amount": 0, "sct_amount": 0, "caf_amount": 2500,
  "import_gct_base": 120800, "import_gct_amount": 18120,
  "advance_gct_amount": 6040,
  "duties_amount": 23300, "taxes_amount": 24160, "total_amount": 47460,
  "overrides": [],
  "rates": { "scf_rate": 0.3, "epl_rate": 0.5, "import_gct_rate": 15,
             "advance_gct_rate": 5, "verified": false },
  "allocations": [
    { "entry_id": 200, "item_id": 1019, "item_name": "Widget", "cost": 12944.44 },
    { "entry_id": 201, "item_id": 1020, "item_name": "Gadget", "cost": 10355.56 }
  ]
}
```

## CRUD

| Method | Path | |
|---|---|---|
| `GET` | `/api/jamaica/customs-entries?from_date=&to_date=` | List, newest first |
| `GET` | `/api/jamaica/customs-entries/:id` | One entry with its allocations |
| `POST` | `/api/jamaica/customs-entries` | Record and post (201) |
| `PUT` | `/api/jamaica/customs-entries/:id` | Reverse and post again |
| `DELETE` | `/api/jamaica/customs-entries/:id` | Reverse and delete |

### Body (create and edit)

| Field | Required | |
|---|---|---|
| `entry_number` | yes | The C78 number; unique |
| `entry_date` | yes | `YYYY-MM-DD` |
| `payment_account_id` | yes | Cash, bank, credit card or another account expenses can be paid from |
| `fob_amount` | yes | |
| `bill_id` | no | An **open** bill with at least one inventory line. Without it the duties stay as an expense. |
| `allocation_method` | no | `value` (default) or `quantity` |
| `freight_amount`, `insurance_amount`, `customs_duty_rate` | no | |
| `customs_duty_amount`, `scf_amount`, `epl_amount`, `asd_amount`, `sct_amount`, `caf_amount`, `import_gct_amount`, `advance_gct_amount` | no | C78 amounts; computed when omitted |
| `reference_no`, `note` | no | |

### Response

The calculation fields above, plus `id`, `entry_number`, `entry_date`,
`reference_no`, `bill_id`, `bill_number`, `vendor_name`,
`payment_account_id`, `payment_account_name`, `allocation_method`,
`expense_id`, `landed_cost_id` and `note`.

### Errors (400)

| Type | When |
|---|---|
| `CUSTOMS_ENTRY_NOT_FOUND` | |
| `CUSTOMS_ENTRY_NUMBER_EXISTS` | Another entry has the number |
| `CUSTOMS_PAYMENT_ACCOUNT_INVALID` | Missing, or an account expenses can't be paid from |
| `CUSTOMS_BILL_NOT_FOUND` | |
| `CUSTOMS_BILL_NOT_OPEN` | The bill is a draft |
| `CUSTOMS_BILL_NO_INVENTORY_ITEMS` | The bill has no inventory lines |

### The posted documents

- The expense and the landed cost are ordinary Bigcapital documents
  (`expense_id`, `landed_cost_id`). They show on the expense list and the
  bill's landed cost tab.
- **Deleting the expense directly is refused** (`CUSTOMS_ENTRY_EXPENSE`);
  edit or delete the customs entry instead.
- A bill with a customs allocation can't be deleted until the customs entry
  is deleted (upstream landed cost rule).

## Webapp

Purchases → **Customs Entries** (Jamaica feature): the list, and a form that
works out the amounts as you type (computed values show as placeholders, so
a typed C78 amount overrides them), with the allocation to the bill's items.

## Setup

The Jamaica setup creates the *Advance GCT* (10013, other current asset)
and *Customs Duties & Fees* (40014, cost of goods sold) accounts, seeds the
four `customs.*` rate parameters, and turns on landed costs
(`features.landed_cost`). The accounts are also created on first use.

## To confirm with an accountant

- The SCF and EPL rates (the requirements mention 0.5% or 0.85% for EPL),
  and which charges are in the import GCT base.
- The base and the rate of advance GCT, and whether it is credited in the
  month it was paid.
- Whether CAF and other fees are part of the inventory cost.
