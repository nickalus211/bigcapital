import { useQueryClient } from '@tanstack/react-query';
import { usersKeys } from './query/users/query-keys';

/**
 * Modules hidden from the webapp through the server `HIDDEN_MODULES` env.
 */
export const HiddenModule = {
  Stripe: 'stripe',
  Subscription: 'subscription',
  Workspaces: 'workspaces',
  Branches: 'branches',
  Warehouses: 'warehouses',
  Plaid: 'plaid',
} as const;

/**
 * Retrieves the hidden modules from the dashboard boot meta, which is
 * loaded before the dashboard renders.
 */
export function useHiddenModules() {
  const queryClient = useQueryClient();
  const meta = queryClient.getQueryData<{ hiddenModules?: string[] }>(
    usersKeys.dashboardMeta(),
  );
  const hiddenModules = meta?.hiddenModules ?? [];

  return {
    hiddenModules,
    isModuleHidden: (module?: string) =>
      !!module && hiddenModules.includes(module),
  };
}
