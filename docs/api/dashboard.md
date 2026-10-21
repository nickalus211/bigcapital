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
