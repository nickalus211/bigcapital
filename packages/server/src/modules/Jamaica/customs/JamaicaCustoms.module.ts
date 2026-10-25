import { Module } from '@nestjs/common';
import { TenancyModule } from '../../Tenancy/Tenancy.module';
import { RegisterTenancyModel } from '../../Tenancy/TenancyModels/Tenancy.module';
import { ExpensesModule } from '../../Expenses/Expenses.module';
import { BillLandedCostsModule } from '../../EE/BillLandedCosts/BillLandedCosts.module';
import { LedgerModule } from '../../Ledger/Ledger.module';
import { TaxRatesModule } from '../../TaxRates/TaxRate.module';
import { JamaicaModule } from '../Jamaica.module';
import { FeaturesModule } from '../../Features/Features.module';
import { CustomsEntry } from './models/CustomsEntry.model';
import { CustomsEntriesController } from './CustomsEntries.controller';
import { CustomsEntriesService } from './CustomsEntries.service';
import { CustomsAccountsService } from './CustomsAccounts.service';
import { CustomsExpenseGuardSubscriber } from './CustomsExpenseGuard.subscriber';

const models = [RegisterTenancyModel(CustomsEntry)];

/**
 * Jamaica customs entries (C78). Separate from `JamaicaModule`, which the
 * sales modules import, so it can depend on expenses and landed costs.
 */
@Module({
  imports: [
    TenancyModule,
    ExpensesModule,
    BillLandedCostsModule,
    LedgerModule,
    TaxRatesModule,
    JamaicaModule,
    FeaturesModule,
    ...models,
  ],
  controllers: [CustomsEntriesController],
  providers: [
    CustomsEntriesService,
    CustomsAccountsService,
    CustomsExpenseGuardSubscriber,
  ],
})
export class JamaicaCustomsModule {}
