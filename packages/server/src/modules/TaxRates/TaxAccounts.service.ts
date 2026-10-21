import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { Account } from '@/modules/Accounts/models/Account.model';
import { AccountRepository } from '@/modules/Accounts/repositories/Account.repository';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { TaxSettingsService } from './TaxSettings.service';

/**
 * Resolves the accounts that sales and purchase tax post to. Output tax
 * (sales) and input tax (purchases) use `tax.output_tax_account_id` and
 * `tax.input_tax_account_id` when set. Otherwise both post to the tax
 * payable account, as upstream does.
 */
@Injectable()
export class TaxAccountsService {
  constructor(
    private readonly taxSettings: TaxSettingsService,
    private readonly accountRepository: AccountRepository,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  /**
   * Retrieves the account id that output tax on sales posts to.
   * @param {Knex.Transaction} trx
   * @returns {Promise<number>}
   */
  public async getOutputTaxAccountId(trx?: Knex.Transaction): Promise<number> {
    const { outputTaxAccountId } = await this.taxSettings.getTaxSettings();
    return this.resolveAccountId(outputTaxAccountId, trx);
  }

  /**
   * Retrieves the account id that input tax on purchases posts to.
   * @param {Knex.Transaction} trx
   * @returns {Promise<number>}
   */
  public async getInputTaxAccountId(trx?: Knex.Transaction): Promise<number> {
    const { inputTaxAccountId } = await this.taxSettings.getTaxSettings();
    return this.resolveAccountId(inputTaxAccountId, trx);
  }

  /**
   * The configured account when it still exists, else the tax payable one.
   * @param {number | null} accountId
   * @param {Knex.Transaction} trx
   * @returns {Promise<number>}
   */
  private async resolveAccountId(
    accountId: number | null,
    trx?: Knex.Transaction,
  ): Promise<number> {
    if (accountId) {
      const account = await this.accountModel().query(trx).findById(accountId);
      if (account) return account.id;
    }
    const taxPayableAccount =
      await this.accountRepository.findOrCreateTaxPayable({}, trx);
    return taxPayableAccount.id;
  }
}
