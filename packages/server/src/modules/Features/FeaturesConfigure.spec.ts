import { Features } from '@/common/types/Features';
import { FeaturesConfigure } from './FeaturesConfigure';

describe('FeaturesConfigure', () => {
  const configure = new FeaturesConfigure({ get: jest.fn() } as any);

  it('disables the Jamaica localization by default', () => {
    const jamaica = configure
      .getConfigure()
      .find((feature) => feature.name === Features.JAMAICA);

    expect(jamaica).toBeDefined();
    expect(jamaica.defaultValue).toBe(false);
  });
});
