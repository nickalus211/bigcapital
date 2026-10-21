import { Button, Classes, Intent } from '@blueprintjs/core';
import { Form, Formik, type FormikHelpers } from 'formik';
import React from 'react';
import {
  AccountsSelect,
  AppToaster,
  Card,
  CardFooterActions,
  FFormGroup,
  FSwitch,
} from '@/components';
import { ACCOUNT_TYPE } from '@/constants/accountTypes';
import { useAccounts, useSaveSettings, useSettingsTax } from '@/hooks/query';

interface TaxCalculationFormValues {
  calcAfterDiscount: boolean;
  extendedDocuments: boolean;
  defaultFromItem: boolean;
  inputTaxAccountId: number | string;
  outputTaxAccountId: number | string;
}

// AccountsSelect expects a typed array; the SDK AccountsList is a wider list
// response — bridge with a loose cast at the boundary.
const accountsForSelect = (accounts: unknown) => accounts as never;

/**
 * The `tax.*` settings: how GCT is calculated and which accounts it posts to.
 * The Jamaica setup turns the first two on; the item default stays opt-in
 * because it changes what synced documents without a tax rate are charged.
 */
export function TaxCalculationCard() {
  const { data: settings, isLoading } = useSettingsTax();
  const { data: accounts } = useAccounts();
  const { mutateAsync: saveSettings } = useSaveSettings();

  if (isLoading || !settings || !accounts) {
    return null;
  }
  const initialValues: TaxCalculationFormValues = {
    calcAfterDiscount: !!settings.calcAfterDiscount,
    extendedDocuments: !!settings.extendedDocuments,
    defaultFromItem: !!settings.defaultFromItem,
    inputTaxAccountId: (settings.inputTaxAccountId as number) || '',
    outputTaxAccountId: (settings.outputTaxAccountId as number) || '',
  };

  const handleSubmit = (
    values: TaxCalculationFormValues,
    { setSubmitting }: FormikHelpers<TaxCalculationFormValues>,
  ) => {
    const option = (key: string, value: unknown) => ({
      group: 'tax',
      key,
      value,
    });
    saveSettings({
      options: [
        option('calc_after_discount', values.calcAfterDiscount),
        option('extended_documents', values.extendedDocuments),
        option('default_from_item', values.defaultFromItem),
        option('input_tax_account_id', values.inputTaxAccountId || null),
        option('output_tax_account_id', values.outputTaxAccountId || null),
      ],
    } as never)
      .then(() => {
        AppToaster.show({
          message: 'The tax calculation settings have been saved.',
          intent: Intent.SUCCESS,
        });
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Card>
      <h4 className={Classes.HEADING}>Tax calculation</h4>
      <Formik initialValues={initialValues} onSubmit={handleSubmit}>
        {({ isSubmitting }) => (
          <Form>
            <FFormGroup
              name={'calcAfterDiscount'}
              inline
              helperText={
                'Charge GCT on the line after its discount and its share of the document discount. Applies to documents created or edited from now on.'
              }
            >
              <FSwitch
                name={'calcAfterDiscount'}
                label={'Calculate tax after discounts'}
                large
              />
            </FFormGroup>

            <FFormGroup
              name={'extendedDocuments'}
              inline
              helperText={
                'Charge tax on sale receipts, credit notes, vendor credits, estimates and expenses, not only invoices and bills.'
              }
            >
              <FSwitch
                name={'extendedDocuments'}
                label={'Tax on all documents'}
                large
              />
            </FFormGroup>

            <FFormGroup
              name={'defaultFromItem'}
              inline
              helperText={
                "Lines sent without a tax rate take the item's default rate. Lines that send no tax rate on purpose must send tax_rate_id: null. Check your API integrations before turning this on."
              }
            >
              <FSwitch
                name={'defaultFromItem'}
                label={'Default tax rate from the item'}
                large
              />
            </FFormGroup>

            <FFormGroup
              name={'outputTaxAccountId'}
              label={<strong>Output tax account (sales)</strong>}
              helperText={'Tax Payable when empty.'}
            >
              <AccountsSelect
                name={'outputTaxAccountId'}
                items={accountsForSelect(accounts)}
                placeholder={'Tax Payable'}
                filterByTypes={[
                  ACCOUNT_TYPE.TAX_PAYABLE,
                  ACCOUNT_TYPE.OTHER_CURRENT_LIABILITY,
                ]}
                allowCreate={false}
              />
            </FFormGroup>

            <FFormGroup
              name={'inputTaxAccountId'}
              label={<strong>Input tax account (purchases)</strong>}
              helperText={'Tax Payable when empty.'}
            >
              <AccountsSelect
                name={'inputTaxAccountId'}
                items={accountsForSelect(accounts)}
                placeholder={'Tax Payable'}
                filterByTypes={[
                  ACCOUNT_TYPE.OTHER_CURRENT_ASSET,
                  ACCOUNT_TYPE.TAX_PAYABLE,
                ]}
                allowCreate={false}
              />
            </FFormGroup>

            <CardFooterActions>
              <Button
                intent={Intent.PRIMARY}
                loading={isSubmitting}
                type="submit"
                data-testId="tax-calculation-save"
              >
                Save
              </Button>
            </CardFooterActions>
          </Form>
        )}
      </Formik>
    </Card>
  );
}
