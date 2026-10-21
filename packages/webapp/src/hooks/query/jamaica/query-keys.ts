// Query key constants for the Jamaica localization
export const JAMAICA_SETTINGS = 'JAMAICA_SETTINGS';

// Query key factory
export const jamaicaKeys = {
  all: () => [JAMAICA_SETTINGS] as const,
  settings: () => [JAMAICA_SETTINGS] as const,
  gctReturn: (query: { fromDate?: string; toDate?: string }) =>
    [JAMAICA_SETTINGS, 'GCT_RETURN', query] as const,
};
