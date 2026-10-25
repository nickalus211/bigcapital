import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import * as moment from 'moment';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { TaxRateModel } from '@/modules/TaxRates/models/TaxRate.model';
import { TaxRateVersion } from '@/modules/TaxRates/models/TaxRateVersion.model';
import { TaxParameter } from '@/modules/TaxRates/models/TaxParameter.model';
import { TaxRateTransaction } from '@/modules/TaxRates/models/TaxRateTransaction.model';
import { Item } from '@/modules/Items/models/Item';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { InitialTaxRates } from '@/database/tenant/seeds/data/TaxRates';
import { Account } from '@/modules/Accounts/models/Account.model';
import { AccountTransaction } from '@/modules/Accounts/models/AccountTransaction.model';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import { SETTINGS_PROVIDER } from '@/modules/Settings/Settings.types';
import { SettingsStore } from '@/modules/Settings/SettingsStore';
import {
  JAMAICA_GCT_RATES,
  SEED_EFFECTIVE_FROM,
  UNVERIFIED_SOURCE_NOTE,
} from '../data/gct-rates';
import { JAMAICA_TAX_PARAMETERS } from '../data/tax-parameters';
import {
  GCT_INPUT_TAX_SLUG,
  JAMAICA_ACCOUNTS,
  JAMAICA_ACCOUNT_RENAMES,
  TAX_PAYABLE_SLUG,
  WHT_RECEIVABLE_SLUG,
} from '../data/jamaica-accounts';
import { TaxPayableAccount } from '@/modules/Accounts/Accounts.constants';

export interface JamaicaSetupReport {
  dryRun: boolean;
  created: string[];
  updated: string[];
  skipped: string[];
}

interface JamaicaSetupAccountIds {
  inputTaxId: number;
  outputTaxId: number;
  withholdingTaxId?: number;
}

class DryRunRollback extends Error {}

/**
 * Configures a tenant for a Jamaican sole trader: GCT tax rates, dated
 * rate versions, tax parameters, accounts and the `tax.*` settings.
 *
 * Idempotent: rows are matched by code/slug/key and existing user data is
 * never overwritten, only missing data is added.
 */
@Injectable()
export class JamaicaSetupService {
  constructor(
    @Inject(TaxRateModel.name)
    private readonly taxRateModel: TenantModelProxy<typeof TaxRateModel>,

    @Inject(TaxRateVersion.name)
    private readonly taxRateVersionModel: TenantModelProxy<
      typeof TaxRateVersion
    >,

    @Inject(TaxParameter.name)
    private readonly taxParameterModel: TenantModelProxy<typeof TaxParameter>,

    @Inject(TaxRateTransaction.name)
    private readonly taxRateTransactionModel: TenantModelProxy<
      typeof TaxRateTransaction
    >,

    @Inject(Item.name)
    private readonly itemModel: TenantModelProxy<typeof Item>,

    @Inject(ItemEntry.name)
    private readonly itemEntryModel: TenantModelProxy<typeof ItemEntry>,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,

    @Inject(AccountTransaction.name)
    private readonly accountTransactionModel: TenantModelProxy<
      typeof AccountTransaction
    >,

    @Inject(SETTINGS_PROVIDER)
    private readonly settings: () => Promise<SettingsStore>,

    private readonly uow: UnitOfWork,
  ) {}

  /**
   * Runs the Jamaica setup.
   * @param {boolean} dryRun - Reports the changes and rolls them back.
   * @returns {Promise<JamaicaSetupReport>}
   */
  public async setup(dryRun = false): Promise<JamaicaSetupReport> {
    const report: JamaicaSetupReport = {
      dryRun,
      created: [],
      updated: [],
      skipped: [],
    };
    let accountIds: JamaicaSetupAccountIds;

    try {
      await this.uow.withTransaction(async (trx: Knex.Transaction) => {
        await this.setupTaxRates(report, trx);
        await this.deactivateUnusedDefaultTaxRates(report, trx);
        await this.setupTaxParameters(report, trx);
        accountIds = await this.setupAccounts(report, trx);

        if (dryRun) throw new DryRunRollback();
      });
    } catch (error) {
      if (!(error instanceof DryRunRollback)) throw error;
    }
    await this.setupSettings(report, accountIds, dryRun);

    return report;
  }

