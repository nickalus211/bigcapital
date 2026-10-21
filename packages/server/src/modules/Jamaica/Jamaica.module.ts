import { Module } from '@nestjs/common';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { FeaturesModule } from '../Features/Features.module';
import { JamaicaFeatureGuard } from './JamaicaFeatureGuard';

/**
 * Jamaica localization (GCT, TAJ reporting, sole-trader tax).
 * All Jamaica-specific logic lives under this module so the core
 * stays mergeable with upstream Bigcapital.
 */
@Module({
  imports: [TenancyModule, FeaturesModule],
  providers: [JamaicaFeatureGuard],
  exports: [JamaicaFeatureGuard],
})
export class JamaicaModule {}
