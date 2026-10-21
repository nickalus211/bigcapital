import { FastField } from 'formik';
import React from 'react';
import { useCreditNoteFormContext } from './CreditNoteFormProvider';
import { entriesFieldShouldUpdate } from './utils';
import type { CreditNoteFormValues } from './utils';
import type { FieldProps } from 'formik';
import { Box } from '@/components';
import {
  DocumentTaxInclusiveSelect,
  useDocumentTaxRates,
} from '@/containers/Entries/DocumentTax';
import { ItemsEntriesTable } from '@/containers/Entries/ItemsEntriesTable';
import { TaxType } from '@/interfaces/TaxRates';

/**
 * Credit note items entries editor field.
 */
export function CreditNoteItemsEntriesEditorField() {
  const { items } = useCreditNoteFormContext();
  const { taxRates, isExtendedDocumentsTax } = useDocumentTaxRates();

  return (
    <Box p="18px 32px 0">
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
        }: FieldProps<any[], CreditNoteFormValues>) => (
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
    </Box>
  );
}
