import { Injectable } from '@nestjs/common';
import { omit, sumBy } from 'lodash';
import * as moment from 'moment';
import * as R from 'ramda';
import * as composeAsync from 'async/compose';
import { BranchTransactionDTOTransformer } from '@/modules/Branches/integrations/BranchTransactionDTOTransform';
import { Expense } from '../models/Expense.model';
import { assocItemEntriesDefaultIndex } from '@/utils/associate-item-entries-index';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { CreateExpenseDto, EditExpenseDto } from '../dtos/Expense.dto';
import { ExtendedDocumentsTaxService } from '@/modules/TaxRates/ExtendedDocumentsTax.service';

@Injectable()
export class ExpenseDTOTransformer {
  /**
   * @param {BranchTransactionDTOTransformer} branchDTOTransform - Branch transaction DTO transformer.
   * @param {TenancyContext} tenancyContext - Tenancy context.
   */
  constructor(
    private readonly branchDTOTransform: BranchTransactionDTOTransformer,
    private readonly tenancyContext: TenancyContext,
    private readonly extendedDocumentsTax: ExtendedDocumentsTaxService,
  ) {}

  /**
   * Retrieve the expense landed cost amount.
   * @param  {IExpenseDTO} expenseDTO
   * @return {number}
   */
  private getExpenseLandedCostAmount = (
    expenseDTO: CreateExpenseDto | EditExpenseDto,
  ): number => {
    const landedCostEntries = expenseDTO.categories.filter((entry) => {
      return entry.landedCost === true;
    });
    return this.getExpenseCategoriesTotal(landedCostEntries);
  };

  /**
   * Retrieve the given expense categories total.
   * @param   {IExpenseCategory} categories
   * @returns {number}
   */
  private getExpenseCategoriesTotal = (categories): number => {
    return sumBy(categories, 'amount');
  };

  /**
   * Mapping expense DTO to model.
   * @param {IExpenseDTO} expenseDTO
   * @param {ISystemUser} authorizedUser
   * @return {IExpense}
   */
  private async expenseDTOToModel(
    expenseDTO: CreateExpenseDto | EditExpenseDto,
  ): Promise<Expense> {
    // Tax on the categories (`tax.extended_documents`); null while it is off.
    const taxed = await this.extendedDocumentsTax.transformExpenseCategories(
      expenseDTO.categories || [],
      {
        date: expenseDTO.paymentDate,
        isInclusiveTax: expenseDTO.isInclusiveTax,
      },
    );
    const landedCostAmount = taxed
      ? sumBy(
          taxed.categories.filter((category) => category.landedCost === true),
          'taxableAmount',
        )
      : this.getExpenseLandedCostAmount(expenseDTO);

    const totalAmount = taxed
      ? taxed.totalAmount
      : this.getExpenseCategoriesTotal(expenseDTO.categories);

    const categories = R.compose(
      // Associate the default index to categories lines.
      assocItemEntriesDefaultIndex,
    )(
      taxed?.categories ??
        // While tax is off, expense lines stay untaxed as upstream.
        (expenseDTO.categories || []).map((category) =>
          omit(category, ['taxRateId']),
        ),
    );

    const initialDTO = {
      ...omit(expenseDTO, ['publish', 'attachments', 'isInclusiveTax']),
      categories,
      totalAmount,
      landedCostAmount,
      isInclusiveTax: taxed?.isInclusiveTax ?? false,
      taxAmountWithheld: taxed?.taxAmountWithheld ?? null,
      paymentDate: moment(expenseDTO.paymentDate).toMySqlDateTime(),
      ...(expenseDTO.publish
        ? {
            publishedAt: moment().toMySqlDateTime(),
          }
        : {}),
    };
    const asyncDto = await composeAsync(
      this.branchDTOTransform.transformDTO<Expense>,
    )(initialDTO);

    return asyncDto as Expense;
  }

  /**
   * Transforms the expense create DTO.
   * @param {IExpenseCreateDTO} expenseDTO
   * @returns {Promise<Expense>}
   */
  public expenseCreateDTO = async (
    expenseDTO: CreateExpenseDto | EditExpenseDto,
  ): Promise<Partial<Expense>> => {
    const initialDTO = await this.expenseDTOToModel(expenseDTO);
    const tenant = await this.tenancyContext.getTenant(true);

    return {
      ...initialDTO,
      currencyCode: expenseDTO.currencyCode || tenant?.metadata?.baseCurrency,
      exchangeRate: expenseDTO.exchangeRate || 1,
      // ...(user
      //   ? {
      //       userId: user.id,
      //     }
      //   : {}),
    };
  };

  /**
   * Transformes the expense edit DTO.
   * @param {EditExpenseDto} expenseDTO
   * @returns {Promise<Expense>}
   */
  public expenseEditDTO = async (
    expenseDTO: EditExpenseDto,
  ): Promise<Expense> => {
    return this.expenseDTOToModel(expenseDTO);
  };
}
