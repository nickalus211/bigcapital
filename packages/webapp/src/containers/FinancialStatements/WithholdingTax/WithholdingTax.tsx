import {
  Button,
  Callout,
  Classes,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import moment from 'moment';
import React, { useState } from 'react';
import styled from 'styled-components';
import type { WhtSummary } from '@bigcapital/sdk-ts';
import { AppToaster, DashboardPageContent } from '@/components';
import {
  useCreateWhtCertificate,
  useCustomers,
  useDeleteWhtCertificate,
  useWhtCertificates,
  useWhtSummary,
} from '@/hooks/query';
import { formattedAmount } from '@/utils';

const formatDate = (date: string | null) =>
  date ? moment(date).format('DD MMM YYYY') : '—';

const STATUS_LABELS: Record<string, { text: string; intent: Intent }> = {
  certified: { text: 'Certified', intent: Intent.SUCCESS },
  missing: { text: 'Certificate missing', intent: Intent.WARNING },
  over_certified: { text: 'More than withheld', intent: Intent.DANGER },
};

/**
 * Withholding tax of a tax year: the tax customers withheld from payments,
 * the certificates they issued, and the credit for the S04 (line F24).
 * Figures come from `GET /api/jamaica/wht-summary`.
 */
export function WithholdingTax() {
  const [year, setYear] = useState(() => moment().year() - 1);
  const [draftYear, setDraftYear] = useState(String(year));
  const summary = useWhtSummary(year, { keepPreviousData: true } as never);
  const certificates = useWhtCertificates({ taxYear: year });

  return (
    <DashboardPageContent>
      <PageRoot>
        <Toolbar className={'no-print'}>
          <FormGroup label={'Tax year'} inline>
            <InputGroup
              type={'number'}
              value={draftYear}
              onChange={(e) => setDraftYear(e.currentTarget.value)}
              style={{ width: 100 }}
              data-testId="wht-year"
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            onClick={() => setYear(Number(draftYear) || year)}
            data-testId="wht-run"
          >
            Run
          </Button>
          <Button icon={'print'} onClick={() => window.print()}>
            Print
          </Button>
          {(summary.isFetching || certificates.isFetching) && (
            <Spinner size={18} />
          )}
        </Toolbar>

        {summary.isError && (
          <Callout intent={Intent.DANGER}>
            The withholding tax summary could not be loaded.
          </Callout>
        )}
        {summary.data && (
          <Sheet data-testId="wht-sheet">
            <WhtSummarySheet data={summary.data} />
            <CertificatesSection
              year={year}
              currencyCode={summary.data.currencyCode}
              certificates={certificates.data ?? []}
            />
          </Sheet>
        )}
      </PageRoot>
    </DashboardPageContent>
  );
}

function WhtSummarySheet({ data }: { data: WhtSummary }) {
  const money = (amount: number) =>
    formattedAmount(amount, data.currencyCode, { money: false });

  return (
    <>
      <SheetHeader>
        <h2>Withholding Tax</h2>
        <div className={Classes.TEXT_MUTED}>
          Tax withheld by customers · {formatDate(data.fromDate)} –{' '}
          {formatDate(data.toDate)}
          {data.rate !== null && ` · rate on specified services ${data.rate}%`}
        </div>
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
            <th>Customer</th>
            <th>TRN</th>
            <th>Payments</th>
            <th>Withheld</th>
            <th>Certified</th>
            <th>Difference</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.customers.length === 0 && (
            <tr className="muted">
              <td colSpan={7}>No withholding tax in this year.</td>
            </tr>
          )}
          {data.customers.map((row) => (
            <tr key={row.customerId}>
              <td>{row.customerName}</td>
              <td>{row.customerTaxNumber || '—'}</td>
              <td>{row.paymentsCount}</td>
              <td>{money(row.withheldAmount)}</td>
              <td>{money(row.certifiedAmount)}</td>
              <td>{money(row.differenceAmount)}</td>
              <td>
                <Tag minimal intent={STATUS_LABELS[row.status]?.intent}>
                  {STATUS_LABELS[row.status]?.text ?? row.status}
                </Tag>
              </td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td />
            <td />
            <td>{money(data.totals.withheldAmount)}</td>
            <td>{money(data.totals.certifiedAmount)}</td>
            <td>{money(data.totals.uncertifiedAmount)}</td>
            <td />
          </tr>
        </tbody>
      </Table>

      <NetLine data-testId="wht-s04-credit">
        <span>S04 line {data.s04.line} · tax withheld (certified)</span>
        <strong>
          {formattedAmount(data.s04.creditAmount, data.currencyCode)}
        </strong>
      </NetLine>
    </>
  );
}

interface CertificateRow {
  id: number;
  customerName?: string;
  certificateNumber: string | null;
  certificateDate: string;
  periodFrom: string | null;
  periodTo: string | null;
  amount: number;
}

function CertificatesSection({
  year,
  currencyCode,
  certificates,
}: {
  year: number;
  currencyCode: string;
  certificates: CertificateRow[];
}) {
  const { mutateAsync: deleteCertificate } = useDeleteWhtCertificate();

  const handleDelete = (id: number) =>
    deleteCertificate(id).then(() =>
      AppToaster.show({
        message: 'The certificate has been deleted.',
        intent: Intent.SUCCESS,
      }),
    );

  return (
    <div>
      <h3>Certificates for {year}</h3>
      <Table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Certificate no.</th>
            <th>Date</th>
            <th>Period</th>
            <th>Amount</th>
            <th className="no-print" />
          </tr>
        </thead>
        <tbody>
          {certificates.length === 0 && (
            <tr className="muted">
              <td colSpan={6}>No certificates recorded.</td>
            </tr>
          )}
          {certificates.map((certificate) => (
            <tr key={certificate.id}>
              <td>{certificate.customerName}</td>
              <td>{certificate.certificateNumber || '—'}</td>
              <td>{formatDate(certificate.certificateDate)}</td>
              <td>
                {certificate.periodFrom || certificate.periodTo
                  ? `${formatDate(certificate.periodFrom)} – ${formatDate(certificate.periodTo)}`
                  : '—'}
              </td>
              <td>
                {formattedAmount(certificate.amount, currencyCode, {
                  money: false,
                })}
              </td>
              <td className="no-print">
                <Button
                  minimal
                  small
                  icon={'trash'}
                  intent={Intent.DANGER}
                  onClick={() => handleDelete(certificate.id)}
                  aria-label={'Delete certificate'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <NewCertificateForm year={year} />
    </div>
  );
}

const emptyCertificate = (year: number) => ({
  customerId: '',
  certificateNumber: '',
  certificateDate: moment().format('YYYY-MM-DD'),
  amount: '',
  taxYear: year,
});

function NewCertificateForm({ year }: { year: number }) {
  const [values, setValues] = useState(() => emptyCertificate(year));
  const { data: customersData } = useCustomers({ pageSize: 1000 } as never);
  const { mutateAsync: createCertificate, isPending } =
    useCreateWhtCertificate();

  React.useEffect(() => setValues(emptyCertificate(year)), [year]);

  const customers =
    (customersData as { data?: { id: number; displayName: string }[] })?.data ??
    [];
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [key]: e.currentTarget.value });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createCertificate({
      customerId: Number(values.customerId),
      certificateNumber: values.certificateNumber || null,
      certificateDate: values.certificateDate,
      taxYear: year,
      amount: Number(values.amount),
    } as never)
      .then(() => {
        AppToaster.show({
          message: 'The certificate has been recorded.',
          intent: Intent.SUCCESS,
        });
        setValues(emptyCertificate(year));
      })
      .catch(() =>
        AppToaster.show({
          message: 'The certificate could not be saved.',
          intent: Intent.DANGER,
        }),
      );
  };

  return (
    <NewForm onSubmit={handleSubmit} className={'no-print'}>
      <HTMLSelect
        value={values.customerId}
        onChange={(e) =>
          setValues({ ...values, customerId: e.currentTarget.value })
        }
        style={{ width: 220 }}
        data-testId="wht-cert-customer"
      >
        <option value="">Customer…</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.displayName}
          </option>
        ))}
      </HTMLSelect>
      <InputGroup
        placeholder={'Certificate no.'}
        value={values.certificateNumber}
        onChange={set('certificateNumber')}
      />
      <InputGroup
        type={'date'}
        value={values.certificateDate}
        onChange={set('certificateDate')}
      />
      <InputGroup
        type={'number'}
        placeholder={'Amount'}
        value={String(values.amount)}
        onChange={set('amount')}
        data-testId="wht-cert-amount"
      />
      <Button
        type={'submit'}
        intent={Intent.PRIMARY}
        loading={isPending}
        disabled={!values.customerId || !(Number(values.amount) > 0)}
      >
        Add certificate
      </Button>
    </NewForm>
  );
}

const PageRoot = styled.div`
  padding: 20px;
  max-width: 980px;

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
  h3 {
    margin: 0 0 8px;
  }
`;

const SheetHeader = styled.div`
  h2 {
    margin: 0 0 2px;
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
  td:first-child,
  th:nth-child(2),
  td:nth-child(2) {
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
    text-align: left;
  }
`;

const NetLine = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  padding: 10px 4px;
  border-top: 2px solid currentColor;
`;

const NewForm = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  .bp4-input-group {
    width: 160px;
  }
`;
