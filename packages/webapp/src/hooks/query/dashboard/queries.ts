import { fetchDashboardInsights } from '@bigcapital/sdk-ts';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useApiFetcher } from '../../useRequest';
import type { GetDashboardInsightsResponse } from '@bigcapital/sdk-ts';

export const DASHBOARD_INSIGHTS = 'DASHBOARD_INSIGHTS';

export const dashboardKeys = {
  insights: (months: number) => [DASHBOARD_INSIGHTS, months] as const,
};

/**
 * Money in and out of the cash and bank accounts for the dashboard.
 * @param {number} months - Months including the current one.
 */
export function useDashboardInsights(
  months = 12,
  props?: Omit<
    UseQueryOptions<GetDashboardInsightsResponse>,
    'queryKey' | 'queryFn'
  >,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useQuery({
    ...props,
    queryKey: dashboardKeys.insights(months),
    queryFn: () => fetchDashboardInsights(fetcher, { months }),
  });
}
