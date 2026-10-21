import React from 'react';
import type { PreferencesMenuItem } from './types';
import { FormattedMessage as T } from '@/components';
import { Features } from '@/constants/features';
import { HiddenModule } from '@/hooks/useHiddenModules';

export const PreferencesMenu: PreferencesMenuItem[] = [
  {
    text: <T id={'general'} />,
    disabled: false,
    href: '/preferences/general',
  },
  {
    text: 'Appearance',
    disabled: false,
    href: '/preferences/appearance',
  },
  {
    text: 'Branding',
    disabled: false,
    href: '/preferences/branding',
  },
  // {
  //   text: 'Billing',
  //   href: '/preferences/billing',
  // },
  {
    text: <T id={'users'} />,
    href: '/preferences/users',
  },
  {
    text: 'Payment Methods',
    href: '/preferences/payment-methods',
    module: HiddenModule.Stripe,
  },
  {
    text: <T id={'preferences.estimates'} />,
    href: '/preferences/estimates',
  },
  {
    text: <T id={'preferences.invoices'} />,
    href: '/preferences/invoices',
  },
  {
    text: <T id={'preferences.receipts'} />,
    href: '/preferences/receipts',
  },
  {
    text: <T id={'preferences.creditNotes'} />,
    href: '/preferences/credit-notes',
  },
  {
    text: <T id={'currencies'} />,
    href: '/preferences/currencies',
  },
  {
    text: <T id={'branches.label'} />,
    href: '/preferences/branches',
    module: HiddenModule.Branches,
  },
  {
    text: <T id={'warehouses.label'} />,
    href: '/preferences/warehouses',
    module: HiddenModule.Warehouses,
  },
  {
    text: <T id={'accountant'} />,
    disabled: false,
    href: '/preferences/accountant',
  },
  {
    text: <T id={'features.label'} />,
    disabled: false,
    href: '/preferences/features',
  },
  {
    text: <T id={'items'} />,
    disabled: false,
    href: '/preferences/items',
  },
  // {
  //   text: 'Integrations',
  //   disabled: false,
  //   href: '/preferences/integrations'
  // },
  {
    text: 'API Keys',
    disabled: false,
    href: '/preferences/api-keys',
  },
  {
    text: <T id={'sms_integration.label'} />,
    disabled: false,
    href: '/preferences/sms-message',
    feature: Features.SmsNotifications,
  },
];
