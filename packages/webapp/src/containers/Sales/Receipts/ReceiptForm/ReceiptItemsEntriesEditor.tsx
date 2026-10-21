import { x } from '@xstyled/emotion';
import { FastField } from 'formik';
import React from 'react';
import { useReceiptFormContext } from './ReceiptFormProvider';
import { entriesFieldShouldUpdate } from './utils';
import type { ReceiptFormValues } from './utils';
import type { FieldProps } from 'formik';
import {
  DocumentTaxInclusiveSelect,
  useDocumentTaxRates,
} from '@/containers/Entries/DocumentTax';
import { ItemsEntriesTable } from '@/containers/Entries/ItemsEntriesTable';
import { TaxType } from '@/interfaces/TaxRates';

export function ReceiptItemsEntriesEditor() {
  const { items } = useReceiptFormContext();
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
        }: FieldProps<any[], ReceiptFormValues>) => (
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
