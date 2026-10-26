# Bills

## Account lines

A bill line can post straight to an account instead of an item, for
one-off purchases such as a domain name, hosting or a repair. You don't need
to create an item first.

Applies to `POST /api/bills` and `PUT /api/bills/:id`.

### Request: before (item lines only)

```json
{
  "vendor_id": 22,
  "bill_date": "2026-10-26",
  "entries": [
    { "index": 1, "item_id": 5, "quantity": 1, "rate": 1000 }
  ]
}
```

This still works unchanged. An item line without `cost_account_id` posts to
the item's cost account (or to its inventory account for inventory items).

### Request: after (account line, no item)

```json
{
  "vendor_id": 22,
  "bill_date": "2026-10-26",
  "entries": [
    { "index": 1, "item_id": 5, "quantity": 1, "rate": 1000 },
    {
      "index": 2,
      "item_id": null,
      "cost_account_id": 1020,
      "description": "Web hosting, 1 year",
      "quantity": 1,
      "rate": 4500
    }
  ]
}
```

- `entries[].item_id` is optional when `entries[].cost_account_id` is sent.
  Omit it or send `null`.
- `entries[].cost_account_id` was already accepted. On an item line it still
  overrides the item's account.
- Tax rates, discounts and inclusive/exclusive tax work on account lines in
  the same way as on item lines.
- The webapp disables the landed-cost checkbox on account lines.

### GL

The account line debits `cost_account_id`; accounts payable is credited for
the bill total as before. With the example above:

| Account          | Debit | Credit |
|------------------|------:|-------:|
| Cost of goods sold (item) | 1,000 | |
| Office expenses (account line) | 4,500 | |
| Accounts payable |       | 5,500 |

Bill payments post the account line to its account on the cash basis too.

### Errors (400)

| Code | When |
|---|---|
| `BILL_ENTRY_ITEM_OR_ACCOUNT_REQUIRED` | A line has neither `item_id` nor `cost_account_id`. |
| `BILL_ENTRY_ACCOUNT_NOT_FOUND` | A `cost_account_id` does not exist. |

### Response

`GET /api/bills/:id` entries gain `cost_account` (the account object, or `null`) next to `item`. On an account line `item` is `null`.

```json
{
  "entries": [
    {
      "index": 2,
      "item_id": null,
      "item": null,
      "cost_account_id": 1020,
      "cost_account": { "id": 1020, "name": "Office expenses", ... },
      "description": "Web hosting, 1 year",
      "quantity": 1,
      "rate": 4500,
      "amount": 4500
    }
  ]
}
```

### Webapp

The bill form has a new **Account** column. Pick an item, an account, or
both (the account overrides the item's). The bill drawer shows the account
name on lines without an item.
