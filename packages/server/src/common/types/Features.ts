export enum Features {
  WAREHOUSES = 'warehouses',
  BRANCHES = 'branches',
  BankSyncing = 'BankSyncing',
  LANDED_COST = 'landed_cost',
  SMS_NOTIFICATIONS = 'sms_notifications',
  SALES_TAX = 'sales_tax',
  JAMAICA = 'jamaica',
}

export interface IFeatureAllItem {
  name: string;
  isAccessible: boolean;
  defaultAccessible: boolean;
}

export interface IFeatureConfiugration {
  name: string;
  defaultValue?: boolean;
}
