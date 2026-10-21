import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Features } from '@/common/types/Features';
import { FeaturesManager } from '../Features/FeaturesManager';
import { ServiceError } from '@/modules/Items/ServiceError';
import { ERRORS } from './constants';

/**
 * Guard that rejects the Jamaica localization endpoints once the
 * Jamaica feature is not enabled.
 */
@Injectable()
export class JamaicaFeatureGuard implements CanActivate {
  constructor(private readonly featuresManager: FeaturesManager) {}

  /**
   * Validates the Jamaica feature is accessible.
   * @param {ExecutionContext} _context
   * @returns {Promise<boolean>}
   */
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const isAccessible = await this.featuresManager.accessible(
      Features.JAMAICA,
    );
    if (!isAccessible) {
      throw new ServiceError(
        ERRORS.JAMAICA_FEATURE_NOT_ENABLED,
        'The Jamaica localization feature is not enabled.',
      );
    }
    return true;
  }
}
