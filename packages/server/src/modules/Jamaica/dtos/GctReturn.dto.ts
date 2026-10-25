import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { IsOptional } from '@/common/decorators/Validators';

export class GctReturnQueryDto {
  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Period start (YYYY-MM-DD). Default: first day of last month.',
    required: false,
    example: '2026-09-01',
  })
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    description: 'Period end (YYYY-MM-DD). Default: last day of last month.',
    required: false,
    example: '2026-09-30',
  })
  toDate?: string;
}

class GctReturnRateLineDto {
  @ApiProperty() taxRateId: number;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() rate: number;
  @ApiProperty() taxableAmount: number;
  @ApiProperty() taxAmount: number;
}

class GctReturnSuppliesDto {
  @ApiProperty({ type: [GctReturnRateLineDto] })
  standardRated: GctReturnRateLineDto[];
  @ApiProperty() standardRatedAmount: number;
  @ApiProperty() zeroRatedAmount: number;
  @ApiProperty() exemptAmount: number;
  @ApiProperty() outOfScopeAmount: number;
  @ApiProperty({ description: 'Sales whose tax rate has no tax type' })
  unclassifiedAmount: number;
  @ApiProperty({ description: 'Sales with no tax rate' })
  noTaxRateAmount: number;
  @ApiProperty({ description: 'Standard + zero-rated + exempt' })
  totalAmount: number;
}

class GctReturnImportGctDto {
  @ApiProperty({ description: 'CIF + duties the import GCT was charged on' })
  taxableAmount: number;
  @ApiProperty() taxAmount: number;
}

class GctReturnPurchasesDto {
  @ApiProperty({ type: [GctReturnRateLineDto] })
  standardRated: GctReturnRateLineDto[];
  @ApiProperty() standardRatedAmount: number;
  @ApiProperty() zeroRatedAndExemptAmount: number;
  @ApiProperty({
    type: GctReturnImportGctDto,
    description:
      'Import GCT paid at customs (customs entries); part of input_tax',
  })
  importGct: GctReturnImportGctDto;
  @ApiProperty() inputTax: number;
}

class GctReturnApportionmentDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty() taxableSuppliesAmount: number;
  @ApiProperty() totalSuppliesAmount: number;
  @ApiProperty({ description: 'Claimable share of input tax, 0 to 1' })
  ratio: number;
  @ApiProperty() claimableInputTax: number;
  @ApiProperty() disallowedInputTax: number;
}

class GctReturnOrganizationDto {
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) trn: string | null;
  @ApiProperty() gctRegistered: boolean;
  @ApiProperty({ nullable: true }) gctRegistrationNumber: string | null;
}

class GctReturnWarningDto {
  @ApiProperty() code: string;
  @ApiProperty() message: string;
}

export class GctReturnResponseDto {
  @ApiProperty() fromDate: string;
  @ApiProperty() toDate: string;
  @ApiProperty({ description: 'Last working day of the following month' })
  dueDate: string;
  @ApiProperty() currencyCode: string;
  @ApiProperty({ type: GctReturnOrganizationDto })
  organization: GctReturnOrganizationDto;
  @ApiProperty({ type: GctReturnSuppliesDto })
  supplies: GctReturnSuppliesDto;
  @ApiProperty() outputTax: number;
  @ApiProperty({ type: GctReturnPurchasesDto })
  purchases: GctReturnPurchasesDto;
  @ApiProperty({ type: GctReturnApportionmentDto })
  apportionment: GctReturnApportionmentDto;
  @ApiProperty({
    description: 'Advance GCT paid at customs, credited against the GCT due',
  })
  advanceGctCredit: number;
  @ApiProperty({
    description:
      'Output tax less claimable input tax and the advance GCT credit',
  })
  netGct: number;
  @ApiProperty({ enum: ['payable', 'refundable', 'nil'] })
  position: 'payable' | 'refundable' | 'nil';
  @ApiProperty({
    description: 'Number of documents counted, by type',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  documents: Record<string, number>;
  @ApiProperty({ type: [GctReturnWarningDto] })
  warnings: GctReturnWarningDto[];
}
