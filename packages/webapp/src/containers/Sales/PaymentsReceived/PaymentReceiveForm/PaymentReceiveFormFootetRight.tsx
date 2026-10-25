import React from 'react';
import styled from 'styled-components';
import {
  usePaymentReceiveTotals,
  usePaymentReceivedTotalExceededAmount,
  usePaymentReceivedWithholding,
} from './utils';
import {
  T,
  TotalLines,
  TotalLine,
  TotalLineBorderStyle,
  TotalLineTextStyle,
  FormatNumber,
} from '@/components';

export function PaymentReceiveFormFootetRight() {
  const { formattedSubtotal, formattedTotal } = usePaymentReceiveTotals();
  const exceededAmount = usePaymentReceivedTotalExceededAmount();
  const { withholdingTaxAmount, depositAmount } =
    usePaymentReceivedWithholding();

  return (
    <PaymentReceiveTotalLines labelColWidth={'180px'} amountColWidth={'180px'}>
      <TotalLine
        title={<T id={'payment_receive_form.label.subtotal'} />}
        value={formattedSubtotal}
        borderStyle={TotalLineBorderStyle.None}
      />
      <TotalLine
        title={<T id={'payment_receive_form.label.total'} />}
        value={formattedTotal}
        textStyle={TotalLineTextStyle.Bold}
      />
      {withholdingTaxAmount > 0 && (
        <>
          <TotalLine
            title={'Tax withheld by customer'}
            value={
              <FormatNumber value={-withholdingTaxAmount} noZero={false} />
            }
            textStyle={TotalLineTextStyle.Regular}
          />
          <TotalLine
            title={'Deposit amount'}
            value={<FormatNumber value={depositAmount} noZero={false} />}
            textStyle={TotalLineTextStyle.Regular}
          />
        </>
      )}
      <TotalLine
        title={'Exceeded Amount'}
        value={<FormatNumber value={exceededAmount} noZero={false} />}
        textStyle={TotalLineTextStyle.Regular}
      />
    </PaymentReceiveTotalLines>
  );
}

const PaymentReceiveTotalLines = styled(TotalLines)`
  --x-color-text: #555;

  .bp4-dark & {
    --x-color-text: var(--color-light-gray4);
  }
  width: 100%;
  color: var(--x-color-text);
`;
