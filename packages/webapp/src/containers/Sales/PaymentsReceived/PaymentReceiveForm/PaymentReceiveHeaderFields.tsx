import { Position, ControlGroup } from '@blueprintjs/core';
import { css } from '@emotion/css';
import { useTheme } from '@emotion/react';
import { Theme } from '@xstyled/emotion';
import { useFormikContext } from 'formik';
import { isEmpty, toSafeInteger } from 'lodash';
import React, { useMemo } from 'react';
import intl from 'react-intl-universal';
import styled from 'styled-components';
import { PaymentReceiveExchangeRateInputField } from './components';
import { usePaymentReceiveFormContext } from './PaymentReceiveFormProvider';
import { PaymentReceivePaymentNoField } from './PaymentReceivePaymentNoField';
import {
  amountPaymentEntries,
  fullAmountPaymentEntries,
  customersFieldShouldUpdate,
  accountsFieldShouldUpdate,
  type PaymentReceiveFormValues,
} from './utils';
import {
  CustomersSelect,
  FormattedMessage as T,
  FMoneyInputGroup,
  Stack,
  FDateInput,
  ButtonLink,
} from '@/components';
import {
  FFormGroup,
  AccountsSelect,
  FieldRequiredHint,
  Icon,
  InputPrependText,
  CustomerDrawerLink,
  Hint,
  Money,
  FInputGroup,
} from '@/components';
import { ACCOUNT_TYPE } from '@/constants/accountTypes';
import { Features } from '@/constants/features';
import { useDateInputFormatter } from '@/hooks';
import { useFeatureCan } from '@/hooks/state/feature';
import { safeSumBy } from '@/utils';

const getHeaderFieldsStyle = (theme: Theme) => css`
  .${theme.bpPrefix}-form-group {
    margin-bottom: 0;

    &.${theme.bpPrefix}-inline {
      max-width: 470px;
    }
    .${theme.bpPrefix}-label {
      min-width: 160px;
    }
    .${theme.bpPrefix}-form-content {
      width: 100%;
    }
  }
`;

/**
 * Payment receive header fields.
 */
export function PaymentReceiveHeaderFields() {
  const theme = useTheme() as Theme;
  const styleClassName = getHeaderFieldsStyle(theme);
  const dateInputFormatter = useDateInputFormatter();

  const { accounts } = usePaymentReceiveFormContext();

  const {
    values: { entries, currencyCode },
    setFieldValue,
  } = useFormikContext<PaymentReceiveFormValues>();

  const totalDueAmount = useMemo(
    () => safeSumBy(entries, 'dueAmount'),
    [entries],
  );
  const handleReceiveFullAmountClick = () => {
    const newEntries = fullAmountPaymentEntries(entries);
    const fullAmount = safeSumBy(newEntries, 'paymentAmount');

    setFieldValue('entries', newEntries);
    setFieldValue('amount', fullAmount);
  };
  const onFullAmountBlur = (value: string | number) => {
    const newEntries = amountPaymentEntries(toSafeInteger(value), entries);
    setFieldValue('entries', newEntries);
  };

  return (
    <Stack spacing={18} flex={1} className={styleClassName}>
      {/* ------------- Customer name ------------- */}
      <PaymentReceiveCustomerSelect />

      {/* ----------- Exchange rate ----------- */}
      <PaymentReceiveExchangeRateInputField
        name={'exchangeRate'}
        formGroupProps={{ label: ' ', inline: true }}
      />

      {/* ------------- Payment date ------------- */}
      <FFormGroup
        name={'paymentDate'}
        label={intl.get('payment_date')}
        labelInfo={<FieldRequiredHint />}
        inline
        fastField
      >
        <FDateInput
          name={'paymentDate'}
          {...dateInputFormatter}
          popoverProps={{ position: Position.BOTTOM_LEFT, minimal: true }}
          inputProps={{
            leftIcon: <Icon icon={'date-range'} />,
            fill: true,
          }}
          fill
          fastField
        />
      </FFormGroup>

      {/* ------------ Full amount ------------ */}
      <FFormGroup
        name={'amount'}
        label={intl.get('full_amount')}
        inline={true}
        labelInfo={<Hint />}
        fastField
      >
        <>
          <ControlGroup>
            <InputPrependText text={currencyCode}>{null}</InputPrependText>
            <FMoneyInputGroup
              name={'amount'}
              onBlurValue={onFullAmountBlur}
              fastField
            />
          </ControlGroup>

          {!isEmpty(entries) && (
            <ButtonLink
              onClick={handleReceiveFullAmountClick}
              style={{ fontSize: '12px', marginTop: '4px' }}
            >
              <T id={'receive_full_amount'} /> (
              <Money amount={totalDueAmount} currency={currencyCode} />)
            </ButtonLink>
          )}
        </>
      </FFormGroup>

      {/* ------------ Withholding tax (Jamaica) ------------ */}
      <PaymentReceiveWithholdingTaxField />

      {/* ------------ Payment receive no. ------------ */}
      <PaymentReceivePaymentNoField />

      {/* ------------ Deposit account ------------ */}
      <FFormGroup
        name={'depositAccountId'}
        label={intl.get('deposit_to')}
        inline={true}
        labelInfo={<FieldRequiredHint />}
        // @ts-expect-error shouldUpdate is forwarded to FastField at runtime; FormGroupProps type doesn't expose it
        shouldUpdate={accountsFieldShouldUpdate}
        fastField={true}
      >
        <AccountsSelect
          name={'depositAccountId'}
          items={accounts ?? []}
          labelInfo={<FieldRequiredHint />}
          placeholder={<T id={'select_deposit_account'} />}
          filterByTypes={[
            ACCOUNT_TYPE.CASH,
            ACCOUNT_TYPE.BANK,
            ACCOUNT_TYPE.OTHER_CURRENT_ASSET,
          ]}
          shouldUpdate={accountsFieldShouldUpdate}
          fastField={true}
          fill={true}
        />
      </FFormGroup>

      {/* ------------ Reference No. ------------ */}
      <FFormGroup
        name={'referenceNo'}
        label={intl.get('reference')}
        inline
        fastField
      >
        <FInputGroup name={'referenceNo'} fill />
      </FFormGroup>
    </Stack>
  );
}

