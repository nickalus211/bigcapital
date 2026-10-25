import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { ServiceError } from '@/modules/Items/ServiceError';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { IExpenseDeletingPayload } from '@/modules/Expenses/interfaces/Expenses.interface';
import { CustomsEntry } from './models/CustomsEntry.model';
import { CUSTOMS_ERRORS } from '../constants';

/**
 * Refuses deleting an expense that a customs entry posted; the customs
 * entry has to be edited or deleted instead.
 */
@Injectable()
export class CustomsExpenseGuardSubscriber {
  constructor(
    @Inject(CustomsEntry.name)
    private readonly customsEntryModel: TenantModelProxy<typeof CustomsEntry>,
  ) {}

  @OnEvent(events.expenses.onDeleting, { suppressErrors: false })
  async handleExpenseDeleting({ oldExpense, trx }: IExpenseDeletingPayload) {
    const entry = await this.customsEntryModel()
      .query(trx)
      .findOne({ expenseId: oldExpense.id });

    if (entry) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_ENTRY_EXPENSE,
        `This expense was posted by customs entry ${entry.entryNumber}. Edit or delete the customs entry instead.`,
      );
    }
  }
}
