import { Module } from '@nestjs/common';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { FeaturesModule } from '../Features/Features.module';
import { TaxRatesModule } from '../TaxRates/TaxRate.module';
import { JamaicaFeatureGuard } from './JamaicaFeatureGuard';
import { JamaicaController } from './Jamaica.controller';
import { JamaicaSetupService } from './setup/JamaicaSetup.service';
import { JamaicaSetupOnOrganizationBuildSubscriber } from './setup/JamaicaSetupOnOrganizationBuild.subscriber';
import { JamaicaSettingsService } from './settings/JamaicaSettings.service';
import { JamaicaTaxInvoiceService } from './tax-invoice/JamaicaTaxInvoice.service';
import { GctReturnService } from './gct-return/GctReturn.service';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { WhtCertificate } from './withholding/models/WhtCertificate.model';
import { WhtCertificatesService } from './withholding/WhtCertificates.service';
import { WhtSummaryService } from './withholding/WhtSummary.service';

const models = [RegisterTenancyModel(WhtCertificate)];

/**
 * Jamaica localization (GCT, TAJ reporting, sole-trader tax).
 * All Jamaica-specific logic lives under this module so the core
 * stays mergeable with upstream Bigcapital.
 */
@Module({
  imports: [TenancyModule, FeaturesModule, TaxRatesModule, ...models],
  controllers: [JamaicaController],
  providers: [
    JamaicaFeatureGuard,
    JamaicaSetupService,
    JamaicaSettingsService,
    JamaicaSetupOnOrganizationBuildSubscriber,
    JamaicaTaxInvoiceService,
    GctReturnService,
    WhtCertificatesService,
    WhtSummaryService,
  ],
  exports: [JamaicaFeatureGuard, JamaicaSetupService, JamaicaTaxInvoiceService],
})
export class JamaicaModule {}