/** Jamaica withholding tax on specified services, % of the payment. */
const WITHHOLDING_TAX_RATE = 3;

/**
 * Tax the customer withheld from the payment (Jamaica WHT). The deposit
 * account receives the amount less the withheld tax.
 */
function PaymentReceiveWithholdingTaxField() {
  const { featureCan } = useFeatureCan();
  const {
    values: { amount, currencyCode, withholdingTaxAmount },
    setFieldValue,
  } = useFormikContext<PaymentReceiveFormValues>();

  if (!featureCan(Features.Jamaica) && !withholdingTaxAmount) return null;

  const suggested =
    Math.round(Number(amount || 0) * WITHHOLDING_TAX_RATE) / 100;

  return (
    <FFormGroup
      name={'withholdingTaxAmount'}
      label={'Tax withheld by customer'}
      inline={true}
      helperText={
        'Withholding tax the customer kept and paid to TAJ. The deposit is the amount less this tax.'
      }
    >
      <>
        <ControlGroup>
          <InputPrependText text={currencyCode}>{null}</InputPrependText>
          <FMoneyInputGroup name={'withholdingTaxAmount'} />
        </ControlGroup>

        {suggested > 0 && Number(withholdingTaxAmount || 0) !== suggested && (
          <ButtonLink
            onClick={() => setFieldValue('withholdingTaxAmount', suggested)}
            style={{ fontSize: '12px', marginTop: '4px' }}
          >
            Withheld {WITHHOLDING_TAX_RATE}% (
            <Money amount={suggested} currency={currencyCode} />)
          </ButtonLink>
        )}
      </>
    </FFormGroup>
  );
}

const CustomerButtonLink = styled(CustomerDrawerLink)`
  font-size: 11px;
  margin-top: 6px;
`;

type CustomerOption = {
  id: string | number;
  currencyCode?: string;
};

/**
 * Customer select field of payment receive form.
 */
function PaymentReceiveCustomerSelect() {
  const { customers, isNewMode } = usePaymentReceiveFormContext();

  const { values, setFieldValue } =
    useFormikContext<PaymentReceiveFormValues>();

  return (
    <FFormGroup
      label={intl.get('customer_name')}
      inline={true}
      labelInfo={<FieldRequiredHint />}
      name={'customerId'}
      fastField={true}
      // @ts-expect-error shouldUpdate/shouldUpdateDeps are forwarded to FastField at runtime; FormGroupProps type doesn't expose them
      shouldUpdate={customersFieldShouldUpdate}
      shouldUpdateDeps={{ items: customers }}
    >
      <>
        <CustomersSelect
          name={'customerId'}
          items={customers}
          placeholder={<T id={'select_customer_account'} />}
          onItemChange={(customer: CustomerOption) => {
            setFieldValue('customerId', customer.id);
            setFieldValue('amount', '');
            setFieldValue('currencyCode', customer?.currencyCode);
          }}
          popoverFill={true}
          disabled={!isNewMode}
          allowCreate={true}
          fastField={true}
          shouldUpdate={customersFieldShouldUpdate}
          shouldUpdateDeps={{ items: customers }}
        />
        {values.customerId && (
          <CustomerButtonLink customerId={values.customerId}>
            <T id={'view_customer_details'} />
          </CustomerButtonLink>
        )}
      </>
    </FFormGroup>
  );
}
