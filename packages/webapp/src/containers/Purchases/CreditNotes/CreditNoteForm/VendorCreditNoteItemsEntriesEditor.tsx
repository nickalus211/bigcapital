import classNames from 'classnames';
import { FastField } from 'formik';
import React from 'react';
import { entriesFieldShouldUpdate, type VendorCreditFormValues } from './utils';
import { useVendorCreditNoteFormContext } from './VendorCreditNoteFormProvider';
import type { FieldProps } from 'formik';
import { CLASSES } from '@/constants/classes';
import {
  DocumentTaxInclusiveSelect,
  useDocumentTaxRates,
} from '@/containers/Entries/DocumentTax';
import { ItemsEntriesTable } from '@/containers/Entries/ItemsEntriesTable';
import { TaxType } from '@/interfaces/TaxRates';

export function VendorCreditNoteItemsEntriesEditor() {
  const { items } = useVendorCreditNoteFormContext();
  const { taxRates, isExtendedDocumentsTax } = useDocumentTaxRates();
  return (
    <div className={classNames(CLASSES.PAGE_FORM_BODY)}>
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
        }: FieldProps<any[], VendorCreditFormValues>) => (
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
    </div>
  );
}
