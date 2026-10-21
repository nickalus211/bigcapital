import { FastField } from 'formik';
import React from 'react';
import { ExpenseFormEntriesTable } from './ExpenseFormEntriesTable';
import { useExpenseFormContext } from './ExpenseFormPageProvider';
import { defaultExpenseEntry, accountsFieldShouldUpdate } from './utils';
import type { ExpenseEntry, ExpenseFormValues } from './types';
import { Features } from '@/constants';
import {
  DocumentTaxInclusiveSelect,
  useDocumentTaxRates,
} from '@/containers/Entries/DocumentTax';
import { useFeatureCan } from '@/hooks/state';

type ExpenseFormEntriesFieldProps = {
  linesNumber?: number;
};

/**
 * Expense form entries field.
 */
export function ExpenseFormEntriesField({
  linesNumber = 4,
}: ExpenseFormEntriesFieldProps) {
  const { accounts } = useExpenseFormContext();
  const { featureCan } = useFeatureCan();
  const isLandedCostEnabled = featureCan(Features.LandedCost);
  const { taxRates, isExtendedDocumentsTax } = useDocumentTaxRates();

  return (
    <>
      {isExtendedDocumentsTax && (
        <DocumentTaxInclusiveSelect recomputeEntries={false} />
      )}
      <FastField
        name={'categories'}
        accounts={accounts}
        taxRates={taxRates}
        shouldUpdate={accountsFieldShouldUpdate}
      >
        {({
          form: { values, setFieldValue },
          field: { value },
          meta: { error, touched },
        }: any) => (
          <ExpenseFormEntriesTable
            entries={value}
            error={error}
            onChange={(entries: ExpenseEntry[]) => {
              setFieldValue('categories', entries);
            }}
            defaultEntry={defaultExpenseEntry}
            currencyCode={(values as ExpenseFormValues).currencyCode}
            landedCost={isLandedCostEnabled}
            taxRates={isExtendedDocumentsTax ? taxRates : undefined}
          />
        )}
      </FastField>
    </>
  );
}
