import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpQueryParams, OpResponseBody } from './utils';

export const DASHBOARD_ROUTES = {
  BOOT: '/api/dashboard/boot',
  INSIGHTS: '/api/dashboard/insights',
} as const satisfies Record<string, keyof paths>;

export type GetDashboardBootMetaResponse = OpResponseBody<
  OpForPath<typeof DASHBOARD_ROUTES.BOOT, 'get'>
>;

export async function fetchDashboardBootMeta(
  fetcher: ApiFetcher
): Promise<GetDashboardBootMetaResponse> {
  const get = fetcher.path(DASHBOARD_ROUTES.BOOT).method('get').create();
  const { data } = await get({});
  return data;
}

export type GetDashboardInsightsResponse = OpResponseBody<
  OpForPath<typeof DASHBOARD_ROUTES.INSIGHTS, 'get'>
>;
export type GetDashboardInsightsQuery = OpQueryParams<
  OpForPath<typeof DASHBOARD_ROUTES.INSIGHTS, 'get'>
>;

export async function fetchDashboardInsights(
  fetcher: ApiFetcher,
  query?: GetDashboardInsightsQuery
): Promise<GetDashboardInsightsResponse> {
  const get = fetcher.path(DASHBOARD_ROUTES.INSIGHTS).method('get').create();
  const { data } = await (
    get as (
      params?: GetDashboardInsightsQuery
    ) => Promise<{ data: GetDashboardInsightsResponse }>
  )(query ?? {});
  return data;
}
