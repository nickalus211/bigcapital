# M0: Foundation

**Status:** complete. Verified on the MAMP environment (MySQL 5.7.39, Redis 6.0).
**Branch:** `feat/jamaica-m0-foundation`

## Scope

1. Documentation scaffold (`docs/`).
2. A `jamaica` tenant feature flag and an empty `JamaicaModule` for later
   milestones.
3. Hiding modules a sole trader doesn't use, without deleting any code.
4. A persisted Light / Dark / System theme.

## Changes

### Server (`packages/server/src`)

| File | Change |
|---|---|
| `common/types/Features.ts` | `Features.JAMAICA = 'jamaica'` |
| `modules/Features/FeaturesConfigure.ts` | `jamaica` defaults to `false` |
| `constants/metable-options.ts` | `features.jamaica` (boolean) declared, so `PUT /settings` accepts it |
| `common/config/localization.ts` (new) | `localization.hiddenModules`, parsed from the `HIDDEN_MODULES` env (CSV, lower-cased) |
| `common/config/index.ts` | Registers the `localization` config |
| `modules/Dashboard/Dashboard.service.ts`, `dtos/GetDashboardBootMetaResponse.dto.ts` | Boot meta returns `hiddenModules` |
| `modules/Jamaica/Jamaica.module.ts` (new) | Isolated module for the Jamaica localization, registered in `App.module.ts` |
| `modules/Jamaica/JamaicaFeatureGuard.ts` (new) | Rejects requests with `JAMAICA_FEATURE_NOT_ENABLED` while the flag is off |
| `common/constants/database.constants.ts` + all Knex pool configs (tenant, system, CLI, analytics) | `withSessionSqlMode()`: optional `DB_SQL_MODE` env applied as the session `sql_mode` on every new connection. No-op when unset. |

### Webapp (`packages/webapp`)

| File | Change |
|---|---|
| `src/hooks/useHiddenModules.ts` (new) | Reads `hiddenModules` from the cached boot meta; `HiddenModule` constants |
| `src/containers/Dashboard/Sidebar/{interfaces.ts,hooks.tsx}`, `src/constants/sidebarMenu.tsx` | Menu items accept `module`; hidden modules are filtered out |
| `src/constants/{types.ts,preferencesMenu.tsx}`, `src/components/Preferences/PreferencesSidebar.tsx` | Same `module` filter for Preferences. Payment Methods = `stripe`, Branches, Warehouses |
| `src/containers/Dashboard/Sidebar/SidebarHead.tsx` | Workspace list, switcher and "Create workspace" are hidden for `workspaces`; new **Appearance** submenu |
| `src/hooks/useTheme.ts` (new) | `light \| dark \| system` preference in `localStorage.theme`, shared store, follows the OS in system mode |
| `index.html` | Inline pre-paint script applies the saved theme. The hard-coded `class="bp4-dark"` is removed. |
| `public/preload-theme.js` (deleted) | Replaced by the inline script. It read a key nothing wrote, and it lost to the hard-coded dark class anyway. |
| `src/components/Dashboard/GlobalHotkeys.tsx` | Shift+H now saves the choice |
| `src/containers/Preferences/Appearance/Appearance.tsx` (new), `src/routes/preferences.tsx` | Preferences → Appearance page |
| `src/containers/Preferences/Features/*`, `src/constants/features.tsx`, `src/lang/en/index.json` | "Jamaica Localization" switch |

### Docs

`docs/ROADMAP.md`, `docs/api/README.md`, `docs/api/CHANGELOG.md`,
`docs/api/dashboard.md`, `docs/api/settings.md`, `docs/setup/local-mamp.md`.

## Migrations

None.

## Configuration

| Name | Where | Default | Effect |
|---|---|---|---|
| `features.jamaica` | Tenant setting | `false` | Enables Jamaica features (none user-visible yet) |
| `HIDDEN_MODULES` | Server env | empty | e.g. `stripe,subscription,workspaces,branches,warehouses` |
| `localStorage.theme` | Browser | `dark` | `light`, `dark` or `system` |
| `DB_SQL_MODE` | Server env | unset | Session `sql_mode` for Bigcapital's DB connections. Set on MAMP to drop `ONLY_FULL_GROUP_BY`. |

## API changes

Additive only: `hidden_modules` on `GET /api/dashboard/boot`, and the
`features.jamaica` option for `PUT /api/settings`. Details are in
[../api/CHANGELOG.md](../api/CHANGELOG.md). The invoice and estimate
endpoints used by the external sync are unchanged.

## Test evidence

- New unit specs: `modules/Jamaica/JamaicaFeatureGuard.spec.ts` and
  `modules/Features/FeaturesConfigure.spec.ts`.
- Full server unit suite: **72 suites, 336 tests passed** (`npx jest`).
- `pnpm run typecheck` is clean in `packages/server` and `packages/webapp`.
- `common/constants/database.constants.spec.ts`: no-op without the env;
  applies `SET SESSION sql_mode` when set.
- `GET /api/banking/accounts/:id/summary` returned 500 on MAMP MySQL
  (`ONLY_FULL_GROUP_BY`). With `DB_SQL_MODE` set it returns 200.
- New e2e cases in `test/dashboard.e2e-spec.ts` (`hidden_modules`, the
  `jamaica` feature) and `test/settings.e2e-spec.ts` (`features.jamaica`
  round trip): **6/6 passed**.
- `pnpm run generate:sdk-types`: the only change is
  `GetDashboardBootMetaResponseDto.hiddenModules`.
- Manual QA (Playwright, light and dark):
  - Light mode on the homepage, invoice form, Preferences → Appearance and
    Preferences → Features.
  - The choice persists across reloads, and the `bp4-dark` class is not
    applied when Light is saved.
  - Shift+H toggles and saves.
  - Workspace items are hidden with `HIDDEN_MODULES=…workspaces`, and
    Payment Methods with `stripe`.
  - Fixed during QA: the Appearance item was white-on-light while its
    submenu was open.

## Known limitations
- The invoice form's "Setup payment gateways" link still shows when `stripe`
  is hidden. To follow up when local gateways are added (M11).
- Pre-existing upstream issue: `index.html` has
  `<link rel="modulepreload" href="/manifest.json">`, which logs a MIME-type
  console error on every load. Left as is to avoid diverging from upstream.

- Hiding is UI-only. Hidden modules' API endpoints still respond.
- The theme is saved per browser, not per user account.
- `subscription` and `plaid` are accepted values in `HIDDEN_MODULES` but have
  no menu entries yet, because existing flags already hide those screens.
