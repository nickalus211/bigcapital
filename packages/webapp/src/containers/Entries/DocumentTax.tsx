import { useFormikContext } from 'formik';
import { sumBy } from 'lodash';
import React from 'react';
import styled from 'styled-components';
import { EntriesActionsBar } from './EntriesActionBar';
import { aggregateItemEntriesTaxRates, assignEntriesTaxAmount } from './utils';
import type { TaxRate } from '@bigcapital/sdk-ts';
import {
  FFormGroup,
  FSelect,
  TotalLine,
  TotalLineBorderStyle,
} from '@/components';
import { Features } from '@/constants';
import { useSettingsTax, useTaxRates } from '@/hooks/query';
import { useFeatureCan } from '@/hooks/state';
import { TaxType } from '@/interfaces/TaxRates';
import { toSafeNumber } from '@/utils';

/**
 * Tax on the documents upstream leaves untaxed (receipts, credit notes,
 * vendor credits, estimates, expenses), shown while the `tax.extended_documents`
 * setting and the sales tax feature are on. The server stays the source of
 * truth; these helpers only preview the amounts it will store.
 */

export const DocumentTaxOptions = [
  { key: TaxType.Exclusive, label: 'Exclusive of Tax' },
  { key: TaxType.Inclusive, label: 'Inclusive of Tax' },
];

interface DocumentTaxValues {
  inclusiveExclusiveTax: TaxType;
  entries: Array<{ amount?: string | number; taxRate?: string | number }>;
  discount?: string | number;
  discountType?: 'amount' | 'percentage';
  currencyCode: string;
}

/**
 * Retrieves the tax settings with the sales tax feature applied.
 */
export const useDocumentTaxSettings = () => {
  const { featureCan } = useFeatureCan();
  const { data: settings, isLoading } = useSettingsTax();
  const isSalesTax = featureCan(Features.SalesTax);

  return {
    isLoading,
    isExtendedDocumentsTax: isSalesTax && !!settings?.extendedDocuments,
    isCalcAfterDiscount: !!settings?.calcAfterDiscount,
  };
};

/**
 * Retrieves the tax rates while the extended documents carry tax.
 * @returns {{ taxRates: TaxRate[]; isExtendedDocumentsTax: boolean; isLoading: boolean }}
 */
export const useDocumentTaxRates = () => {
  const { isExtendedDocumentsTax, isLoading: isSettingsLoading } =
    useDocumentTaxSettings();
  const { data: taxRates, isLoading: isTaxRatesLoading } = useTaxRates({
    enabled: isExtendedDocumentsTax,
  });
  return {
    taxRates: (taxRates ?? []) as TaxRate[],
    isExtendedDocumentsTax,
    isLoading:
      isSettingsLoading || (isExtendedDocumentsTax && isTaxRatesLoading),
  };
};

/**
 * Share of the subtotal the document discount removes, 0 to 1.
 */
const getDiscountRatio = (values: DocumentTaxValues) => {
  const subtotal = sumBy(values.entries, (e) => toSafeNumber(e.amount));
  const discount = toSafeNumber(values.discount);

  if (!discount || subtotal <= 0) return 0;

  const discountAmount =
    values.discountType === 'percentage'
      ? (subtotal * discount) / 100
      : discount;

  return Math.min(Math.max(discountAmount / subtotal, 0), 1);
};

/**
 * Previews the tax lines of the document, one per tax rate. With
 * `tax.calc_after_discount` on, the document discount reduces the tax as it
 * does on the server.
 */
export const useDocumentTaxLines = (taxRates: TaxRate[]) => {
  const { values } = useFormikContext<DocumentTaxValues>();
  const { isCalcAfterDiscount } = useDocumentTaxSettings();

  return React.useMemo(() => {
    const ratio = isCalcAfterDiscount ? getDiscountRatio(values) : 0;
    const lines = aggregateItemEntriesTaxRates(
      values.currencyCode,
      taxRates,
    )(values.entries as Array<{ taxRateId?: string | number }>);

    return lines.map((line) => ({
      ...line,
      taxAmount: line.taxAmount * (1 - ratio),
    }));
  }, [values, taxRates, isCalcAfterDiscount]);
};

/**
 * Previews the tax added on top of the document total (exclusive tax only).
 */
export const useDocumentExclusiveTaxAmount = (taxRates: TaxRate[]) => {
  const { values } = useFormikContext<DocumentTaxValues>();
  const lines = useDocumentTaxLines(taxRates);

  return values.inclusiveExclusiveTax === TaxType.Exclusive
    ? sumBy(lines, 'taxAmount')
    : 0;
};

/**
 * Tax lines for the totals of a document form.
 */
export function DocumentTaxTotalLines({
  taxRates,
  formatAmount,
}: {
  taxRates: TaxRate[];
  formatAmount: (amount: number) => string;
}) {
  const lines = useDocumentTaxLines(taxRates);

  return (
    <>
      {lines.map((line) => (
        <TotalLine
          key={line.taxRateId}
          title={line.label}
          value={formatAmount(line.taxAmount)}
          borderStyle={TotalLineBorderStyle.None}
        />
      ))}
    </>
  );
}

/**
 * "Amounts are inclusive/exclusive of tax" select above the entries table.
 * @param {boolean} recomputeEntries - Recompute the `entries` tax amounts on
 *   change; forms that derive the tax in a hook (expenses) pass false.
 */
export function DocumentTaxInclusiveSelect({
  recomputeEntries = true,
}: {
  recomputeEntries?: boolean;
}) {
  const { values, setFieldValue } = useFormikContext<DocumentTaxValues>();

  const handleItemSelect = (item: { key: TaxType }) => {
    setFieldValue('inclusiveExclusiveTax', item.key);

    if (recomputeEntries) {
      setFieldValue(
        'entries',
        assignEntriesTaxAmount(item.key === TaxType.Inclusive, values.entries),
      );
    }
  };

  return (
    <EntriesActionsBar>
      <InclusiveFormGroup
        name={'inclusiveExclusiveTax'}
        label={'Amounts are'}
        inline={true}
      >
        <FSelect
          name={'inclusiveExclusiveTax'}
          items={DocumentTaxOptions}
          textAccessor={'label'}
          labelAccessor={() => ''}
          valueAccessor={'key'}
          popoverProps={{ minimal: true, usePortal: true, inline: false }}
          buttonProps={{ small: true }}
          onItemSelect={handleItemSelect}
          filterable={false}
        />
      </InclusiveFormGroup>
    </EntriesActionsBar>
  );
}

const InclusiveFormGroup = styled(FFormGroup)`
  margin-left: auto;
`;
