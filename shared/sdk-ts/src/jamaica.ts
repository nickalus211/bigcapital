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