  /**
   * Upserts the GCT tax rates and their seeded rate versions.
   */
  private async setupTaxRates(
    report: JamaicaSetupReport,
    trx: Knex.Transaction,
  ) {
    for (const seed of JAMAICA_GCT_RATES) {
      let taxRate = await this.taxRateModel()
        .query(trx)
        .findOne({ code: seed.code });

      if (!taxRate) {
        taxRate = await this.taxRateModel().query(trx).insertAndFetch({
          code: seed.code,
          name: seed.name,
          rate: seed.rate,
          taxType: seed.taxType,
          description: seed.description,
          active: seed.active,
        });
        report.created.push(`tax_rate:${seed.code}`);
      } else if (!taxRate.taxType) {
        await this.taxRateModel()
          .query(trx)
          .patchAndFetchById(taxRate.id, { taxType: seed.taxType });
        report.updated.push(`tax_rate:${seed.code}:tax_type`);
      } else {
        report.skipped.push(`tax_rate:${seed.code}`);
      }
      const version = await this.taxRateVersionModel().query(trx).findOne({
        taxRateId: taxRate.id,
        effectiveFrom: SEED_EFFECTIVE_FROM,
      });
      if (!version) {
        await this.taxRateVersionModel().query(trx).insert({
          taxRateId: taxRate.id,
          rate: taxRate.rate,
          effectiveFrom: SEED_EFFECTIVE_FROM,
          verified: false,
          sourceNote: UNVERIFIED_SOURCE_NOTE,
        });
        report.created.push(`tax_rate_version:${seed.code}`);
      }
    }
  }

  /**
   * Deactivates the generic 0% tax rates seeded for every organization
   * (TAX-SALES, TAX-PURCHASES, ...) while they are unused and unchanged, so
   * only the GCT rates are offered.
   */
  private async deactivateUnusedDefaultTaxRates(
    report: JamaicaSetupReport,
    trx: Knex.Transaction,
  ) {
    for (const seed of InitialTaxRates) {
      const taxRate = await this.taxRateModel()
        .query(trx)
        .findOne({ code: seed.code });

      if (
        !taxRate ||
        !taxRate.active ||
        Number(taxRate.rate) !== 0 ||
        taxRate.taxType
      ) {
        continue;
      }
      const [usedByEntry, usedByItem, usedByTransaction] = await Promise.all([
        this.itemEntryModel().query(trx).findOne({ taxRateId: taxRate.id }),
        this.itemModel()
          .query(trx)
          .where('sellTaxRateId', taxRate.id)
          .orWhere('purchaseTaxRateId', taxRate.id)
          .first(),
        this.taxRateTransactionModel()
          .query(trx)
          .findOne({ taxRateId: taxRate.id }),
      ]);
      if (usedByEntry || usedByItem || usedByTransaction) {
        report.skipped.push(`tax_rate:${seed.code} (in use)`);
        continue;
      }
      await this.taxRateModel()
        .query(trx)
        .patchAndFetchById(taxRate.id, { active: false });
      report.updated.push(`tax_rate:${seed.code}:inactive`);
    }
  }

  /**
   * Upserts the Jamaica tax parameters.
   */
  private async setupTaxParameters(
    report: JamaicaSetupReport,
    trx: Knex.Transaction,
  ) {
    for (const seed of JAMAICA_TAX_PARAMETERS) {
      const label = `tax_parameter:${seed.key}@${seed.effectiveFrom}`;
      const existing = await this.taxParameterModel().query(trx).findOne({
        jurisdiction: seed.jurisdiction,
        key: seed.key,
        effectiveFrom: seed.effectiveFrom,
      });
      if (existing) {
        report.skipped.push(label);
        continue;
      }
      await this.taxParameterModel()
        .query(trx)
        .insert({
          jurisdiction: seed.jurisdiction,
          key: seed.key,
          value: JSON.stringify(seed.value),
          effectiveFrom: seed.effectiveFrom,
          effectiveTo: seed.effectiveTo ?? null,
          verified: false,
          sourceNote: seed.sourceNote,
        });
      report.created.push(label);
    }
  }

