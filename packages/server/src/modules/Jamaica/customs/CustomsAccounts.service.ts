import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { Account } from '@/modules/Accounts/models/Account.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import {
  ADVANCE_GCT_SLUG,
  CUSTOMS_DUTIES_SLUG,
  JAMAICA_ACCOUNTS,
} from '../data/jamaica-accounts';

/**
 * Resolves the customs accounts by slug, creating them when missing (the
 * Jamaica setup seeds them; organizations set up earlier may not have them).
 */
@Injectable()
export class CustomsAccountsService {
  constructor(
    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  public getAdvanceGctAccountId(trx?: Knex.Transaction) {
    return this.findOrCreate(ADVANCE_GCT_SLUG, trx);
  }

  public getCustomsDutiesAccountId(trx?: Knex.Transaction) {
    return this.findOrCreate(CUSTOMS_DUTIES_SLUG, trx);
  }

  private async findOrCreate(
    slug: string,
    trx?: Knex.Transaction,
  ): Promise<number> {
    const existing = await this.accountModel().query(trx).findOne({ slug });
    if (existing) return existing.id;

    const seed = JAMAICA_ACCOUNTS.find((account) => account.slug === slug);
    const codeTaken = await this.accountModel()
      .query(trx)
      .findOne({ code: seed.code });

    const created = await this.accountModel()
      .query(trx)
      .insertAndFetch({
        name: seed.name,
        slug: seed.slug,
        accountType: seed.accountType,
        code: codeTaken ? null : seed.code,
        description: seed.description,
        active: true,
        index: 1,
        predefined: true,
      } as Partial<Account>);
    return created.id;
  }
}
