import {
  createWhtCertificate,
  deleteWhtCertificate,
  editJamaicaSettings,
  fetchGctReturn,
  fetchWhtCertificates,
  fetchWhtSummary,
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
  CreateWhtCertificateBody,
  WhtCertificate,
  WhtCertificatesQuery,
  WhtSummary,
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

export function useWhtSummary(
  year?: number,
  props?: Omit<UseQueryOptions<WhtSummary>, 'queryKey' | 'queryFn'>,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    ...props,
    queryKey: jamaicaKeys.whtSummary(year),
    queryFn: () => fetchWhtSummary(fetcher, { year }),
  });
}

export function useWhtCertificates(
  query: WhtCertificatesQuery,
  props?: Omit<UseQueryOptions<WhtCertificate[]>, 'queryKey' | 'queryFn'>,
) {
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });
  return useQuery({
    ...props,
    queryKey: jamaicaKeys.whtCertificates(query),
    queryFn: () => fetchWhtCertificates(fetcher, query),
  });
}

export function useCreateWhtCertificate(
  props?: UseMutationOptions<WhtCertificate, Error, CreateWhtCertificateBody>,
) {
  const client = useQueryClient();
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useMutation({
    ...props,
    mutationFn: (values: CreateWhtCertificateBody) =>
      createWhtCertificate(fetcher, values),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: jamaicaKeys.all() });
    },
  });
}

export function useDeleteWhtCertificate(
  props?: UseMutationOptions<void, Error, number>,
) {
  const client = useQueryClient();
  const fetcher = useApiFetcher({ enableCamelCaseTransform: true });

  return useMutation({
    ...props,
    mutationFn: (id: number) => deleteWhtCertificate(fetcher, id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: jamaicaKeys.all() });
    },
  });
}
