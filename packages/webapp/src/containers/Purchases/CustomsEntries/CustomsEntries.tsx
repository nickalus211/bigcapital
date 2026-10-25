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
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import type { CustomsEntryCalculation } from '@bigcapital/sdk-ts';
import { AppToaster, DashboardPageContent } from '@/components';
import {
  useAccounts,
  useBills,
  useCustomsEntries,
  useCustomsEntry,
  useCustomsEntryCalculation,
  useDeleteCustomsEntry,
  useSaveCustomsEntry,
} from '@/hooks/query';

const PAYMENT_ACCOUNT_TYPES = ['cash', 'bank', 'credit-card'];

/** Inputs of the form; amounts left empty are computed by the server. */
const AMOUNT_FIELDS = [
  ['fobAmount', 'FOB value'],
  ['freightAmount', 'Freight'],
  ['insuranceAmount', 'Insurance'],
  ['customsDutyRate', 'Customs Duty rate %'],
  ['customsDutyAmount', 'Customs Duty (CD)'],
  ['scfAmount', 'Standard Compliance Fee (SCF)'],
  ['eplAmount', 'Environmental Protection Levy (EPL)'],
  ['asdAmount', 'Additional Stamp Duty (ASD)'],
  ['sctAmount', 'Special Consumption Tax (SCT)'],
  ['cafAmount', 'Customs Administration Fee (CAF)'],
  ['importGctAmount', 'Import GCT'],
  ['advanceGctAmount', 'Advance GCT'],
] as const;

/** Fields the server works out when they are left empty. */
const COMPUTED_FIELDS: Record<string, string> = {
  customsDutyAmount: 'customsDutyAmount',
  scfAmount: 'scfAmount',
  eplAmount: 'eplAmount',
  importGctAmount: 'importGctAmount',
  advanceGctAmount: 'advanceGctAmount',
};

type FormValues = Record<string, string>;

const emptyForm = (): FormValues => ({
  entryNumber: '',
  entryDate: moment().format('YYYY-MM-DD'),
  paymentAccountId: '',
  billId: '',
  allocationMethod: 'value',
  referenceNo: '',
  note: '',
  ...Object.fromEntries(AMOUNT_FIELDS.map(([field]) => [field, ''])),
});

const toNumberOrNull = (value: string) =>
  value === '' || value === null || value === undefined ? null : Number(value);

const amountsBody = (values: FormValues) => ({
  entryDate: values.entryDate,
  billId: toNumberOrNull(values.billId),
  allocationMethod: values.allocationMethod as 'value' | 'quantity',
  ...Object.fromEntries(
    AMOUNT_FIELDS.map(([field]) => [field, toNumberOrNull(values[field])]),
  ),
  fobAmount: Number(values.fobAmount || 0),
});

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Jamaica customs entries (C78): duties and taxes paid to clear imports.
 * The duties go into the cost of the goods on the linked bill; import GCT
 * and advance GCT are claimed on the GCT return.
 */
