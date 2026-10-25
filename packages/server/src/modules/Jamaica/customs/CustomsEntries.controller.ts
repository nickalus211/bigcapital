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
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { ExpenseAction } from '@/modules/Expenses/Expenses.types';
import { JamaicaFeatureGuard } from '../JamaicaFeatureGuard';
import { CustomsEntriesService } from './CustomsEntries.service';
import {
  CalculateCustomsEntryDto,
  CreateCustomsEntryDto,
  CustomsEntriesQueryDto,
  CustomsEntryCalculationDto,
  CustomsEntryResponseDto,
  EditCustomsEntryDto,
} from '../dtos/CustomsEntry.dto';

@Controller('jamaica/customs-entries')
@ApiTags('Jamaica')
@ApiExtraModels(CustomsEntryCalculationDto, CustomsEntryResponseDto)
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard, JamaicaFeatureGuard)
export class CustomsEntriesController {
  constructor(private readonly customsEntries: CustomsEntriesService) {}

  @Post('calculate')
  @HttpCode(200)
  @RequirePermission(ExpenseAction.View, AbilitySubject.Expense)
  @ApiOperation({
    summary:
      'Works out the duties and taxes of a customs entry (C78) without saving it.',
  })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(CustomsEntryCalculationDto) },
  })
  calculate(@Body() dto: CalculateCustomsEntryDto) {
    return this.customsEntries.calculate(dto);
  }

  @Get()
  @RequirePermission(ExpenseAction.View, AbilitySubject.Expense)
  @ApiOperation({ summary: 'Lists the customs entries.' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(CustomsEntryResponseDto) },
    },
  })
  getEntries(@Query() query: CustomsEntriesQueryDto) {
    return this.customsEntries.getEntries(query);
  }

  @Get(':id')
  @RequirePermission(ExpenseAction.View, AbilitySubject.Expense)
  @ApiOperation({ summary: 'Retrieves a customs entry.' })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(CustomsEntryResponseDto) },
  })
  getEntry(@Param('id', ParseIntPipe) id: number) {
    return this.customsEntries.getEntry(id);
  }

  @Post()
  @RequirePermission(ExpenseAction.Create, AbilitySubject.Expense)
  @ApiOperation({
    summary:
      'Records a customs entry: posts the duties as an expense allocated to the goods bill, and the import and advance GCT.',
  })
  @ApiResponse({
    status: 201,
    schema: { $ref: getSchemaPath(CustomsEntryResponseDto) },
  })
  createEntry(@Body() dto: CreateCustomsEntryDto) {
    return this.customsEntries.createEntry(dto);
  }

  @Put(':id')
  @RequirePermission(ExpenseAction.Edit, AbilitySubject.Expense)
  @ApiOperation({ summary: 'Edits a customs entry and posts it again.' })
  @ApiResponse({
    status: 200,
    schema: { $ref: getSchemaPath(CustomsEntryResponseDto) },
  })
  editEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditCustomsEntryDto,
  ) {
    return this.customsEntries.editEntry(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermission(ExpenseAction.Delete, AbilitySubject.Expense)
  @ApiOperation({
    summary:
      'Deletes a customs entry with its expense, landed cost and ledger entries.',
  })
  async deleteEntry(@Param('id', ParseIntPipe) id: number) {
    await this.customsEntries.deleteEntry(id);
    return { id, message: 'The customs entry has been deleted.' };
  }
}
