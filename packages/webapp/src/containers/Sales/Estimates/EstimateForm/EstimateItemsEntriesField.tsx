import { x } from '@xstyled/emotion';
import { FastField } from 'formik';
import React from 'react';
import { useEstimateFormContext } from './EstimateFormProvider';
import { entriesFieldShouldUpdate } from './utils';
import type { EstimateFormValues } from './utils';
import type { FieldProps } from 'formik';
import {
  DocumentTaxInclusiveSelect,
  useDocumentTaxRates,
} from '@/containers/Entries/DocumentTax';
import { ItemsEntriesTable } from '@/containers/Entries/ItemsEntriesTable';
import { TaxType } from '@/interfaces/TaxRates';

/**
 * Estimate form items entries editor.
 */
export function EstimateFormItemsEntriesField() {
  const { items } = useEstimateFormContext();
  const { taxRates, isExtendedDocumentsTax } = useDocumentTaxRates();

  return (
    <x.div p="18px 32px 0">
      {isExtendedDocumentsTax && <DocumentTaxInclusiveSelect />}
      <FastField
        name={'entries'}
        items={items}
        taxRates={taxRates}
        shouldUpdate={entriesFieldShouldUpdate}
      >
        {({
          form: { values, setFieldValue },
          field: { value },
          meta: { error },
        }: FieldProps<any[], EstimateFormValues>) => (
          <ItemsEntriesTable
            value={value}
            onChange={(entries) => {
              setFieldValue('entries', entries);
            }}
            items={items}
            errors={error}
            linesNumber={4}
            currencyCode={values.currencyCode}
            taxRates={taxRates}
            enableTaxRates={isExtendedDocumentsTax}
            isInclusiveTax={values.inclusiveExclusiveTax === TaxType.Inclusive}
          />
        )}
      </FastField>
    </x.div>
  );
}