  /**
   * Upserts the Jamaica accounts and tidies the default chart of accounts.
   * @returns {Promise<JamaicaSetupAccountIds>}
   */
  private async setupAccounts(
    report: JamaicaSetupReport,
    trx: Knex.Transaction,
  ) {
    for (const seed of JAMAICA_ACCOUNTS) {
      const existing = await this.accountModel()
        .query(trx)
        .findOne({ slug: seed.slug });

      if (existing) {
        report.skipped.push(`account:${seed.slug}`);
        continue;
      }
      const codeTaken = await this.accountModel()
        .query(trx)
        .findOne({ code: seed.code });

      await this.accountModel()
        .query(trx)
        .insert({
          name: seed.name,
          slug: seed.slug,
          accountType: seed.accountType,
          code: codeTaken ? null : seed.code,
          description: seed.description,
          active: true,
          index: 1,
          predefined: true,
        } as Partial<Account>);
      report.created.push(
        `account:${seed.slug}${codeTaken ? ' (code in use, left empty)' : ''}`,
      );
    }
    // Ensure the output tax account exists.
    let taxPayable = await this.accountModel()
      .query(trx)
      .findOne({ slug: TAX_PAYABLE_SLUG });

    if (!taxPayable) {
      taxPayable = await this.accountModel()
        .query(trx)
        .insertAndFetch({ ...TaxPayableAccount } as Partial<Account>);
      report.created.push(`account:${TAX_PAYABLE_SLUG}`);
    }
    for (const rename of JAMAICA_ACCOUNT_RENAMES) {
      const account = await this.accountModel()
        .query(trx)
        .findOne({ slug: rename.slug, name: rename.from });

      if (account) {
        await this.accountModel()
          .query(trx)
          .patchAndFetchById(account.id, { name: rename.to });
        report.updated.push(`account:${rename.slug}:name`);
      }
    }
    await this.dedupeOwnerDrawingsSlug(report, trx);

    const inputTax = await this.accountModel()
      .query(trx)
      .findOne({ slug: GCT_INPUT_TAX_SLUG });

    const whtReceivable = await this.accountModel()
      .query(trx)
      .findOne({ slug: WHT_RECEIVABLE_SLUG });

    return {
      inputTaxId: inputTax.id,
      outputTaxId: taxPayable.id,
      withholdingTaxId: whtReceivable?.id,
    };
  }

  /**
   * The default chart seeds both "Owner A Drawings" (a liability) and "Loan"
   * with the slug `owner-drawings`. Re-slugs "Loan" to `loan`, and
   * deactivates the liability drawings account while it has no transactions
   * (a sole trader's drawings belong in the equity "Drawings" account).
   */
  private async dedupeOwnerDrawingsSlug(
    report: JamaicaSetupReport,
    trx: Knex.Transaction,
  ) {
    const loan = await this.accountModel()
      .query(trx)
      .findOne({ slug: 'owner-drawings', name: 'Loan' });
    const loanSlugTaken = await this.accountModel()
      .query(trx)
      .findOne({ slug: 'loan' });

    if (loan && !loanSlugTaken) {
      await this.accountModel()
        .query(trx)
        .patchAndFetchById(loan.id, { slug: 'loan' });
      report.updated.push('account:loan:slug');
    }
    const ownerDrawings = await this.accountModel()
      .query(trx)
      .findOne({ slug: 'owner-drawings', name: 'Owner A Drawings' });

    if (ownerDrawings?.active) {
      const hasTransactions = await this.accountTransactionModel()
        .query(trx)
        .findOne({ accountId: ownerDrawings.id });

      if (hasTransactions) {
        report.skipped.push('account:owner-drawings (has transactions)');
      } else {
        await this.accountModel()
          .query(trx)
          .patchAndFetchById(ownerDrawings.id, { active: false });
        report.updated.push('account:owner-drawings:inactive');
      }
    }
  }

  /**
   * Turns on the Jamaica feature and the tax settings. Existing values of
   * the `tax.*` settings are kept; `tax.default_from_item` stays opt-in.
   */
  private async setupSettings(
    report: JamaicaSetupReport,
    accountIds: JamaicaSetupAccountIds | undefined,
    dryRun: boolean,
  ) {
    const settings = await this.settings();
    const desired = [
      { group: 'features', key: 'jamaica', value: true, force: true },
      // Customs entries (M6) allocate duties to bills as landed costs.
      { group: 'features', key: 'landed_cost', value: true },
      { group: 'tax', key: 'calc_after_discount', value: true },
      { group: 'tax', key: 'extended_documents', value: true },
      {
        group: 'tax',
        key: 'input_tax_account_id',
        value: accountIds?.inputTaxId,
      },
      {
        group: 'tax',
        key: 'output_tax_account_id',
        value: accountIds?.outputTaxId,
      },
      {
        group: 'tax',
        key: 'withholding_account_id',
        value: accountIds?.withholdingTaxId,
      },
      {
        group: 'jamaica',
        key: 'filing_frequency',
        value: 'monthly',
      },
    ];
    for (const option of desired) {
      const label = `setting:${option.group}.${option.key}`;
      const current = settings.get({ group: option.group, key: option.key });
      const isSet = current !== undefined && current !== null && current !== '';

      if ((isSet && !option.force) || option.value === undefined) {
        report.skipped.push(label);
        continue;
      }
      if (isSet && current === option.value) {
        report.skipped.push(label);
        continue;
      }
      if (!dryRun) {
        settings.set({
          group: option.group,
          key: option.key,
          value: option.value,
        });
      }
      report.updated.push(label);
    }
    if (!dryRun) {
      settings.set({
        group: 'jamaica',
        key: 'setup_at',
        value: moment().toISOString(),
      });
      await settings.save();
    }
  }
}
