# Customers and vendors

## Tax number / TRN (M1)

Customers and vendors have an optional `tax_number`, which holds the
Jamaican Taxpayer Registration Number (TRN). The M3 Tax Invoice prints it,
and B2B invoices without one get a compliance warning (never an error).

| Endpoint | Field | Notes |
|---|---|---|
| `POST /api/customers`, `PUT /api/customers/:id` | `tax_number?: string \| null` | Omitted: unchanged. `null` or `""`: cleared. No format validation. |
| `POST /api/vendors`, `PUT /api/vendors/:id` | `tax_number?: string \| null` | Same |
| `GET /api/customers/:id`, `GET /api/vendors/:id` | `tax_number: string \| null` | `null` when unset |

### Before (still valid, unchanged result)

```json
{
  "customer_type": "business",
  "currency_code": "JMD",
  "display_name": "Acme Ltd"
}
```

Response: `"tax_number": null`.

### After

```json
{
  "customer_type": "business",
  "currency_code": "JMD",
  "display_name": "Acme Ltd",
  "tax_number": "123456789"
}
```

Response (abridged):

```json
{ "id": 42, "display_name": "Acme Ltd", "tax_number": "123456789" }
```

The webapp labels the field **TRN** when the Jamaica feature is on, and
**Tax number** otherwise.
