import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { PreferencesAction } from '@/modules/Settings/Settings.types';
import { JamaicaSetupService } from './setup/JamaicaSetup.service';
import { JamaicaSettingsService } from './settings/JamaicaSettings.service';
import { JamaicaFeatureGuard } from './JamaicaFeatureGuard';
import { GctReturnService } from './gct-return/GctReturn.service';
import { GctReturnQueryDto, GctReturnResponseDto } from './dtos/GctReturn.dto';
import { ReportsAction } from '@/modules/FinancialStatements/types/Report.types';
import { PaymentReceiveAction } from '@/modules/PaymentReceived/types/PaymentReceived.types';
import { WhtCertificatesService } from './withholding/WhtCertificates.service';
import { WhtSummaryService } from './withholding/WhtSummary.service';
import {
  CreateWhtCertificateDto,
  EditWhtCertificateDto,
  WhtCertificateResponseDto,
  WhtCertificatesQueryDto,
  WhtSummaryQueryDto,
  WhtSummaryResponseDto,
} from './dtos/WhtCertificate.dto';
import {
  EditJamaicaSettingsDto,
  JamaicaSetupDto,
  JamaicaSettingsResponseDto,
  JamaicaSetupResponseDto,
} from './dtos/JamaicaSettings.dto';

@Controller('jamaica')
@ApiTags('Jamaica')
@ApiExtraModels(
  JamaicaSettingsResponseDto,
  JamaicaSetupResponseDto,
  GctReturnResponseDto,
  WhtCertificateResponseDto,
  WhtSummaryResponseDto,
)
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard)
export class JamaicaController {
  constructor(
    private readonly setupService: JamaicaSetupService,
    private readonly settingsService: JamaicaSettingsService,
    private readonly gctReturnService: GctReturnService,
    private readonly whtCertificatesService: WhtCertificatesService,
    private readonly whtSummaryService: WhtSummaryService,
  ) {}

  @Get('wht-summary')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PaymentReceiveAction.View, AbilitySubject.PaymentReceive)
  @ApiOperation({
    summary:
      'Withholding tax of a tax year: tax withheld from payments per customer against certificates, and the S04 credit (line F24).',
  })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(WhtSummaryResponseDto) },
  })
  getWhtSummary(@Query() query: WhtSummaryQueryDto) {
    return this.whtSummaryService.getSummary(query.year);
  }

  @Get('wht-certificates')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PaymentReceiveAction.View, AbilitySubject.PaymentReceive)
  @ApiOperation({ summary: 'Lists the withholding tax certificates.' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(WhtCertificateResponseDto) },
    },
  })
  getWhtCertificates(@Query() query: WhtCertificatesQueryDto) {
    return this.whtCertificatesService.getCertificates(query);
  }

  @Get('wht-certificates/:id')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PaymentReceiveAction.View, AbilitySubject.PaymentReceive)
  @ApiOperation({ summary: 'Retrieves a withholding tax certificate.' })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(WhtCertificateResponseDto) },
  })
  getWhtCertificate(@Param('id', ParseIntPipe) id: number) {
    return this.whtCertificatesService.getCertificate(id);
  }

  @Post('wht-certificates')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PaymentReceiveAction.Create, AbilitySubject.PaymentReceive)
  @ApiOperation({ summary: 'Records a withholding tax certificate.' })
  @ApiResponse({
    status: 201,
    schema: { $ref: getSchemaPath(WhtCertificateResponseDto) },
  })
  createWhtCertificate(@Body() dto: CreateWhtCertificateDto) {
    return this.whtCertificatesService.createCertificate(dto);
  }

  @Put('wht-certificates/:id')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PaymentReceiveAction.Edit, AbilitySubject.PaymentReceive)
  @ApiOperation({ summary: 'Edits a withholding tax certificate.' })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(WhtCertificateResponseDto) },
  })
  editWhtCertificate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditWhtCertificateDto,
  ) {
    return this.whtCertificatesService.editCertificate(id, dto);
  }

  @Delete('wht-certificates/:id')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PaymentReceiveAction.Delete, AbilitySubject.PaymentReceive)
  @HttpCode(200)
  @ApiOperation({ summary: 'Deletes a withholding tax certificate.' })
  async deleteWhtCertificate(@Param('id', ParseIntPipe) id: number) {
    await this.whtCertificatesService.deleteCertificate(id);
    return { id, message: 'The withholding tax certificate has been deleted.' };
  }

  @Get('gct-return')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(
    ReportsAction.READ_SALES_TAX_LIABILITY_SUMMARY,
    AbilitySubject.Report,
  )
  @ApiOperation({
    summary:
      'GCT return (Form 4A style) for a period: supplies by tax type, output and input tax, apportionment and net GCT.',
  })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(GctReturnResponseDto) },
  })
  getGctReturn(@Query() query: GctReturnQueryDto) {
    return this.gctReturnService.getGctReturn(query);
  }

  @Post('setup')
  @RequirePermission(PreferencesAction.Mutate, AbilitySubject.Preferences)
  @ApiOperation({
    summary:
      'Configures the organization for a Jamaican sole trader (idempotent). Turns on the Jamaica feature.',
  })
  @ApiQuery({
    name: 'dry_run',
    required: false,
    type: Boolean,
    description:
      'Report the changes without applying them. Also accepted in the body.',
  })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(JamaicaSetupResponseDto) },
  })
  setup(
    @Query('dryRun') queryDryRun?: string | boolean,
    @Body() body?: JamaicaSetupDto,
  ) {
    const dryRun =
      body?.dryRun === true || queryDryRun === true || queryDryRun === 'true';

    return this.setupService.setup(dryRun);
  }

  @Get('settings')
  @UseGuards(JamaicaFeatureGuard)
  @ApiOperation({ summary: 'Retrieves the Jamaica (GCT) settings.' })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(JamaicaSettingsResponseDto) },
  })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put('settings')
  @UseGuards(JamaicaFeatureGuard)
  @RequirePermission(PreferencesAction.Mutate, AbilitySubject.Preferences)
  @ApiOperation({
    summary: 'Saves the Jamaica (GCT) settings. Omitted fields are unchanged.',
  })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(JamaicaSettingsResponseDto) },
  })
  editSettings(@Body() dto: EditJamaicaSettingsDto) {
    return this.settingsService.editSettings(dto);
  }
}
