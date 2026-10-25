import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsOptional, ToNumber } from '@/common/decorators/Validators';

const ALLOCATION_METHODS = ['value', 'quantity'];

/** An amount from the C78; omit it to have it computed. */
const amountProperty = (description: string) =>
  ApiProperty({ required: false, nullable: true, description, example: 0 });

class CustomsEntryAmountsDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'The bill of the imported goods. The duties and fees are allocated to its inventory lines.',
    example: 12,
  })
  @IsOptional()
  @ToNumber()
  @IsInt()
  billId?: number | null;

  @ApiProperty({
    required: false,
    enum: ALLOCATION_METHODS,
    description: 'How the duties are spread over the bill lines.',
    example: 'value',
  })
  @IsOptional()
  @IsIn(ALLOCATION_METHODS)
  allocationMethod?: 'value' | 'quantity';

  @ApiProperty({
    description: 'FOB value of the goods, in JMD at the customs rate.',
    example: 90000,
  })
  @ToNumber()
  @IsNumber()
  @Min(0)
  fobAmount: number;

  @amountProperty('Freight to Jamaica, in JMD.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  freightAmount?: number | null;

  @amountProperty('Insurance, in JMD.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  insuranceAmount?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Customs Duty rate from the tariff, % of CIF.',
    example: 20,
  })
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  @Max(1000)
  customsDutyRate?: number | null;

  @amountProperty('Customs Duty (CD). Computed from the rate when omitted.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  customsDutyAmount?: number | null;

  @amountProperty('Standard Compliance Fee. Computed when omitted.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  scfAmount?: number | null;

  @amountProperty('Environmental Protection Levy. Computed when omitted.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  eplAmount?: number | null;

  @amountProperty('Additional Stamp Duty.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  asdAmount?: number | null;

  @amountProperty('Special Consumption Tax.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  sctAmount?: number | null;

  @amountProperty('Customs Administration Fee.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  cafAmount?: number | null;

  @amountProperty('Import GCT. Computed when omitted.')
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  importGctAmount?: number | null;

  @amountProperty(
    'Advance GCT. Computed when omitted; send 0 when none was charged.',
  )
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0)
  advanceGctAmount?: number | null;
}

export class CalculateCustomsEntryDto extends CustomsEntryAmountsDto {
  @ApiProperty({
    required: false,
    description:
      'The date of the entry (YYYY-MM-DD); picks the rates in force. Defaults to today.',
    example: '2026-10-20',
  })
  @IsOptional()
  @IsDateString()
  entryDate?: string;
}

export class CreateCustomsEntryDto extends CustomsEntryAmountsDto {
  @ApiProperty({
    description: 'The C78 entry number.',
    example: 'C78-2026-001234',
  })
  @IsString()
  entryNumber: string;

  @ApiProperty({
    description: 'The date of the entry (YYYY-MM-DD).',
    example: '2026-10-20',
  })
  @IsDateString()
  entryDate: string;

  @ApiProperty({
    description: 'The account the duties and taxes were paid from.',
    example: 1000,
  })
  @ToNumber()
  @IsInt()
  paymentAccountId: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  referenceNo?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class EditCustomsEntryDto extends CreateCustomsEntryDto {}

export class CustomsEntriesQueryDto {
  @ApiProperty({ required: false, example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({ required: false, example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

class CustomsAllocationDto {
  @ApiProperty() entryId: number;
  @ApiProperty() itemId: number;
  @ApiProperty() itemName: string;
  @ApiProperty() cost: number;
}

class CustomsOverrideDto {
  @ApiProperty() field: string;
  @ApiProperty() computed: number;
  @ApiProperty() amount: number;
}

class CustomsRatesDto {
  @ApiProperty() scfRate: number;
  @ApiProperty() eplRate: number;
  @ApiProperty() importGctRate: number;
  @ApiProperty() advanceGctRate: number;
  @ApiProperty() verified: boolean;
}

export class CustomsEntryCalculationDto {
  @ApiProperty() fobAmount: number;
  @ApiProperty() freightAmount: number;
  @ApiProperty() insuranceAmount: number;
  @ApiProperty() cifAmount: number;
  @ApiProperty({ nullable: true }) customsDutyRate: number | null;
  @ApiProperty() customsDutyAmount: number;
  @ApiProperty() scfAmount: number;
  @ApiProperty() eplAmount: number;
  @ApiProperty() asdAmount: number;
  @ApiProperty() sctAmount: number;
  @ApiProperty() cafAmount: number;
  @ApiProperty() importGctBase: number;
  @ApiProperty() importGctAmount: number;
  @ApiProperty() advanceGctAmount: number;
  @ApiProperty({
    description: 'Duties and fees added to the cost of the goods.',
  })
  dutiesAmount: number;
  @ApiProperty({ description: 'Import GCT and advance GCT.' })
  taxesAmount: number;
  @ApiProperty({ description: 'Total paid to Customs.' })
  totalAmount: number;
  @ApiProperty({ type: [CustomsOverrideDto] }) overrides: CustomsOverrideDto[];
  @ApiProperty({ type: CustomsRatesDto }) rates: CustomsRatesDto;
  @ApiProperty({ type: [CustomsAllocationDto] })
  allocations: CustomsAllocationDto[];
}

export class CustomsEntryResponseDto extends CustomsEntryCalculationDto {
  @ApiProperty() id: number;
  @ApiProperty() entryNumber: string;
  @ApiProperty() entryDate: string;
  @ApiProperty({ nullable: true }) referenceNo: string | null;
  @ApiProperty({ nullable: true }) billId: number | null;
  @ApiProperty({ nullable: true }) billNumber: string | null;
  @ApiProperty({ nullable: true }) vendorName: string | null;
  @ApiProperty() paymentAccountId: number;
  @ApiProperty() paymentAccountName: string;
  @ApiProperty() allocationMethod: string;
  @ApiProperty({ nullable: true }) expenseId: number | null;
  @ApiProperty({ nullable: true }) landedCostId: number | null;
  @ApiProperty({ nullable: true }) note: string | null;
}
