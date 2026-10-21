# Settings

## `PUT /api/settings`

Saves tenant settings. Only keys declared in
`packages/server/src/constants/metable-options.ts` are accepted.

### New option (M0): `features.jamaica`

Request:

```json
{
  "options": [{ "group": "features", "key": "jamaica", "value": true }]
}
```

- Type: boolean. Default: `false`.
- Effect in M0: Jamaica-guarded endpoints become available. There are none yet;
  later milestones add them. The webapp shows Jamaica-only UI once the flag is on.
- Guarded endpoints called while the flag is off fail with error type
  `JAMAICA_FEATURE_NOT_ENABLED`.
- The webapp toggle is Preferences → Features → **Jamaica Localization**.

Before M0, the request above was rejected as an undeclared setting key.

### Planned options (later milestones)

| Option | Milestone | Default |
|---|---|---|
| `tax.calc_after_discount` | M2 | `false` |
| `tax.extended_documents` | M2 | `false` |
| `tax.default_from_item` | M2 | `false` |
| `tax.input_tax_account_id` | M1/M2 | `null` |
| `tax.output_tax_account_id` | M1/M2 | `null` |
| `jamaica.gct_registered`, `jamaica.gct_registration_number`, … | M1 | unset |
