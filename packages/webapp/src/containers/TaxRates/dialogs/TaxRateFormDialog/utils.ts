import { useFormikContext } from 'formik';
import type { TaxRate } from '@bigcapital/sdk-ts';
import { transformToForm } from '@/utils';

export type TaxType = 'standard' | 'zero_rated' | 'exempt' | 'out_of_scope';

export interface TaxRateFormValues {
  name: string;
  code: string;
  rate: string;
  description: string;
  taxType: string;
  isCompound: boolean;
  isNonRecoverable: boolean;
  confirmEdit: boolean;
}

export interface TaxRateFormRequestBody {
  name: string;
  code: string;
  rate: number;
  description: string;
  taxType: TaxType | null;
  isCompound: boolean;
  isNonRecoverable: boolean;
  active: boolean;
}

/**
 * Tax types: standard, zero-rated, exempt or out of scope (e.g. Jamaican GCT).
 */
export const TAX_TYPE_OPTIONS = [
  { key: '', label: 'Unclassified' },
  { key: 'standard', label: 'Standard-rated' },
  { key: 'zero_rated', label: 'Zero-rated' },
  { key: 'exempt', label: 'Exempt' },
  { key: 'out_of_scope', label: 'Out of scope' },
];

// Default initial form values.
export const defaultInitialValues: TaxRateFormValues = {
  name: '',
  code: '',
  rate: '',
  description: '',
  taxType: '',
  isCompound: false,
  isNonRecoverable: false,
  confirmEdit: false,
};

/**
 * Transformers response errors to form errors.
 * @returns {Record<string, string>}
 */
export const transformApiErrors = (
  errors: Array<{ type?: string }>,
): Record<string, string> => {
  const fields: Record<string, string> = {};

  if (errors.find((e) => e.type === 'TAX_CODE_NOT_UNIQUE')) {
    fields.code = 'The tax rate is not unique.';
  }
  return fields;
};

/**
 * Tranformes form values to request values.
 */
export const transformFormToReq = (
  form: TaxRateFormValues,
): TaxRateFormRequestBody => {
  return {
    name: form.name,
    code: form.code,
    rate: Number(form.rate),
    description: form.description,
    taxType: (form.taxType as TaxType) || null,
    isCompound: form.isCompound,
    isNonRecoverable: form.isNonRecoverable,
    active: true,
  };
};

/**
 * Detarmines whether the tax rate changed.
 * @param initialValues
 * @param formValues
 * @returns {boolean}
 */
export const isTaxRateChange = (
  initialValues: TaxRateFormValues,
  formValues: TaxRateFormValues,
): boolean => {
  return initialValues.rate !== formValues.rate;
};

/**
 * Detarmines whether the tax rate changed.
 * @returns {boolean}
 */
export const useIsTaxRateChanged = (): boolean => {
  const { initialValues, values } = useFormikContext<TaxRateFormValues>();

  return isTaxRateChange(initialValues, values);
};

const convertFormAttrsToBoolean = (
  form: TaxRateFormValues,
): TaxRateFormValues => {
  return {
    ...form,
    isCompound: !!form.isCompound,
    isNonRecoverable: !!form.isNonRecoverable,
  };
};

export const transformTaxRateToForm = (
  taxRate?: TaxRate,
): TaxRateFormValues => {
  return convertFormAttrsToBoolean({
    ...defaultInitialValues,
    ...transformToForm(taxRate, defaultInitialValues),
    rate:
      taxRate?.rate != null ? String(taxRate.rate) : defaultInitialValues.rate,
  });
};

export const transformTaxRateCodeValue = (input: string): string => {
  // Remove non-alphanumeric characters and spaces using a regular expression
  const cleanedString = input.replace(/\s+/g, '');

  // Convert the cleaned string to uppercase
  const uppercasedString = cleanedString.toUpperCase();

  return uppercasedString;
};
