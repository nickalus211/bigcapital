# API changelog

Newest first. Every entry is backward compatible unless it is marked
**BREAKING**, and none are.

## M0: Foundation (2026-10-20)

### `GET /api/dashboard/boot`: new response field `hidden_modules`
- Type: `string[]`, always present, defaults to `[]`.
- Source: the server env `HIDDEN_MODULES` (comma-separated, lower-cased),
  e.g. `stripe,subscription,workspaces`.
- Used by the webapp to hide menu entries. **Server routes are not disabled.**
- Details: [dashboard.md](dashboard.md).

### `PUT /api/settings`: new option `features.jamaica`
- Boolean, default `false`. Turns on the Jamaica localization. In M0 the flag
  only gates `JamaicaFeatureGuard`; later milestones attach behaviour to it.
- `GET /api/dashboard/boot` lists it in `features[]` as
  `{ "name": "jamaica", "is_accessible": false, "default_accessible": false }`.
- New error type for guarded Jamaica endpoints (none exist yet in M0):
  `JAMAICA_FEATURE_NOT_ENABLED`.
- Details: [settings.md](settings.md).

### Invoice and estimate sync
No change. Invoice and estimate endpoints are untouched in M0.
