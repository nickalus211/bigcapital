import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './Dashboard.service';
import { GetDashboardBootMetaResponseDto } from './dtos/GetDashboardBootMetaResponse.dto';
import { DashboardInsightsService } from './insights/DashboardInsights.service';
import {
  DashboardInsightsQueryDto,
  DashboardInsightsResponseDto,
} from './insights/DashboardInsights.dto';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { ReportsAction } from '@/modules/FinancialStatements/types/Report.types';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiExtraModels(GetDashboardBootMetaResponseDto, DashboardInsightsResponseDto)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardInsightsService: DashboardInsightsService,
  ) {}

  @ApiOperation({ summary: 'Get dashboard boot metadata' })
  @ApiResponse({
    status: 200,
    description: 'The dashboard details have been successfully retrieved.',
    schema: { $ref: getSchemaPath(GetDashboardBootMetaResponseDto) },
  })
  @Get('boot')
  getBootMeta() {
    return this.dashboardService.getBootMeta();
  }

  @ApiOperation({
    summary:
      'Money received and spent per month, cash balance trend, spending by category and summary totals (cash basis).',
  })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(DashboardInsightsResponseDto) },
  })
  @Get('insights')
  @UseGuards(AuthorizationGuard, PermissionGuard)
  @RequirePermission(ReportsAction.READ_PROFIT_LOSS, AbilitySubject.Report)
  getInsights(@Query() query: DashboardInsightsQueryDto) {
    return this.dashboardInsightsService.getInsights(query.months || 12);
  }
}
