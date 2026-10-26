# Dashboard boot

## `GET /api/dashboard/boot`

Returns the abilities, features and environment flags the webapp needs before
it renders.

### Response: before (upstream)

```json
{
  "abilities": [{ "subject": "all", "action": "manage" }],
  "features": [
    { "name": "warehouses", "is_accessible": false, "default_accessible": false },
    { "name": "sales_tax", "is_accessible": true, "default_accessible": true }
  ],
  "is_bigcapital_cloud": false
}
```

### Response: after (M0)

```json
{
  "abilities": [{ "subject": "all", "action": "manage" }],
  "features": [
    { "name": "warehouses", "is_accessible": false, "default_accessible": false },
    { "name": "sales_tax", "is_accessible": true, "default_accessible": true },
    { "name": "jamaica", "is_accessible": false, "default_accessible": false }
  ],
  "is_bigcapital_cloud": false,
  "hidden_modules": ["stripe", "subscription", "workspaces"]
}
```

| Field | Type | Since | Notes |
|---|---|---|---|
| `features[].name = "jamaica"` | feature | M0 | Off by default. Enable with `PUT /api/settings` (see [settings.md](settings.md)). |
| `hidden_modules` | `string[]` | M0 | From the `HIDDEN_MODULES` env. Always present; `[]` when the env is unset. |

### Recognised `hidden_modules` values

| Value | What the webapp hides |
|---|---|
| `stripe` | Preferences → Payment Methods |
| `branches` | Preferences → Branches |
| `warehouses` | Preferences → Warehouses, sidebar warehouse transfers |
| `workspaces` | Workspace list, switcher and "Create workspace" in the organization menu |
| `subscription` | Reserved. The billing page is already off unless the app is hosted on Bigcapital Cloud. |
| `plaid` | Reserved. Bank syncing is already controlled by `BANK_FEED_ENABLED`. |

Hiding affects the UI only. The server endpoints still respond.

## `GET /api/dashboard/insights`

The homepage dashboard figures. Cash basis: money counts when it reaches or
leaves a cash or bank account, and expenses count when they're paid.

| Query | Default | Notes |
|---|---|---|
| `months` | `12` | 1–36, including the current month |

Permission: Reports → Profit & Loss.

```json
{
  "currency_code": "JMD",
  "from_date": "2025-11-01",
  "to_date": "2026-10-31",
  "summary": {
    "received": 120000, "spent": 85000, "net": 35000,
    "cash_balance": 410000, "receivable": 60000, "payable": 25000,
    "total_received": 900000, "total_spent": 700000
  },
  "monthly": [{ "month": "2026-10", "received": 120000, "spent": 85000, "net": 35000 }],
  "balance_trend": [{ "month": "2026-10", "balance": 410000 }],
  "spending_by_category": [
    { "account_id": 1004, "name": "Rent", "amount": 240000 },
    { "account_id": null, "name": "Other", "amount": 31000 }
  ]
}
```

How the figures are worked out:
- **Received / spent:** each transaction's net movement on the cash and
  bank accounts in a month. Transfers between your own accounts net to zero.
  Opening balances aren't counted as received.
- **Balance trend:** the total of the cash and bank accounts at each month end,
  opening balances included.
- **Spending by category:** expense, other expense and cost of goods sold
  accounts in the period, largest first. After the top 7 the rest are
  grouped as "Other".
- **Receivable / payable:** all-time A/R and A/P balances (accrual).
