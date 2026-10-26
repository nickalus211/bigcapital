import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ToNumber } from '@/common/decorators/Validators';

export class DashboardInsightsQueryDto {
  @ApiProperty({
    required: false,
    description: 'Number of months, including the current one (1–36).',
    example: 12,
  })
  @IsOptional()
  @ToNumber()
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;
}

export class DashboardInsightsSummaryDto {
  @ApiProperty({ description: 'Money received this month', example: 120000 })
  received: number;

  @ApiProperty({ description: 'Money spent this month', example: 85000 })
  spent: number;

  @ApiProperty({ description: 'Received − spent this month', example: 35000 })
  net: number;

  @ApiProperty({ description: 'Cash and bank balance now', example: 410000 })
  cashBalance: number;

  @ApiProperty({ description: 'Owed to you (A/R)', example: 60000 })
  receivable: number;

  @ApiProperty({ description: 'You owe (A/P)', example: 25000 })
  payable: number;

  @ApiProperty({ description: 'Money received in the period', example: 900000 })
  totalReceived: number;

  @ApiProperty({ description: 'Money spent in the period', example: 700000 })
  totalSpent: number;
}

export class DashboardMonthlyCashFlowDto {
  @ApiProperty({ example: '2026-10' })
  month: string;

  @ApiProperty({ example: 120000 })
  received: number;

  @ApiProperty({ example: 85000 })
  spent: number;

  @ApiProperty({ example: 35000 })
  net: number;
}

export class DashboardBalancePointDto {
  @ApiProperty({ example: '2026-10' })
  month: string;

  @ApiProperty({
    description: 'Cash and bank balance at month end',
    example: 410000,
  })
  balance: number;
}

export class DashboardCategoryAmountDto {
  @ApiProperty({
    nullable: true,
    description: 'Null for "Other"',
    example: 1004,
  })
  accountId: number | null;

  @ApiProperty({ example: 'Rent' })
  name: string;

  @ApiProperty({ example: 240000 })
  amount: number;
}

export class DashboardInsightsResponseDto {
  @ApiProperty({ example: 'JMD' })
  currencyCode: string;

  @ApiProperty({ example: '2025-11-01' })
  fromDate: string;

  @ApiProperty({ example: '2026-10-31' })
  toDate: string;

  @ApiProperty({ type: DashboardInsightsSummaryDto })
  summary: DashboardInsightsSummaryDto;

  @ApiProperty({ type: [DashboardMonthlyCashFlowDto] })
  monthly: DashboardMonthlyCashFlowDto[];

  @ApiProperty({ type: [DashboardBalancePointDto] })
  balanceTrend: DashboardBalancePointDto[];

  @ApiProperty({ type: [DashboardCategoryAmountDto] })
  spendingByCategory: DashboardCategoryAmountDto[];
}
