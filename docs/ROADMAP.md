# Jamaica Sole-Trader Roadmap

This fork adapts Bigcapital for a Jamaican sole trader who is GCT-registered,
imports goods, and sells services to companies (3% withholding tax). The source
requirements are in [`Jamaican Accounting Software Features.md`](../Jamaican%20Accounting%20Software%20Features.md).

## Principles

- **Stay mergeable with upstream.** Jamaica logic lives in
  `packages/server/src/modules/Jamaica/`. Core changes are generic,
  default-off settings that the Jamaica setup switches on.
- **The API stays backward compatible.** An external app syncs invoices and
  quotes through the API. New fields are optional, and existing payloads give
  identical results unless the tenant opts in. See [api/README.md](api/README.md).
- **Compliance problems produce warnings and never block a request.**
- **Tax figures are data, not code.** Rates and thresholds are effective-dated
  rows seeded as `verified=false`. An accountant must confirm them against
  current TAJ guidance.
- **Unused modules are hidden, not deleted.**

## Status

| Milestone | Scope | Status |
|---|---|---|
| [M0](milestones/M0-foundation.md) | Docs, `jamaica` feature flag, hidden modules, light/dark/system theme | ✅ Done |
| [M1](milestones/M1-jamaica-setup.md) | Jamaica setup: GCT rates with tax types, dated rate versions, `tax_parameters`, GCT input/output accounts, TRN on organization and contacts, setup service + CLI | ✅ Done |
| [M2](milestones/M2-gct-engine.md) | GCT engine: tax after discounts (stored per line), tax on receipts, credit notes, vendor credits, estimates and expenses, input/output tax accounts, opt-in default tax from the item, tax-line and line-discount fixes | ✅ Done |
| M3 | Tax Invoice: "Tax Invoice" PDF title, TRN/GCT numbers, per-line GCT, tax lines on receipt, credit note and estimate PDFs and emails, invoice/bill form preview after discounts, non-blocking compliance warnings in the API | ⏳ Next |
| M4 | GCT return report (Form 4A style), zero-rated/exempt totals, input-tax apportionment | Planned |
| M5 | WHT 3% receivable on payments received, certificate tracking (S04 line F24) | Outline |
| M6 | Customs/import landed cost (CIF, CD, SCF, EPL, ASD, CAF, import GCT, 5% advance GCT) | Outline |
| M7 | Fixed asset register with capital allowances (dual book/tax ledgers) | Outline |
| M8 | S04/S04A self-employed income tax engine (NIS, NHT, Education Tax, bands, loss carry-forward) | Outline |
| M9 | Compliance/TCC dashboard and deadline reminders | Outline |
| M10 | RAiS export package | Outline |
| M11 | Local payment gateway (WiPay or similar) | Outline |
| M12 | Special Consumption Tax (tax-on-tax) | Outline |
| M13 | Conversion to a limited liability company | Outline |

## Documentation layout

- `docs/ROADMAP.md`: this file.
- `docs/milestones/M<n>-<slug>.md`: written when each milestone is finished.
  Each one covers scope, files, migrations, settings, test evidence and known
  limitations.
- `docs/api/CHANGELOG.md`: every API change, newest first.
- `docs/api/<area>.md`: per-endpoint detail with before/after examples.
- `docs/setup/`: developer environment notes.

## Open verification items

These claims in the requirements document need confirmation from an
accountant or TAJ before the related milestone ships:

- The 50% loss carry-forward rule and its exemptions (M8). The document cites
  a Dutch PwC source for it.
- Record retention: the document says 7 years, while the Revenue
  Administration Act audit window is 6 years.
- Every rate and threshold: GCT 15%/25%/10%, the J$15M GCT registration
  threshold, NIS/NHT/Education Tax rates, income tax thresholds and bands.
