# Withholding tax (M5)

Companies that pay a sole trader for specified services can withhold 3% of
the payment and pay it to TAJ. The sole trader gets less money in the bank
but can claim the withheld tax as a credit on the S04 return (line F24),
usually with the withholding tax certificates the payers issue.

M5 records the withheld tax on the payment, posts it to a receivable
account, tracks the certificates and sums both up per tax year.

## Payments received: `withholding_tax_amount`

`POST /api/payments-received` and `PUT /api/payments-received/:id` accept an
optional field:

| Field | Type | |
|---|---|---|
| `withholding_tax_amount` | number ≥ 0, or `null` | Tax the customer withheld, in the payment's currency. Can't exceed `amount`. |

- **Omitted on create:** no withholding (stored as `null`), as before.
- **Omitted on edit:** the stored value is kept.
- **`0` or `null` on edit:** clears it.
- It isn't tied to the Jamaica feature. Any tenant can send it; the
  webapp only shows the field while the Jamaica feature is on.

The invoices are still settled by the full `amount`: the withheld tax is part
of what the customer paid.

### Request

```json
{
  "customer_id": 48,
  "payment_date": "2026-10-21",
  "deposit_account_id": 1002,
  "amount": 1000,
  "withholding_tax_amount": 30,
  "entries": [{ "index": 1, "invoice_id": 47, "payment_amount": 1000 }]
}
```

### Response fields (every payment)

| Field | |
|---|---|
| `withholding_tax_amount` | as stored; `null` when none |
| `deposit_amount` | `amount − withholding_tax_amount` (equals `amount` when none) |
| `local_deposit_amount`, `local_withholding_tax_amount` | the same in the base currency |
| `formatted_withholding_tax_amount` | e.g. `"30.00"`; `""` when none |
| `formatted_deposit_amount` | e.g. `"970.00"` |

### Ledger

| Account | Before M5 | With `withholding_tax_amount: 30` |
|---|---|---|
| Deposit account | Dr 1,000 | Dr 970 |
| Withholding Tax Receivable | — | Dr 30 |
| Accounts receivable | Cr 1,000 | Cr 1,000 |

Cash-basis entries follow the same split, spread over the invoices paid in
proportion to the amount applied to each. Foreign currency payments convert
at the payment's exchange rate.

The receivable account is `tax.withholding_account_id`. When that is unset
or the account was deleted, the account with slug `wht-receivable` is used,
and created (code 10012, other current asset) when missing. The account is
only looked up for payments that have withholding tax.

### Errors

| Type | When |
|---|---|
| `WITHHOLDING_TAX_EXCEEDS_AMOUNT` | `withholding_tax_amount > amount` (400) |

## Certificates: `/api/jamaica/wht-certificates`

Needs the Jamaica feature (`JAMAICA_FEATURE_NOT_ENABLED` otherwise).
Permissions are the payment received ones (view, create, edit, delete).

| Method | Path | |
|---|---|---|
| `GET` | `/api/jamaica/wht-certificates?tax_year=&customer_id=` | List, newest first |
| `GET` | `/api/jamaica/wht-certificates/:id` | One certificate |
| `POST` | `/api/jamaica/wht-certificates` | Record a certificate (201) |
| `PUT` | `/api/jamaica/wht-certificates/:id` | Replace it |
| `DELETE` | `/api/jamaica/wht-certificates/:id` | Delete it |

### Body

| Field | Required | |
|---|---|---|
| `customer_id` | yes | The customer that withheld the tax |
| `certificate_date` | yes | `YYYY-MM-DD` |
| `amount` | yes | Tax certified, in the base currency, > 0 |
| `tax_year` | no | Defaults to the year of `period_to`, else of `certificate_date` |
| `certificate_number` | no | |
| `period_from`, `period_to` | no | `period_from` can't be after `period_to` |
| `note` | no | |

### Response

```json
{
  "id": 1,
  "customer_id": 48,
  "customer_name": "WHT Probe Co",
  "certificate_number": "C-1",
  "certificate_date": "2027-01-15",
  "tax_year": 2026,
  "period_from": null,
  "period_to": "2026-12-31",
  "amount": 20,
  "note": null
}
```

Errors (400): `WHT_CERTIFICATE_NOT_FOUND`,
`WHT_CERTIFICATE_CUSTOMER_NOT_FOUND`, `WHT_CERTIFICATE_PERIOD_INVALID`.

## Summary: `GET /api/jamaica/wht-summary?year=2026`

The tax year is the calendar year, by default the previous one. Payments
are counted by `payment_date`; certificates by `tax_year`. Read-only.

```json
{
  "year": 2026,
  "from_date": "2026-01-01",
  "to_date": "2026-12-31",
  "currency_code": "JMD",
  "rate": 3,
  "customers": [
    {
      "customer_id": 48,
      "customer_name": "WHT Probe Co",
      "customer_tax_number": null,
      "payments_count": 1,
      "certificates_count": 1,
      "withheld_amount": 30,
      "certified_amount": 20,
      "difference_amount": 10,
      "status": "missing"
    }
  ],
  "totals": { "withheld_amount": 30, "certified_amount": 20, "uncertified_amount": 10 },
  "s04": { "line": "F24", "credit_amount": 20 },
  "warnings": [
    { "code": "CERTIFICATES_MISSING", "message": "Some withheld tax has no certificate yet. ..." },
    { "code": "RATE_NOT_VERIFIED", "message": "The withholding tax rate is not verified ..." }
  ]
}
```

| Field | Meaning |
|---|---|
| `rate` | The `wht.specified_services_rate` tax parameter in force at year end, `null` if not seeded |
| `difference_amount` | Withheld − certified. Positive: certificates missing. Negative: certified more than the payments record. |
| `status` | `certified`, `missing` or `over_certified` |
| `totals.uncertified_amount` | Sum of the positive differences |
| `s04.credit_amount` | The certified tax, the credit to claim on the S04 |

| Warning | When |
|---|---|
| `CERTIFICATES_MISSING` | Some withheld tax has no certificate |
| `CERTIFIED_MORE_THAN_WITHHELD` | A customer certified more than the payments record |
| `RATE_NOT_VERIFIED` | The seeded rate is `verified = false` |

## Webapp

- Payment received form: **Tax withheld by customer** (Jamaica feature on,
  or a payment that already has some), with a "Withheld 3%" shortcut, and
  the deposit amount in the footer.
- Reports → Taxes → **Withholding Tax**: the summary and the certificates of
  a year, with add and delete.

## To confirm with an accountant

- Whether the S04 credit needs certificates, or whether the withheld amounts
  from payments can be claimed (the summary claims only certified tax).
- The 3% rate, the list of specified services and the payment threshold.
- That certificates count in the year of the payments they cover.
