import {
  Body,
  Controller,
  Get,
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
import {
  EditJamaicaSettingsDto,
  JamaicaSetupDto,
  JamaicaSettingsResponseDto,
  JamaicaSetupResponseDto,
} from './dtos/JamaicaSettings.dto';

@Controller('jamaica')
@ApiTags('Jamaica')
@ApiExtraModels(JamaicaSettingsResponseDto, JamaicaSetupResponseDto)
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard)
export class JamaicaController {
  constructor(
    private readonly setupService: JamaicaSetupService,
    private readonly settingsService: JamaicaSettingsService,
  ) {}

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
