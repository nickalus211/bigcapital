import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsString } from 'class-validator';
import { IsOptional } from '@/common/decorators/Validators';

export const FILING_FREQUENCIES = ['monthly'];

export class EditJamaicaSettingsDto {
  @ApiProperty({
    required: false,
    description: 'Whether the business is registered for GCT.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  gctRegistered?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'The GCT registration number.',
    example: 'GCT-000123456',
  })
  @IsOptional()
  @IsString()
  gctRegistrationNumber?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'The GCT registration date (YYYY-MM-DD).',
    example: '2025-01-15',
  })
  @IsOptional()
  @IsDateString()
  gctRegistrationDate?: string | null;

  @ApiProperty({
    required: false,
    description: 'The GCT return filing frequency.',
    enum: FILING_FREQUENCIES,
    example: 'monthly',
  })
  @IsOptional()
  @IsIn(FILING_FREQUENCIES)
  filingFrequency?: string;

  @ApiProperty({
    required: false,
    description:
      'Apportion input GCT between taxable and exempt supplies on the GCT return.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  apportionmentEnabled?: boolean;
}

export class JamaicaSetupDto {
  @ApiProperty({
    required: false,
    description: 'Report the changes without applying them.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class JamaicaSettingsResponseDto {
  @ApiProperty({ example: true })
  gctRegistered: boolean;

  @ApiProperty({ nullable: true, example: 'GCT-000123456' })
  gctRegistrationNumber: string | null;

  @ApiProperty({ nullable: true, example: '2025-01-15' })
  gctRegistrationDate: string | null;

  @ApiProperty({ example: 'monthly' })
  filingFrequency: string;

  @ApiProperty({ example: false })
  apportionmentEnabled: boolean;

  @ApiProperty({
    nullable: true,
    description:
      "The organization's Taxpayer Registration Number (organization tax number).",
    example: '123456789',
  })
  trn: string | null;

  @ApiProperty({
    nullable: true,
    description: 'When the Jamaica setup last ran.',
    example: '2026-10-21T05:00:00.000Z',
  })
  setupAt: string | null;
}

export class JamaicaSetupResponseDto {
  @ApiProperty({ example: false })
  dryRun: boolean;

  @ApiProperty({ type: [String], example: ['tax_rate:GCT-STD'] })
  created: string[];

  @ApiProperty({ type: [String], example: ['account:tax-payable:name'] })
  updated: string[];

  @ApiProperty({ type: [String], example: ['account:gct-input-tax'] })
  skipped: string[];
}
