import { Inject, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { ServiceError } from '@/modules/Items/ServiceError';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { Customer } from '@/modules/Customers/models/Customer';
import { WhtCertificate } from './models/WhtCertificate.model';
import {
  CreateWhtCertificateDto,
  EditWhtCertificateDto,
  WhtCertificatesQueryDto,
} from '../dtos/WhtCertificate.dto';
import { ERRORS } from '../constants';

/**
 * Withholding tax certificates customers issue for the tax they withheld.
 */
@Injectable()
export class WhtCertificatesService {
  constructor(
    @Inject(WhtCertificate.name)
    private readonly certificateModel: TenantModelProxy<typeof WhtCertificate>,

    @Inject(Customer.name)
    private readonly customerModel: TenantModelProxy<typeof Customer>,
  ) {}

  /**
   * Lists the certificates, newest first.
   * @param {WhtCertificatesQueryDto} query
   */
  public async getCertificates(query: WhtCertificatesQueryDto = {}) {
    const certificates = await this.certificateModel()
      .query()
      .onBuild((builder) => {
        if (query.taxYear) builder.where('taxYear', query.taxYear);
        if (query.customerId) builder.where('customerId', query.customerId);
      })
      .withGraphFetched('customer')
      .orderBy('certificateDate', 'desc')
      .orderBy('id', 'desc');

    return certificates.map((certificate) => this.transform(certificate));
  }

  /**
   * Retrieves the given certificate.
   * @param {number} certificateId
   */
  public async getCertificate(certificateId: number) {
    const certificate = await this.findOrThrow(certificateId);
    return this.transform(certificate);
  }

  /**
   * Records a certificate.
   * @param {CreateWhtCertificateDto} dto
   */
  public async createCertificate(dto: CreateWhtCertificateDto) {
    const attrs = await this.transformDto(dto);
    const certificate = await this.certificateModel()
      .query()
      .insertAndFetch(attrs);

    return this.getCertificate(certificate.id);
  }

  /**
   * Edits the given certificate.
   * @param {number} certificateId
   * @param {EditWhtCertificateDto} dto
   */
  public async editCertificate(
    certificateId: number,
    dto: EditWhtCertificateDto,
  ) {
    await this.findOrThrow(certificateId);
    const attrs = await this.transformDto(dto);

    await this.certificateModel()
      .query()
      .patchAndFetchById(certificateId, attrs);

    return this.getCertificate(certificateId);
  }

  /**
   * Deletes the given certificate.
   * @param {number} certificateId
   */
  public async deleteCertificate(certificateId: number) {
    await this.findOrThrow(certificateId);
    await this.certificateModel().query().deleteById(certificateId);
  }

  private async findOrThrow(certificateId: number) {
    const certificate = await this.certificateModel()
      .query()
      .findById(certificateId)
      .withGraphFetched('customer');

    if (!certificate) {
      throw new ServiceError(
        ERRORS.WHT_CERTIFICATE_NOT_FOUND,
        'The withholding tax certificate is not found.',
      );
    }
    return certificate;
  }

  /**
   * Validates the DTO and turns it into model attributes. The tax year
   * defaults to the year of the period end, else of the certificate date.
   * @param {CreateWhtCertificateDto} dto
   */
  private async transformDto(dto: CreateWhtCertificateDto) {
    const customer = await this.customerModel()
      .query()
      .findById(dto.customerId);

    if (!customer) {
      throw new ServiceError(
        ERRORS.WHT_CERTIFICATE_CUSTOMER_NOT_FOUND,
        'The customer is not found.',
      );
    }
    const date = (value?: string | null) =>
      value ? moment(value).format('YYYY-MM-DD') : null;

    const periodFrom = date(dto.periodFrom);
    const periodTo = date(dto.periodTo);

    if (periodFrom && periodTo && periodFrom > periodTo) {
      throw new ServiceError(
        ERRORS.WHT_CERTIFICATE_PERIOD_INVALID,
        'The period start is after the period end.',
      );
    }
    const certificateDate = date(dto.certificateDate);
    const taxYear = dto.taxYear || moment(periodTo || certificateDate).year();

    return {
      customerId: dto.customerId,
      certificateNumber: dto.certificateNumber || null,
      certificateDate,
      taxYear,
      periodFrom,
      periodTo,
      amount: dto.amount,
      note: dto.note || null,
    };
  }

  private transform(certificate: WhtCertificate & { customer?: Customer }) {
    return {
      id: certificate.id,
      customerId: certificate.customerId,
      customerName: certificate.customer?.displayName ?? '',
      certificateNumber: certificate.certificateNumber ?? null,
      certificateDate: moment(certificate.certificateDate).format('YYYY-MM-DD'),
      taxYear: certificate.taxYear,
      periodFrom: certificate.periodFrom
        ? moment(certificate.periodFrom).format('YYYY-MM-DD')
        : null,
      periodTo: certificate.periodTo
        ? moment(certificate.periodTo).format('YYYY-MM-DD')
        : null,
      amount: Number(certificate.amount),
      note: certificate.note ?? null,
    };
  }
}
