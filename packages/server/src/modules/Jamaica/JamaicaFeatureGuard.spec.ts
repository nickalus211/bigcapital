import { Features } from '@/common/types/Features';
import { ServiceError } from '@/modules/Items/ServiceError';
import { JamaicaFeatureGuard } from './JamaicaFeatureGuard';
import { ERRORS } from './constants';

describe('JamaicaFeatureGuard', () => {
  const buildGuard = (accessible: boolean) => {
    const featuresManager = {
      accessible: jest.fn().mockResolvedValue(accessible),
    };
    const guard = new JamaicaFeatureGuard(featuresManager as any);
    return { guard, featuresManager };
  };

  it('allows the request when the Jamaica feature is enabled', async () => {
    const { guard, featuresManager } = buildGuard(true);

    await expect(guard.canActivate({} as any)).resolves.toBe(true);
    expect(featuresManager.accessible).toHaveBeenCalledWith(Features.JAMAICA);
  });

  it('rejects the request once the feature is disabled', async () => {
    const { guard } = buildGuard(false);

    try {
      await guard.canActivate({} as any);
      throw new Error('Expected the guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect((error as ServiceError).errorType).toBe(
        ERRORS.JAMAICA_FEATURE_NOT_ENABLED,
      );
    }
  });
});
