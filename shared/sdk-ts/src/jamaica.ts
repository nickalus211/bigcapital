import type { ApiFetcher } from "./fetch-utils";
import { paths } from "./schema";
import { OpForPath, OpRequestBody, OpResponseBody } from "./utils";

export const JAMAICA_ROUTES = {
  SETUP: "/api/jamaica/setup",
  SETTINGS: "/api/jamaica/settings",
  GCT_RETURN: "/api/jamaica/gct-return",
  WHT_SUMMARY: "/api/jamaica/wht-summary",
  WHT_CERTIFICATES: "/api/jamaica/wht-certificates",
  WHT_CERTIFICATE: "/api/jamaica/wht-certificates/{id}",
  CUSTOMS_ENTRIES: "/api/jamaica/customs-entries",
  CUSTOMS_ENTRY: "/api/jamaica/customs-entries/{id}",
  CUSTOMS_CALCULATE: "/api/jamaica/customs-entries/calculate",
} as const satisfies Record<string, keyof paths>;

export type JamaicaSettings = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.SETTINGS, "get">
>;
export type EditJamaicaSettingsBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.SETTINGS, "put">
>;
export type JamaicaSetupReport = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.SETUP, "post">
>;
export type GctReturn = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.GCT_RETURN, "get">
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
  const get = fetcher.path(JAMAICA_ROUTES.GCT_RETURN).method("get").create();
  const { data } = await get(query as never);
  return data;
}

export type JamaicaSetupBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.SETUP, "post">
>;

export async function fetchJamaicaSettings(
  fetcher: ApiFetcher,
): Promise<JamaicaSettings> {
  const get = fetcher.path(JAMAICA_ROUTES.SETTINGS).method("get").create();
  const { data } = await get({});
  return data;
}

export async function editJamaicaSettings(
  fetcher: ApiFetcher,
  body: EditJamaicaSettingsBody,
): Promise<JamaicaSettings> {
  const put = fetcher.path(JAMAICA_ROUTES.SETTINGS).method("put").create();
  const { data } = await put(body);
  return data;
}

export async function runJamaicaSetup(
  fetcher: ApiFetcher,
  body?: JamaicaSetupBody,
): Promise<JamaicaSetupReport> {
  const post = fetcher.path(JAMAICA_ROUTES.SETUP).method("post").create();
  const { data } = await post(body ?? {});
  return data;
}

export type WhtSummary = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.WHT_SUMMARY, "get">
>;
export type WhtCertificate = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.WHT_CERTIFICATE, "get">
>;
export type CreateWhtCertificateBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.WHT_CERTIFICATES, "post">
>;
export type EditWhtCertificateBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.WHT_CERTIFICATE, "put">
>;
export interface WhtCertificatesQuery {
  taxYear?: number;
  customerId?: number;
}

/**
 * Retrieves the withholding tax summary of a tax year (default: last year).
 */
export async function fetchWhtSummary(
  fetcher: ApiFetcher,
  query: { year?: number } = {},
): Promise<WhtSummary> {
  const get = fetcher.path(JAMAICA_ROUTES.WHT_SUMMARY).method("get").create();
  const { data } = await get(query as never);
  return data;
}

export async function fetchWhtCertificates(
  fetcher: ApiFetcher,
  query: WhtCertificatesQuery = {},
): Promise<WhtCertificate[]> {
  const get = fetcher
    .path(JAMAICA_ROUTES.WHT_CERTIFICATES)
    .method("get")
    .create();
  const { data } = await get(query as never);
  return data as unknown as WhtCertificate[];
}

export async function createWhtCertificate(
  fetcher: ApiFetcher,
  body: CreateWhtCertificateBody,
): Promise<WhtCertificate> {
  const post = fetcher
    .path(JAMAICA_ROUTES.WHT_CERTIFICATES)
    .method("post")
    .create();
  const { data } = await post(body);
  return data as unknown as WhtCertificate;
}

export async function editWhtCertificate(
  fetcher: ApiFetcher,
  id: number,
  body: EditWhtCertificateBody,
): Promise<WhtCertificate> {
  const put = fetcher
    .path(JAMAICA_ROUTES.WHT_CERTIFICATE)
    .method("put")
    .create();
  const { data } = await put({ id, ...body } as never);
  return data;
}

export async function deleteWhtCertificate(
  fetcher: ApiFetcher,
  id: number,
): Promise<void> {
  const del = fetcher
    .path(JAMAICA_ROUTES.WHT_CERTIFICATE)
    .method("delete")
    .create();
  await del({ id } as never);
}

export type CustomsEntry = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.CUSTOMS_ENTRY, "get">
>;
export type CustomsEntryCalculation = OpResponseBody<
  OpForPath<typeof JAMAICA_ROUTES.CUSTOMS_CALCULATE, "post">
>;
export type CalculateCustomsEntryBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.CUSTOMS_CALCULATE, "post">
>;
export type CreateCustomsEntryBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.CUSTOMS_ENTRIES, "post">
>;
export type EditCustomsEntryBody = OpRequestBody<
  OpForPath<typeof JAMAICA_ROUTES.CUSTOMS_ENTRY, "put">
>;
export interface CustomsEntriesQuery {
  fromDate?: string;
  toDate?: string;
}

/**
 * Works out the duties and taxes of a customs entry (C78) without saving it.
 */
export async function calculateCustomsEntry(
  fetcher: ApiFetcher,
  body: CalculateCustomsEntryBody,
): Promise<CustomsEntryCalculation> {
  const post = fetcher
    .path(JAMAICA_ROUTES.CUSTOMS_CALCULATE)
    .method("post")
    .create();
  const { data } = await post(body);
  return data;
}

export async function fetchCustomsEntries(
  fetcher: ApiFetcher,
  query: CustomsEntriesQuery = {},
): Promise<CustomsEntry[]> {
  const get = fetcher
    .path(JAMAICA_ROUTES.CUSTOMS_ENTRIES)
    .method("get")
    .create();
  const { data } = await get(query as never);
  return data as unknown as CustomsEntry[];
}

export async function fetchCustomsEntry(
  fetcher: ApiFetcher,
  id: number,
): Promise<CustomsEntry> {
  const get = fetcher.path(JAMAICA_ROUTES.CUSTOMS_ENTRY).method("get").create();
  const { data } = await get({ id } as never);
  return data;
}

export async function createCustomsEntry(
  fetcher: ApiFetcher,
  body: CreateCustomsEntryBody,
): Promise<CustomsEntry> {
  const post = fetcher
    .path(JAMAICA_ROUTES.CUSTOMS_ENTRIES)
    .method("post")
    .create();
  const { data } = await post(body);
  return data as unknown as CustomsEntry;
}

export async function editCustomsEntry(
  fetcher: ApiFetcher,
  id: number,
  body: EditCustomsEntryBody,
): Promise<CustomsEntry> {
  const put = fetcher.path(JAMAICA_ROUTES.CUSTOMS_ENTRY).method("put").create();
  const { data } = await put({ id, ...body } as never);
  return data;
}

export async function deleteCustomsEntry(
  fetcher: ApiFetcher,
  id: number,
): Promise<void> {
  const del = fetcher
    .path(JAMAICA_ROUTES.CUSTOMS_ENTRY)
    .method("delete")
    .create();
  await del({ id } as never);
}
