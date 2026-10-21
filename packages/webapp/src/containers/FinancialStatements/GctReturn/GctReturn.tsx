import {
  Button,
  Callout,
  Classes,
  FormGroup,
  InputGroup,
  Intent,
  Spinner,
} from '@blueprintjs/core';
import moment from 'moment';
import React, { useState } from 'react';
import styled from 'styled-components';
import type { GctReturn as GctReturnData } from '@bigcapital/sdk-ts';
import { DashboardPageContent } from '@/components';
import { useGctReturn } from '@/hooks/query';
import { formattedAmount } from '@/utils';

const lastMonth = () => {
  const month = moment().subtract(1, 'month');
  return {
    fromDate: month.clone().startOf('month').format('YYYY-MM-DD'),
    toDate: month.clone().endOf('month').format('YYYY-MM-DD'),
  };
};

const formatDate = (date: string) => moment(date).format('DD MMM YYYY');

/**
 * GCT return (Form 4A style) for a period, laid out for transcription into
 * TAJ eServices. Figures come from `GET /api/jamaica/gct-return`.
 */
export function GctReturn() {
  const [period, setPeriod] = useState(lastMonth);
  const [draft, setDraft] = useState(period);
  const { data, isFetching, isError } = useGctReturn(period, {
    keepPreviousData: true,
  } as never);

  return (
    <DashboardPageContent>
      <PageRoot>
        <Toolbar className={'no-print'}>
          <FormGroup label={'From'} inline>
            <InputGroup
              type={'date'}
              value={draft.fromDate}
              onChange={(e) =>
                setDraft({ ...draft, fromDate: e.currentTarget.value })
              }
              data-testId="gct-return-from-date"
            />
          </FormGroup>
          <FormGroup label={'To'} inline>
            <InputGroup
              type={'date'}
              value={draft.toDate}
              onChange={(e) =>
                setDraft({ ...draft, toDate: e.currentTarget.value })
              }
              data-testId="gct-return-to-date"
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            onClick={() => setPeriod(draft)}
            data-testId="gct-return-run"
          >
            Run
          </Button>
          <Button icon={'print'} onClick={() => window.print()}>
            Print
          </Button>
          {isFetching && <Spinner size={18} />}
        </Toolbar>

        {isError && (
          <Callout intent={Intent.DANGER}>
            The GCT return could not be loaded.
          </Callout>
        )}
        {data && <GctReturnSheet data={data} />}
      </PageRoot>
    </DashboardPageContent>
  );
}