export function CustomsEntries() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { data: entries, isFetching } = useCustomsEntries();
  const { mutateAsync: deleteEntry } = useDeleteCustomsEntry();

  const openForm = (id: number | null) => {
    setEditingId(id);
    setFormOpen(true);
  };
  const handleDelete = (id: number) =>
    deleteEntry(id).then(() => {
      AppToaster.show({
        message: 'The customs entry has been deleted.',
        intent: Intent.SUCCESS,
      });
      if (editingId === id) setFormOpen(false);
    });

  return (
    <DashboardPageContent>
      <PageRoot>
        <Toolbar>
          <Button
            icon={'plus'}
            intent={Intent.PRIMARY}
            onClick={() => openForm(null)}
            data-testId="customs-new"
          >
            New customs entry
          </Button>
          {isFetching && <Spinner size={18} />}
        </Toolbar>

        {formOpen && (
          <CustomsEntryForm
            key={editingId ?? 'new'}
            entryId={editingId}
            onClose={() => setFormOpen(false)}
          />
        )}

        <Card>
          <h3>Customs entries</h3>
          <Table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry no.</th>
                <th>Bill</th>
                <th>CIF</th>
                <th>Duties & fees</th>
                <th>Import GCT</th>
                <th>Advance GCT</th>
                <th>Total paid</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).length === 0 && (
                <tr className="muted">
                  <td colSpan={9}>No customs entries yet.</td>
                </tr>
              )}
              {(entries ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td>{moment(entry.entryDate).format('DD MMM YYYY')}</td>
                  <td>
                    <a onClick={() => openForm(entry.id)}>
                      {entry.entryNumber}
                    </a>
                  </td>
                  <td>
                    {entry.billNumber
                      ? `${entry.billNumber} · ${entry.vendorName ?? ''}`
                      : '—'}
                  </td>
                  <td>{money(entry.cifAmount)}</td>
                  <td>{money(entry.dutiesAmount)}</td>
                  <td>{money(entry.importGctAmount)}</td>
                  <td>{money(entry.advanceGctAmount)}</td>
                  <td>
                    <strong>{money(entry.totalAmount)}</strong>
                  </td>
                  <td>
                    <Button
                      minimal
                      small
                      icon={'trash'}
                      intent={Intent.DANGER}
                      onClick={() => handleDelete(entry.id)}
                      aria-label={'Delete customs entry'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </PageRoot>
    </DashboardPageContent>
  );
}

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const money = (amount: number) => moneyFormat.format(Number(amount) || 0);

function CustomsEntryForm({
  entryId,
  onClose,
}: {
  entryId: number | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState<FormValues>(emptyForm);
  const { data: entry } = useCustomsEntry(entryId);
  const { data: accountsData } = useAccounts({});
  const { data: billsData } = useBills({ pageSize: 200 } as never);
  const { mutateAsync: saveEntry, isPending } = useSaveCustomsEntry();

  // Load the stored entry; computed amounts stay empty unless overridden.
  useEffect(() => {
    if (!entry) return;
    const overridden = new Set(
      (entry.overrides ?? []).map((o) =>
        o.field.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      ),
    );
    const loaded: FormValues = emptyForm();
    Object.keys(loaded).forEach((field) => {
      const value = (entry as Record<string, unknown>)[field];
      if (value === null || value === undefined) return;
      if (COMPUTED_FIELDS[field] && !overridden.has(field)) return;
      loaded[field] = String(value);
    });
    loaded.billId = entry.billId ? String(entry.billId) : '';
    loaded.paymentAccountId = String(entry.paymentAccountId);
    setValues(loaded);
  }, [entry]);

  const accounts = useMemo(
    () =>
      ((accountsData as any[]) ?? []).filter((a) =>
        PAYMENT_ACCOUNT_TYPES.includes(a.accountType),
      ),
    [accountsData],
  );
  const bills = ((billsData as { data?: any[] })?.data ?? []).filter(
    (bill) => bill.isOpen || bill.openedAt,
  );

  const body = useDebounced(
    Number(values.fobAmount) > 0 ? amountsBody(values) : null,
  );
  const calculation = useCustomsEntryCalculation(
    body as never,
    {
      keepPreviousData: true,
      retry: false,
    } as never,
  );

  const set = (field: string) => (e: React.ChangeEvent<any>) =>
    setValues({ ...values, [field]: e.currentTarget.value });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveEntry({
      id: entryId,
      values: {
        ...amountsBody(values),
        entryNumber: values.entryNumber,
        paymentAccountId: Number(values.paymentAccountId),
        referenceNo: values.referenceNo || null,
        note: values.note || null,
      } as never,
    })
      .then(() => {
        AppToaster.show({
          message: 'The customs entry has been saved.',
          intent: Intent.SUCCESS,
        });
        onClose();
      })
      .catch((error) => {
        const type = error?.response?.data?.errors?.[0]?.type;
        AppToaster.show({
          message:
            error?.response?.data?.errors?.[0]?.message ||
            type ||
            'The customs entry could not be saved.',
          intent: Intent.DANGER,
        });
      });
  };

  const computed = calculation.data as CustomsEntryCalculation | undefined;

  return (
    <Card as="form" onSubmit={handleSubmit} data-testId="customs-form">
      <h3>{entryId ? 'Edit customs entry' : 'New customs entry'}</h3>
      <FormGrid>
        <div>
          <FormGroup label={'C78 entry no.'} inline>
            <InputGroup
              value={values.entryNumber}
              onChange={set('entryNumber')}
              data-testId="customs-entry-number"
            />
          </FormGroup>
          <FormGroup label={'Entry date'} inline>
            <InputGroup
              type={'date'}
              value={values.entryDate}
              onChange={set('entryDate')}
            />
          </FormGroup>
          <FormGroup label={'Paid from'} inline>
            <HTMLSelect
              value={values.paymentAccountId}
              onChange={set('paymentAccountId')}
              data-testId="customs-payment-account"
            >
              <option value="">Account…</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </HTMLSelect>
          </FormGroup>
          <FormGroup
            label={'Goods bill'}
            inline
            helperText={'Duties are added to the cost of its inventory items.'}
          >
            <HTMLSelect
              value={values.billId}
              onChange={set('billId')}
              style={{ maxWidth: 300 }}
              data-testId="customs-bill"
            >
              <option value="">None (expense the duties)</option>
              {bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.billNumber} · {bill.vendor?.displayName} ·{' '}
                  {bill.totalFormatted ?? bill.formattedAmount}
                </option>
              ))}
            </HTMLSelect>
          </FormGroup>
          <FormGroup label={'Allocate by'} inline>
            <HTMLSelect
              value={values.allocationMethod}
              onChange={set('allocationMethod')}
            >
              <option value="value">Value</option>
              <option value="quantity">Quantity</option>
            </HTMLSelect>
          </FormGroup>
          {AMOUNT_FIELDS.map(([field, label]) => (
            <FormGroup key={field} label={label} inline>
              <InputGroup
                type={'number'}
                value={values[field]}
                onChange={set(field)}
                placeholder={
                  COMPUTED_FIELDS[field] && computed
                    ? `${(computed as any)[field]} (computed)`
                    : ''
                }
                data-testId={`customs-${field}`}
              />
            </FormGroup>
          ))}
          <FormGroup label={'Reference'} inline>
            <InputGroup
              value={values.referenceNo}
              onChange={set('referenceNo')}
            />
          </FormGroup>
        </div>

        <Summary>
          {!computed && (
            <div className={Classes.TEXT_MUTED}>
              Enter the FOB value to work out the duties.
            </div>
          )}
          {calculation.isError && (
            <Callout intent={Intent.DANGER}>
              {(calculation.error as any)?.response?.data?.errors?.[0]
                ?.message || 'Could not work out the entry.'}
            </Callout>
          )}
          {computed && <CalculationSummary calculation={computed} />}
        </Summary>
      </FormGrid>
      <Toolbar>
        <Button
          type={'submit'}
          intent={Intent.PRIMARY}
          loading={isPending}
          disabled={
            !values.entryNumber ||
            !values.paymentAccountId ||
            !(Number(values.fobAmount) > 0)
          }
          data-testId="customs-save"
        >
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </Toolbar>
    </Card>
  );
}

