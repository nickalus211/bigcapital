/**
 * The yearly withholding tax summary: per customer, the tax withheld from
 * payments against the tax certified by the customer's certificates. Pure,
 * so it is unit tested without a database. Amounts are in the base currency.
 */

export interface WhtPaymentLine {
  customerId: number;
  /** Withheld tax in the base currency. */
  withheldAmount: number;
}

export interface WhtCertificateLine {
  customerId: number;
  amount: number;
}

export interface WhtCustomerInfo {
  id: number;
  displayName: string;
  taxNumber?: string | null;
}

export type WhtCustomerStatus = 'certified' | 'missing' | 'over_certified';

export interface WhtCustomerSummary {
  customerId: number;
  customerName: string;
  customerTaxNumber: string | null;
  paymentsCount: number;
  certificatesCount: number;
  withheldAmount: number;
  certifiedAmount: number;
  /** Withheld less certified: positive means certificates are missing. */
  differenceAmount: number;
  status: WhtCustomerStatus;
}

export interface WhtSummaryResult {
  customers: WhtCustomerSummary[];
  totals: {
    withheldAmount: number;
    certifiedAmount: number;
    /** Withheld tax not covered by certificates yet. */
    uncertifiedAmount: number;
  };
  /** The credit claimed on the S04: the certified tax. */
  s04: { line: string; creditAmount: number };
}

const cents = (amount: number) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

/**
 * Works out the withholding tax summary of a tax year.
 * @param {WhtPaymentLine[]} payments - Payments with withheld tax in the year.
 * @param {WhtCertificateLine[]} certificates - Certificates of the year.
 * @param {WhtCustomerInfo[]} customers
 * @returns {WhtSummaryResult}
 */
export const calcWhtSummary = (
  payments: WhtPaymentLine[],
  certificates: WhtCertificateLine[],
  customers: WhtCustomerInfo[],
): WhtSummaryResult => {
  const customersById = new Map(customers.map((c) => [c.id, c]));
  const rows = new Map<number, WhtCustomerSummary>();

  const rowOf = (customerId: number) => {
    if (!rows.has(customerId)) {
      const customer = customersById.get(customerId);
      rows.set(customerId, {
        customerId,
        customerName: customer?.displayName ?? '',
        customerTaxNumber: customer?.taxNumber || null,
        paymentsCount: 0,
        certificatesCount: 0,
        withheldAmount: 0,
        certifiedAmount: 0,
        differenceAmount: 0,
        status: 'certified',
      });
    }
    return rows.get(customerId);
  };

  for (const payment of payments) {
    const row = rowOf(payment.customerId);
    row.paymentsCount += 1;
    row.withheldAmount += payment.withheldAmount || 0;
  }
  for (const certificate of certificates) {
    const row = rowOf(certificate.customerId);
    row.certificatesCount += 1;
    row.certifiedAmount += Number(certificate.amount) || 0;
  }

  const summaries = [...rows.values()]
    .map((row) => {
      const withheldAmount = cents(row.withheldAmount);
      const certifiedAmount = cents(row.certifiedAmount);
      const differenceAmount = cents(withheldAmount - certifiedAmount);
      const status: WhtCustomerStatus =
        differenceAmount > 0
          ? 'missing'
          : differenceAmount < 0
            ? 'over_certified'
            : 'certified';

      return {
        ...row,
        withheldAmount,
        certifiedAmount,
        differenceAmount,
        status,
      };
    })
    .sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName) ||
        a.customerId - b.customerId,
    );

  const sum = (field: 'withheldAmount' | 'certifiedAmount') =>
    cents(summaries.reduce((total, row) => total + row[field], 0));
  const uncertifiedAmount = cents(
    summaries.reduce(
      (total, row) => total + Math.max(row.differenceAmount, 0),
      0,
    ),
  );
  const certifiedAmount = sum('certifiedAmount');

  return {
    customers: summaries,
    totals: {
      withheldAmount: sum('withheldAmount'),
      certifiedAmount,
      uncertifiedAmount,
    },
    s04: { line: 'F24', creditAmount: certifiedAmount },
  };
};
