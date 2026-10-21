import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import {
  OpForPath,
  OpRequestBody,
  OpResponseBody,
} from './utils';

export const JAMAICA_ROUTES = {
  SETUP: '/api/jamaica/setup',
  SETTINGS: '/api/jamaica/settings',
  GCT_RETURN: '/api/jamaica/gct-return',
} as const satisfies Record<string, keyof paths>;

export type JamaicaSettings = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.SETTINGS, 'get'>
>;
export type EditJamaicaSettingsBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.SETTINGS, 'put'>
>;
export type JamaicaSetupReport = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.SETUP, 'post'>
>;
export type GctReturn = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.GCT_RETURN, 'get'>
>;
export interface GctReturnQuery {
  fromDate?: string;
  toDate?: string;
}

/**
 * Retrieves the GCT return (Form 4A style) of the given period.
 */
export async function fetchGctReturn(
  fetcher: ApiFetcher,
  query: GctReturnQuery = {},
): Promise<GctReturn> {
  const get = fetcher.path(JAMAICA_ROUTES.GCT_RETURN).method('get').create();
  const { data } = await get(query as never);
  return data;
}

export type JamaicaSetupBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.SETUP, 'post'>
>;

export async function fetchJamaicaSettings(
  fetcher: ApiFetcher,
): Promise<JamaicaSettings> {
  const get = fetcher.path(JAMAICA_ROUTES.SETTINGS).method('get').create();
  const { data } = await get({});
  return data;
}

export async function editJamaicaSettings(
  fetcher: ApiFetcher,
  body: EditJamaicaSettingsBody,
): Promise<JamaicaSettings> {
  const put = fetcher.path(JAMAICA_ROUTES.SETTINGS).method('put').create();
  const { data } = await put(body);
  return data;
}

export async function runJamaicaSetup(
  fetcher: ApiFetcher,
  body?: JamaicaSetupBody,
): Promise<JamaicaSetupReport> {
  const post = fetcher.path(JAMAICA_ROUTES.SETUP).method('post').create();
  const { data } = await post(body ?? {});
  return data;
}
