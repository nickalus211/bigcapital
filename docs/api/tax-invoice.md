# Tax Invoices (M3)

Section 29 of the General Consumption Tax Act says what a GCT-registered
supplier's **Tax Invoice** must show. M3 checks invoices against it and prints
the required fields on the PDF. Nothing here blocks a request.

Everything on this page applies only while the Jamaica feature
(`features.jamaica`) is on. The PDF changes need GCT registration too
(`jamaica.gct_registered`, set with `PUT /api/jamaica/settings`).

## `compliance_warnings` on invoices

`POST /api/sale-invoices`, `PUT /api/sale-invoices/:id` and
`GET /api/sale-invoices/:id` return a new field:

```json
{
  "id": 14,
  "invoice_no": "INV-00014",
  "compliance_warnings": [
    {
      "code": "CUSTOMER_TRN_MISSING",
      "message": "The customer is a business but has no TRN."
    },
    {
      "code": "LINE_TAX_RATE_MISSING",
      "message": "Some lines have no GCT rate. Use the zero-rated or exempt rate where no GCT applies.",
      "lines": [2]
    }
  ]
}
```

- It is always present. With the Jamaica feature off it is `[]`.
- `lines` holds 1-based line numbers, in line order, and is present only on
  line warnings.
- The invoice is saved either way. Warnings describe what the document is
  missing to qualify as a Tax Invoice.
- The list endpoint `GET /api/sale-invoices` doesn't include warnings.

### Codes

For an organization **registered for GCT**:

| Code | When |
|---|---|
| `ORGANIZATION_TRN_MISSING` | The organization has no tax number (`PUT /api/organization` → `tax_number`) |
| `ORGANIZATION_TRN_INVALID` | The organization's TRN isn't nine digits (spaces and dashes are ignored) |
| `ORGANIZATION_ADDRESS_MISSING` | The organization has no `address.address1` |
| `GCT_REGISTRATION_NUMBER_MISSING` | `jamaica.gct_registration_number` is unset |
| `CUSTOMER_ADDRESS_MISSING` | The customer has no billing address line 1 |
| `CUSTOMER_TRN_MISSING` | The customer is a business (`customer_type: "business"`) and has no `tax_number` |
| `CUSTOMER_TRN_INVALID` | The customer's TRN isn't nine digits |
| `LINE_TAX_RATE_MISSING` | Lines with no tax rate. Use `GCT-ZERO` or `GCT-EXEMPT` where no GCT applies. |
| `LINE_TAX_TYPE_UNCLASSIFIED` | Lines whose tax rate has no `tax_type` |

For an organization **not registered for GCT**:

| Code | When |
|---|---|
| `GCT_CHARGED_NOT_REGISTERED` | Any line charges tax |

## Invoice PDF and HTML

`GET /api/sale-invoices/:id` with `Accept: application/pdf`, and
`GET /api/sale-invoices/:id/html`.

For a GCT-registered organization:

| Part | Before | Tax Invoice |
|---|---|---|
| Title | Invoice | **Tax Invoice** |
| Supplier block | name and address | adds `TRN: 123-456-789` and `GCT Reg. No.: …` |
| Billed-to block | name and address | adds the customer's `TRN: …` when set |
| Line columns | Item, Qty, Rate, Total | Item, Qty, Rate, **GCT %**, **GCT**, **Amount excl. GCT** |
| Totals | Subtotal, discount, tax lines, total | **Subtotal excl. GCT**; each tax line shows its rate, e.g. `GCT Standard (15%)` |

TRNs are printed as `123-456-789` when they have nine digits.

Organizations that are not registered, and all non-Jamaica tenants, get the
upstream invoice PDF.

## Receipt, credit note and estimate PDFs (tax lines)

For documents that carry tax (`tax.extended_documents`, see
[document-tax.md](document-tax.md)), the PDF now prints:

- one total line per tax rate, e.g. `GCT Standard (15%) 27.00`
- the total with tax. The credit note and estimate PDFs used to print the
  line sum as the total.
- line amounts excluding tax

Untaxed documents print as before.

## Emails

The invoice, receipt, estimate and credit note emails list a total line per
tax rate, after the adjustment. Documents without tax are unchanged.

## Fixes that apply to every tenant

| Fix | Before | After |
|---|---|---|
| Credit note auto-numbering | Credit notes created without a number were saved as `"{}"` | They take the next number, e.g. `CN-00006` |
| Manual journal auto-numbering | Same bug when no `journal_number` was sent | Fixed the same way |
| Receipt PDF | Printed the placeholder number `346D3D40-0001` and sample notes | Prints the receipt number, the receipt message and the statement |

Credit notes and manual journals already saved as `"{}"` keep that number
until you edit them and enter one.