function GctReturnSheet({ data }: { data: GctReturnData }) {
  const money = (amount: number) =>
    formattedAmount(amount, data.currencyCode, { money: false });
  const { supplies, purchases, apportionment, organization } = data;

  return (
    <Sheet data-testId="gct-return-sheet">
      <SheetHeader>
        <h2>GCT Return</h2>
        <div className={Classes.TEXT_MUTED}>Form 4A style · accrual basis</div>
        <dl>
          <dt>Taxpayer</dt>
          <dd>{organization.name}</dd>
          <dt>TRN</dt>
          <dd>{organization.trn || '—'}</dd>
          <dt>GCT registration no.</dt>
          <dd>{organization.gctRegistrationNumber || '—'}</dd>
          <dt>Period</dt>
          <dd>
            {formatDate(data.fromDate)} – {formatDate(data.toDate)}
          </dd>
          <dt>Due by</dt>
          <dd>{formatDate(data.dueDate)}</dd>
        </dl>
      </SheetHeader>

      {data.warnings.length > 0 && (
        <Callout intent={Intent.WARNING} title={'Check before filing'}>
          <ul>
            {data.warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        </Callout>
      )}

      <Table>
        <thead>
          <tr>
            <th>Supplies (sales)</th>
            <th>Value excl. GCT</th>
            <th>GCT</th>
          </tr>
        </thead>
        <tbody>
          {supplies.standardRated.map((line) => (
            <tr key={line.taxRateId}>
              <td>
                Standard-rated · {line.name} ({line.rate}%)
              </td>
              <td>{money(line.taxableAmount)}</td>
              <td>{money(line.taxAmount)}</td>
            </tr>
          ))}
          <tr>
            <td>Zero-rated supplies</td>
            <td>{money(supplies.zeroRatedAmount)}</td>
            <td />
          </tr>
          <tr>
            <td>Exempt supplies</td>
            <td>{money(supplies.exemptAmount)}</td>
            <td />
          </tr>
          <tr className="total">
            <td>Total supplies</td>
            <td>{money(supplies.totalAmount)}</td>
            <td />
          </tr>
          <tr className="total">
            <td>Output tax</td>
            <td />
            <td>{money(data.outputTax)}</td>
          </tr>
          {[
            ['Out of scope (not declared)', supplies.outOfScopeAmount],
            ['Tax rate without a tax type', supplies.unclassifiedAmount],
            ['No tax rate', supplies.noTaxRateAmount],
          ]
            .filter(([, amount]) => amount)
            .map(([label, amount]) => (
              <tr key={label as string} className="muted">
                <td>{label}</td>
                <td>{money(amount as number)}</td>
                <td />
              </tr>
            ))}
        </tbody>
      </Table>

      <Table>
        <thead>
          <tr>
            <th>Purchases and expenses</th>
            <th>Value excl. GCT</th>
            <th>GCT</th>
          </tr>
        </thead>
        <tbody>
          {purchases.standardRated.map((line) => (
            <tr key={line.taxRateId}>
              <td>
                Standard-rated · {line.name} ({line.rate}%)
              </td>
              <td>{money(line.taxableAmount)}</td>
              <td>{money(line.taxAmount)}</td>
            </tr>
          ))}
          <tr>
            <td>Zero-rated and exempt purchases</td>
            <td>{money(purchases.zeroRatedAndExemptAmount)}</td>
            <td />
          </tr>
          <tr className="total">
            <td>Input tax</td>
            <td />
            <td>{money(purchases.inputTax)}</td>
          </tr>
          {apportionment.enabled && (
            <>
              <tr>
                <td>
                  Apportionment: taxable{' '}
                  {money(apportionment.taxableSuppliesAmount)} ÷ total{' '}
                  {money(apportionment.totalSuppliesAmount)} ={' '}
                  {(apportionment.ratio * 100).toFixed(2)}%
                </td>
                <td />
                <td />
              </tr>
              <tr className="muted">
                <td>Input tax not claimable (exempt supplies)</td>
                <td />
                <td>{money(apportionment.disallowedInputTax)}</td>
              </tr>
            </>
          )}
          <tr className="total">
            <td>Input tax claimable</td>
            <td />
            <td>{money(apportionment.claimableInputTax)}</td>
          </tr>
        </tbody>
      </Table>

      <NetLine data-testId="gct-return-net">
        <span>
          {data.position === 'refundable'
            ? 'Net GCT refundable'
            : 'Net GCT payable'}
        </span>
        <strong>
          {formattedAmount(Math.abs(data.netGct), data.currencyCode)}
        </strong>
      </NetLine>
    </Sheet>
  );
}

const PageRoot = styled.div`
  padding: 20px;
  max-width: 900px;

  @media print {
    .no-print {
      display: none;
    }
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;

  .bp4-form-group {
    margin-bottom: 0;
  }
`;

const Sheet = styled.div`
  background: var(--color-financial-sheet-card-background, #fff);
  border: 1px solid var(--color-financial-sheet-card-border, #d2dce2);
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  .bp4-dark & {
    background: var(--color-dark-gray2);
    border-color: var(--color-dark-gray5);
  }

  ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
`;

const SheetHeader = styled.div`
  h2 {
    margin: 0 0 2px;
  }
  dl {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 4px 12px;
    margin: 14px 0 0;
  }
  dt {
    opacity: 0.7;
  }
  dd {
    margin: 0;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 7px 4px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    text-align: right;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  th {
    font-weight: 600;
  }
  tr.total td {
    font-weight: 600;
  }
  tr.muted td {
    opacity: 0.65;
    font-size: 12px;
  }
`;

const NetLine = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  padding: 10px 4px;
  border-top: 2px solid currentColor;
`;
