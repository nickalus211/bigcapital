# API compatibility rules

An external app creates invoices and quotes (estimates) through this API and
sends **no tax** on entries. Every change in this fork follows these rules so
that the sync keeps working without code changes.

1. **Changes are additive only.** No field is removed, renamed or retyped, and
   no endpoint is removed.
2. **New request fields are optional.** Their defaults reproduce the old
   behaviour.
3. **New behaviour is opt-in per tenant.** It is controlled by a setting or
   feature flag (e.g. `features.jamaica`, `tax.default_from_item`), and every
   such setting defaults to off.
4. **New response fields are additive.** Clients that ignore unknown fields
   are unaffected.
5. **Compliance problems produce warnings, never errors.** A request that
   succeeded before still succeeds, and any warnings appear in the response.
6. **Omitted is different from explicit `null`.** Where a setting fills
   defaults (e.g. the default tax from the item), an omitted field gets the
   default. An explicit `null` means "none".
7. **Bug fixes are the one exception to rule 3.** A fix that makes a
   document's figures match its own ledger applies to every tenant. Each one
   is listed under "Fixes that apply to every tenant" in the changelog, with
   the before and after values. M2 has two (invoice tax line amounts and
   invoice balances with line discounts); M3 has three (credit note and
   journal numbering, the receipt PDF, and webapp edit totals).

## Wire format

The API uses snake_case on the wire. The server converts request bodies and
queries to camelCase for its DTOs, and converts responses back to snake_case
(see `AGENTS.md`). The examples in these docs use the wire format.

## Where changes are recorded

- [CHANGELOG.md](CHANGELOG.md): every change, newest first, tagged with its
  milestone.
- `<area>.md`: endpoint detail with before/after request and response
  examples, e.g. [dashboard.md](dashboard.md), [settings.md](settings.md),
  [document-tax.md](document-tax.md), [tax-invoice.md](tax-invoice.md),
  [withholding-tax.md](withholding-tax.md),
  [gct-return.md](gct-return.md).
