import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsOptional, ToNumber } from '@/common/decorators/Validators';

export class CreateWhtCertificateDto {
  @ApiProperty({
    description: 'The customer that withheld the tax.',
    example: 5,
  })
  @ToNumber()
  @IsInt()
  customerId: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'The number printed on the certificate.',
    example: 'WHT-2026-0012',
  })
  @IsOptional()
  @IsString()
  certificateNumber?: string | null;

  @ApiProperty({
    description: 'The date of the certificate (YYYY-MM-DD).',
    example: '2027-01-15',
  })
  @IsDateString()
  certificateDate: string;

  @ApiProperty({
    required: false,
    description:
      'The tax year the withheld tax belongs to. Defaults to the year of period_to, else of certificate_date.',
    example: 2026,
  })
  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(1900)
  @Max(9999)
  taxYear?: number;

  @ApiProperty({ required: false, nullable: true, example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  periodFrom?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  periodTo?: string | null;

  @ApiProperty({
    description: 'The tax certified, in the base currency.',
    example: 300,
  })
  @ToNumber()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class EditWhtCertificateDto extends CreateWhtCertificateDto {}

export class WhtCertificatesQueryDto {
  @ApiProperty({ required: false, description: 'Filter by tax year.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taxYear?: number;

  @ApiProperty({ required: false, description: 'Filter by customer.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

export class WhtSummaryQueryDto {
  @ApiProperty({
    required: false,
    description: 'The tax year (calendar year). Defaults to the previous year.',
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(9999)
  year?: number;
}

export class WhtCertificateResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() customerId: number;
  @ApiProperty({ required: false }) customerName?: string;
  @ApiProperty({ nullable: true }) certificateNumber: string | null;
  @ApiProperty() certificateDate: string;
  @ApiProperty() taxYear: number;
  @ApiProperty({ nullable: true }) periodFrom: string | null;
  @ApiProperty({ nullable: true }) periodTo: string | null;
  @ApiProperty() amount: number;
  @ApiProperty({ nullable: true }) note: string | null;
}

class WhtCustomerSummaryDto {
  @ApiProperty() customerId: number;
  @ApiProperty() customerName: string;
  @ApiProperty({ nullable: true }) customerTaxNumber: string | null;
  @ApiProperty() paymentsCount: number;
  @ApiProperty() certificatesCount: number;
  @ApiProperty() withheldAmount: number;
  @ApiProperty() certifiedAmount: number;
  @ApiProperty({
    description:
      'Withheld less certified; positive means certificates are missing.',
  })
  differenceAmount: number;
  @ApiProperty({ enum: ['certified', 'missing', 'over_certified'] })
  status: string;
}

class WhtSummaryTotalsDto {
  @ApiProperty() withheldAmount: number;
  @ApiProperty() certifiedAmount: number;
  @ApiProperty() uncertifiedAmount: number;
}

class WhtS04Dto {
  @ApiProperty({ example: 'F24' }) line: string;
  @ApiProperty() creditAmount: number;
}

class WhtWarningDto {
  @ApiProperty() code: string;
  @ApiProperty() message: string;
}

export class WhtSummaryResponseDto {
  @ApiProperty() year: number;
  @ApiProperty() fromDate: string;
  @ApiProperty() toDate: string;
  @ApiProperty() currencyCode: string;
  @ApiProperty({ description: 'The seeded WHT rate on specified services, %.' })
  rate: number | null;
  @ApiProperty({ type: [WhtCustomerSummaryDto] })
  customers: WhtCustomerSummaryDto[];
  @ApiProperty({ type: WhtSummaryTotalsDto }) totals: WhtSummaryTotalsDto;
  @ApiProperty({ type: WhtS04Dto }) s04: WhtS04Dto;
  @ApiProperty({ type: [WhtWarningDto] }) warnings: WhtWarningDto[];
}