function CalculationSummary({
  calculation: c,
}: {
  calculation: CustomsEntryCalculation;
}) {
  const rows: [string, number, string?][] = [
    ['CIF value', c.cifAmount, 'total'],
    ['Customs Duty', c.customsDutyAmount],
    ['SCF', c.scfAmount],
    ['EPL', c.eplAmount],
    ['ASD', c.asdAmount],
    ['SCT', c.sctAmount],
    ['CAF', c.cafAmount],
    ['Duties & fees (added to inventory)', c.dutiesAmount, 'total'],
    ['Import GCT base', c.importGctBase, 'muted'],
    [`Import GCT (${c.rates.importGctRate}%)`, c.importGctAmount],
    [`Advance GCT (${c.rates.advanceGctRate}%)`, c.advanceGctAmount],
    ['Recoverable GCT', c.taxesAmount, 'total'],
  ];
  return (
    <>
      {!c.rates.verified && (
        <Callout intent={Intent.WARNING}>
          The customs rates are not verified against current Jamaica Customs
          guidance. Use the amounts on the C78.
        </Callout>
      )}
      <Table>
        <tbody>
          {rows.map(([label, amount, kind]) => (
            <tr key={label} className={kind}>
              <td>{label}</td>
              <td>{money(amount)}</td>
            </tr>
          ))}
          <tr className="grand">
            <td>Total paid to Customs</td>
            <td data-testId="customs-total">{money(c.totalAmount)}</td>
          </tr>
        </tbody>
      </Table>
      {c.overrides.length > 0 && (
        <div className={Classes.TEXT_MUTED}>
          C78 amounts used instead of computed:{' '}
          {c.overrides.map((o) => (
            <Tag key={o.field} minimal style={{ marginRight: 4 }}>
              {o.field}: {money(o.amount)} (computed {money(o.computed)})
            </Tag>
          ))}
        </div>
      )}
      {c.allocations.length > 0 && (
        <>
          <h4>Added to inventory cost</h4>
          <Table>
            <tbody>
              {c.allocations.map((allocation) => (
                <tr key={allocation.entryId}>
                  <td>{allocation.itemName}</td>
                  <td>{money(allocation.cost)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}

const PageRoot = styled.div`
  padding: 20px;
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Card = styled.div`
  background: var(--color-financial-sheet-card-background, #fff);
  border: 1px solid var(--color-financial-sheet-card-border, #d2dce2);
  padding: 20px 24px;

  .bp4-dark & {
    background: var(--color-dark-gray2);
    border-color: var(--color-dark-gray5);
  }
  h3 {
    margin: 0 0 12px;
  }
  h4 {
    margin: 12px 0 4px;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin-bottom: 16px;

  .bp4-form-group.bp4-inline {
    margin-bottom: 8px;
  }
  .bp4-form-group.bp4-inline label.bp4-label {
    min-width: 230px;
  }
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Summary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 6px 4px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
    text-align: right;
  }
  th:first-child,
  td:first-child,
  th:nth-child(2),
  td:nth-child(2),
  th:nth-child(3),
  td:nth-child(3) {
    text-align: left;
  }
  tbody tr td:last-child {
    text-align: right;
  }
  tr.total td,
  tr.grand td {
    font-weight: 600;
  }
  tr.grand td {
    border-top: 2px solid currentColor;
  }
  tr.muted td {
    opacity: 0.65;
    font-size: 12px;
  }
  a {
    cursor: pointer;
  }
`;
