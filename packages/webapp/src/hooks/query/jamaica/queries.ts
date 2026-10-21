import {
  editJamaicaSettings,
  fetchGctReturn,
  fetchJamaicaSettings,
  runJamaicaSetup,
} from '@bigcapital/sdk-ts';
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query';
import { useApiFetcher } from '../../useRequest';
import { usersKeys } from '../users/query-keys';
import { jamaicaKeys } from './query-keys';
import type {
  EditJamaicaSettingsBody,
  GctReturn,
  GctReturnQuery,
  JamaicaSettings,
  JamaicaSetupReport,
} from '@bigcapital/sdk-ts';

export function useJamaicaSettings(
  props?: Omit<UseQueryOptions<JamaicaSettings>, 'queryKey' | 'queryFn'>,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    ...props,
    queryKey: jamaicaKeys.settings(),
    queryFn: () => fetchJamaicaSettings(fetcher),
  });
}

export function useGctReturn(
  query: GctReturnQuery,
  props?: Omit<UseQueryOptions<GctReturn>, 'queryKey' | 'queryFn'>,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    ...props,
    queryKey: jamaicaKeys.gctReturn(query),
    queryFn: () => fetchGctReturn(fetcher, query),
  });
}

export function useEditJamaicaSettings(
  props?: UseMutationOptions<JamaicaSettings, Error, EditJamaicaSettingsBody>,
) {
  const client = useQueryClient();
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useMutation({
    ...props,
    mutationFn: (values: EditJamaicaSettingsBody) =>
      editJamaicaSettings(fetcher, values),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: jamaicaKeys.all() });
    },
  });
}

export function useRunJamaicaSetup(
  props?: UseMutationOptions<JamaicaSetupReport, Error, { dryRun?: boolean }>,
) {
  const client = useQueryClient();
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useMutation({
    ...props,
    mutationFn: ({ dryRun }: { dryRun?: boolean }) =>
      runJamaicaSetup(fetcher, { dryRun: !!dryRun }),
    onSuccess: (_report, { dryRun }) => {
      if (dryRun) return;
      // Setup turns the Jamaica feature on and seeds rates and accounts.
      client.invalidateQueries();
      client.invalidateQueries({ queryKey: usersKeys.dashboardMeta() });
    },
  });
}
