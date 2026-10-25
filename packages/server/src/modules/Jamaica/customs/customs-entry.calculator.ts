/**
 * Duties and taxes of a Jamaica customs entry (C78), worked out from the
 * CIF value. Pure, so it is unit tested without a database. Amounts are in
 * the base currency (JMD). Every computed amount can be replaced by the
 * figure printed on the C78, which is the one that was paid.
 */

export interface CustomsRates {
  /** Standard Compliance Fee, % of CIF. */
  scfRate: number;
  /** Environmental Protection Levy, % of CIF. */
  eplRate: number;
  /** Import GCT, % of CIF + CD + SCF + EPL + ASD + SCT. */
  importGctRate: number;
  /** Advance GCT on commercial imports, % of the same base. */
  advanceGctRate: number;
}

export interface CustomsEntryInput {
  fobAmount: number;
  freightAmount?: number | null;
  insuranceAmount?: number | null;
  /** Customs Duty rate from the tariff, % of CIF. */
  customsDutyRate?: number | null;
  customsDutyAmount?: number | null;
  scfAmount?: number | null;
  eplAmount?: number | null;
  /** Additional Stamp Duty. */
  asdAmount?: number | null;
  /** Special Consumption Tax. */
  sctAmount?: number | null;
  /** Customs Administration Fee. */
  cafAmount?: number | null;
  importGctAmount?: number | null;
  advanceGctAmount?: number | null;
}

export interface CustomsEntryResult {
  fobAmount: number;
  freightAmount: number;
  insuranceAmount: number;
  cifAmount: number;
  customsDutyRate: number | null;
  customsDutyAmount: number;
  scfAmount: number;
  eplAmount: number;
  asdAmount: number;
  sctAmount: number;
  cafAmount: number;
  /** CIF + CD + SCF + EPL + ASD + SCT. */
  importGctBase: number;
  importGctAmount: number;
  advanceGctAmount: number;
  /** CD + SCF + EPL + ASD + SCT + CAF: the cost added to the goods. */
  dutiesAmount: number;
  /** Import GCT + advance GCT: recoverable taxes. */
  taxesAmount: number;
  /** What was paid to Customs. */
  totalAmount: number;
  /** Amounts given instead of computed (snake_case field names), with the computed value. */
  overrides: { field: string; computed: number; amount: number }[];
}

const cents = (amount: number) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const given = (value: number | null | undefined) =>
  value !== null && value !== undefined && `${value}` !== '';

/**
 * Works out the duties and taxes of a customs entry.
 * @param {CustomsEntryInput} input
 * @param {CustomsRates} rates
 * @returns {CustomsEntryResult}
 */
export const calcCustomsEntry = (
  input: CustomsEntryInput,
  rates: CustomsRates,
): CustomsEntryResult => {
  const overrides: CustomsEntryResult['overrides'] = [];

  // The given amount when there is one, else the computed one.
  const pick = (
    field: string,
    amount: number | null | undefined,
    computed: number,
  ) => {
    const rounded = cents(computed);
    if (!given(amount)) return rounded;

    const value = cents(Number(amount));
    if (value !== rounded)
      overrides.push({ field, computed: rounded, amount: value });
    return value;
  };

  const fobAmount = cents(Number(input.fobAmount) || 0);
  const freightAmount = cents(Number(input.freightAmount) || 0);
  const insuranceAmount = cents(Number(input.insuranceAmount) || 0);
  const cifAmount = cents(fobAmount + freightAmount + insuranceAmount);

  const customsDutyRate = given(input.customsDutyRate)
    ? Number(input.customsDutyRate)
    : null;
  const customsDutyAmount = pick(
    'customs_duty_amount',
    input.customsDutyAmount,
    (cifAmount * (customsDutyRate || 0)) / 100,
  );
  const scfAmount = pick(
    'scf_amount',
    input.scfAmount,
    (cifAmount * rates.scfRate) / 100,
  );
  const eplAmount = pick(
    'epl_amount',
    input.eplAmount,
    (cifAmount * rates.eplRate) / 100,
  );
  const asdAmount = cents(Number(input.asdAmount) || 0);
  const sctAmount = cents(Number(input.sctAmount) || 0);
  const cafAmount = cents(Number(input.cafAmount) || 0);

  const importGctBase = cents(
    cifAmount +
      customsDutyAmount +
      scfAmount +
      eplAmount +
      asdAmount +
      sctAmount,
  );
  const importGctAmount = pick(
    'import_gct_amount',
    input.importGctAmount,
    (importGctBase * rates.importGctRate) / 100,
  );
  const advanceGctAmount = pick(
    'advance_gct_amount',
    input.advanceGctAmount,
    (importGctBase * rates.advanceGctRate) / 100,
  );

  const dutiesAmount = cents(
    customsDutyAmount +
      scfAmount +
      eplAmount +
      asdAmount +
      sctAmount +
      cafAmount,
  );
  const taxesAmount = cents(importGctAmount + advanceGctAmount);

  return {
    fobAmount,
    freightAmount,
    insuranceAmount,
    cifAmount,
    customsDutyRate,
    customsDutyAmount,
    scfAmount,
    eplAmount,
    asdAmount,
    sctAmount,
    cafAmount,
    importGctBase,
    importGctAmount,
    advanceGctAmount,
    dutiesAmount,
    taxesAmount,
    totalAmount: cents(dutiesAmount + taxesAmount),
    overrides,
  };
};

export interface AllocationLine {
  entryId: number;
  /** Line value (for `value`) or quantity (for `quantity`). */
  weight: number;
}

/**
 * Spreads an amount over lines in proportion to their weight, in cents.
 * The rounding difference goes to the line with the largest weight.
 * @param {number} amount
 * @param {AllocationLine[]} lines
 * @returns {{ entryId: number; cost: number }[]}
 */
export const allocateByWeight = (
  amount: number,
  lines: AllocationLine[],
): { entryId: number; cost: number }[] => {
  const totalWeight = lines.reduce((sum, line) => sum + (line.weight || 0), 0);
  if (!lines.length || totalWeight <= 0) return [];

  const allocated = lines.map((line) => ({
    entryId: line.entryId,
    cost: cents((amount * (line.weight || 0)) / totalWeight),
  }));
  const difference = cents(
    amount - allocated.reduce((sum, line) => sum + line.cost, 0),
  );
  if (difference !== 0) {
    let largest = 0;
    lines.forEach((line, index) => {
      if ((line.weight || 0) > (lines[largest].weight || 0)) largest = index;
    });
    allocated[largest].cost = cents(allocated[largest].cost + difference);
  }
  return allocated;
};
