# Tax rates

## Tax type (M1)

A tax rate can be classified by its GCT treatment. The GCT return (M4) uses
this to split sales into standard-rated, zero-rated and exempt, and to decide
which input tax is claimable.

| `tax_type` | Meaning | Input tax on related purchases |
|---|---|---|
| `standard` | Taxable at a positive rate (e.g. GCT 15%) | Claimable |
| `zero_rated` | Taxable at 0% (e.g. exports, certain basic foods) | Claimable |
| `exempt` | Not taxable (e.g. residential rent) | Not claimable |
| `out_of_scope` | Outside GCT altogether | n/a |
| `null` | Unclassified: every rate created before M1, or created without a type | — |

### `POST /api/tax-rates`

Before (still valid, unchanged result):

```json
{ "name": "VAT", "code": "VAT", "rate": 10, "active": true }
```

Response: `"tax_type": null`.

After, with a type:

```json
{
  "name": "GCT Zero-rated",
  "code": "GCT-ZERO",
  "rate": 0,
  "tax_type": "zero_rated",
  "active": true
}
```

Response (abridged):

```json
{
  "id": 6,
  "name": "GCT Zero-rated",
  "name_formatted": "GCT Zero-rated [0%]",
  "code": "GCT-ZERO",
  "rate": 0,
  "rate_formatted": "0%",
  "tax_type": "zero_rated",
  "active": 1
}
```

An unknown value (e.g. `"tax_type": "luxury"`) returns `400`.

### `PUT /api/tax-rates/:id`

| Request | Effect on `tax_type` |
|---|---|
| `tax_type` omitted | Kept |
| `"tax_type": "exempt"` | Updated in place (no new tax rate) |
| `"tax_type": null` | Cleared (unclassified) |

Upstream behavior is unchanged: editing `rate`, `name` or `code` replaces
the tax rate with a new row and moves the items over.

## Rate versions (M1)

`tax_rate_versions` stores effective-dated rates for a tax rate. On invoices
and bills, a line's `tax_rate` is taken from the version effective on the
document date (`invoice_date` / `bill_date`). If no version covers that date,
`tax_rates.rate` is used, which is the pre-M1 behavior.

The Jamaica setup seeds one version per GCT rate, effective from
`2000-01-01`, with `verified = false`. There is no API to manage versions yet.
Add historical rate changes with SQL until one exists.
