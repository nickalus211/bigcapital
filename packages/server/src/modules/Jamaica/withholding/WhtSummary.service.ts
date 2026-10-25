import { Inject, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { uniq } from 'lodash';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { Customer } from '@/modules/Customers/models/Customer';
import { PaymentReceived } from '@/modules/PaymentReceived/models/PaymentReceived';
import { TaxParameter } from '@/modules/TaxRates/models/TaxParameter.model';
import { WhtCertificate } from './models/WhtCertificate.model';
import { calcWhtSummary, WhtSummaryResult } from './wht-summary.calculator';
import { JAMAICA_JURISDICTION } from '../data/gct-rates';

export interface WhtSummaryWarning {
  code: string;
  message: string;
}

export interface WhtSummaryResponse extends WhtSummaryResult {
  year: number;
  fromDate: string;
  toDate: string;
  currencyCode: string;
  rate: number | null;
  warnings: WhtSummaryWarning[];
}

/**
 * The tax customers withheld from payments in a tax year (calendar year),
 * against the certificates they issued, and the S04 credit.
 */
@Injectable()
export class WhtSummaryService {
  constructor(
    private readonly tenancyContext: TenancyContext,

    @Inject(PaymentReceived.name)
    private readonly paymentModel: TenantModelProxy<typeof PaymentReceived>,

    @Inject(WhtCertificate.name)
    private readonly certificateModel: TenantModelProxy<typeof WhtCertificate>,

    @Inject(Customer.name)
    private readonly customerModel: TenantModelProxy<typeof Customer>,

    @Inject(TaxParameter.name)
    private readonly taxParameterModel: TenantModelProxy<typeof TaxParameter>,
  ) {}

  /**
   * Retrieves the summary of the given tax year, by default the last one.
   * @param {number} year
   * @returns {Promise<WhtSummaryResponse>}
   */
  public async getSummary(year?: number): Promise<WhtSummaryResponse> {
    const taxYear = year || moment().year() - 1;
    const fromDate = `${taxYear}-01-01`;
    const toDate = `${taxYear}-12-31`;

    const [payments, certificates, metadata, rateParam] = await Promise.all([
      this.paymentModel()
        .query()
        .whereBetween('paymentDate', [fromDate, toDate])
        .where('withholdingTaxAmount', '>', 0),
      this.certificateModel().query().where('taxYear', taxYear),
      this.tenancyContext.getTenantMetadata(),
      this.taxParameterModel()
        .query()
        .findOne({
          jurisdiction: JAMAICA_JURISDICTION,
          key: 'wht.specified_services_rate',
        })
        .modify('effectiveOn', toDate),
    ]);
    const customerIds = uniq([
      ...payments.map((p) => p.customerId),
      ...certificates.map((c) => c.customerId),
    ]);
    const customers = customerIds.length
      ? await this.customerModel().query().whereIn('id', customerIds)
      : [];

    const result = calcWhtSummary(
      payments.map((payment) => ({
        customerId: payment.customerId,
        withheldAmount: payment.localWithholdingTaxAmount,
      })),
      certificates.map((certificate) => ({
        customerId: certificate.customerId,
        amount: Number(certificate.amount),
      })),
      customers.map((customer) => ({
        id: customer.id,
        displayName: customer.displayName,
        taxNumber: customer.taxNumber,
      })),
    );

    return {
      year: taxYear,
      fromDate,
      toDate,
      currencyCode: (metadata as { baseCurrency?: string })?.baseCurrency,
      rate: rateParam ? Number(JSON.parse(rateParam.value)) : null,
      ...result,
      warnings: this.getWarnings(result, !!rateParam && !rateParam.verified),
    };
  }

  private getWarnings(
    result: WhtSummaryResult,
    rateUnverified: boolean,
  ): WhtSummaryWarning[] {
    const warnings: WhtSummaryWarning[] = [];

    if (result.totals.uncertifiedAmount > 0) {
      warnings.push({
        code: 'CERTIFICATES_MISSING',
        message:
          'Some withheld tax has no certificate yet. Ask those customers for their withholding tax certificates before claiming the credit.',
      });
    }
    if (result.customers.some((row) => row.status === 'over_certified')) {
      warnings.push({
        code: 'CERTIFIED_MORE_THAN_WITHHELD',
        message:
          'Some certificates are for more than the tax recorded on payments. Check the payments for missing withholding tax.',
      });
    }
    if (rateUnverified) {
      warnings.push({
        code: 'RATE_NOT_VERIFIED',
        message:
          'The withholding tax rate is not verified against current TAJ guidance.',
      });
    }
    return warnings;
  }
}
