import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import * as moment from 'moment';
import { ServiceError } from '@/modules/Items/ServiceError';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { Account } from '@/modules/Accounts/models/Account.model';
import { Bill } from '@/modules/Bills/models/Bill';
import { Expense } from '@/modules/Expenses/models/Expense.model';
import { CreateExpense } from '@/modules/Expenses/commands/CreateExpense.service';
import { DeleteExpense } from '@/modules/Expenses/commands/DeleteExpense.service';
import { SUPPORTED_EXPENSE_PAYMENT_ACCOUNT_TYPES } from '@/modules/Expenses/constants';
import { AllocateLandedCostService } from '@/modules/EE/BillLandedCosts/commands/AllocateLandedCost.service';
import { RevertAllocatedLandedCost } from '@/modules/EE/BillLandedCosts/commands/RevertAllocatedLandedCost.service';
import { BillLandedCost } from '@/modules/EE/BillLandedCosts/models/BillLandedCost';
import { LedgerStorageService } from '@/modules/Ledger/LedgerStorage.service';
import { TaxAccountsService } from '@/modules/TaxRates/TaxAccounts.service';
import { TaxParameter } from '@/modules/TaxRates/models/TaxParameter.model';
import { CreateExpenseDto } from '@/modules/Expenses/dtos/Expense.dto';
import { CustomsEntry } from './models/CustomsEntry.model';
import { CustomsEntryGL } from './CustomsEntryGL';
import { CustomsAccountsService } from './CustomsAccounts.service';
import {
  allocateByWeight,
  calcCustomsEntry,
  CustomsEntryResult,
  CustomsRates,
} from './customs-entry.calculator';
import {
  CalculateCustomsEntryDto,
  CreateCustomsEntryDto,
  CustomsEntriesQueryDto,
  EditCustomsEntryDto,
} from '../dtos/CustomsEntry.dto';
import { CUSTOMS_ERRORS } from '../constants';
import { JAMAICA_JURISDICTION } from '../data/gct-rates';

/** Used when a rate parameter isn't seeded (organizations set up before M6). */
const DEFAULT_RATES: CustomsRates = {
  scfRate: 0.3,
  eplRate: 0.5,
  importGctRate: 15,
  advanceGctRate: 5,
};
const RATE_KEYS: Record<keyof CustomsRates, string> = {
  scfRate: 'customs.scf_rate',
  eplRate: 'customs.epl_rate',
  importGctRate: 'customs.import_gct_rate',
  advanceGctRate: 'customs.advance_gct_rate',
};

export interface CustomsAllocation {
  entryId: number;
  itemId: number;
  itemName: string;
  cost: number;
}

/**
 * Jamaica customs entries (C78). Saving an entry:
 * - posts the duties and fees as a published expense (Customs Duties & Fees)
 *   from the payment account;
 * - allocates them to the inventory lines of the goods bill as a landed
 *   cost, which moves them into inventory;
 * - posts import GCT to the input tax account and advance GCT to the
 *   Advance GCT account (`CustomsEntry` ledger entries).
 * Editing reverses all three and posts them again.
 */
@Injectable()
export class CustomsEntriesService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly tenancyContext: TenancyContext,
    private readonly createExpenseService: CreateExpense,
    private readonly deleteExpenseService: DeleteExpense,
    private readonly allocateLandedCost: AllocateLandedCostService,
    private readonly revertLandedCost: RevertAllocatedLandedCost,
    private readonly ledgerStorage: LedgerStorageService,
    private readonly taxAccounts: TaxAccountsService,
    private readonly customsAccounts: CustomsAccountsService,

    @Inject(CustomsEntry.name)
    private readonly customsEntryModel: TenantModelProxy<typeof CustomsEntry>,
    @Inject(Bill.name)
    private readonly billModel: TenantModelProxy<typeof Bill>,
    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
    @Inject(Expense.name)
    private readonly expenseModel: TenantModelProxy<typeof Expense>,
    @Inject(BillLandedCost.name)
    private readonly billLandedCostModel: TenantModelProxy<
      typeof BillLandedCost
    >,
    @Inject(TaxParameter.name)
    private readonly taxParameterModel: TenantModelProxy<typeof TaxParameter>,
  ) {}

  /**
   * The customs rates in force on the given date.
   * @param {string} date
   */
  public async getRates(
    date: string,
    trx?: Knex.Transaction,
  ): Promise<CustomsRates & { verified: boolean }> {
    const params = await this.taxParameterModel()
      .query(trx)
      .where('jurisdiction', JAMAICA_JURISDICTION)
      .whereIn('key', Object.values(RATE_KEYS))
      .modify('effectiveOn', date);

    const rates = { ...DEFAULT_RATES };
    let verified = true;

    (Object.keys(RATE_KEYS) as (keyof CustomsRates)[]).forEach((field) => {
      const param = params.find((p) => p.key === RATE_KEYS[field]);
      if (!param) {
        verified = false;
        return;
      }
      rates[field] = Number(JSON.parse(param.value));
      if (!param.verified) verified = false;
    });
    return { ...rates, verified };
  }

  /**
   * Works out an entry without saving it.
   * @param {CalculateCustomsEntryDto} dto
   */
  public async calculate(dto: CalculateCustomsEntryDto) {
    const date = this.formatDate(dto.entryDate || new Date());
    const rates = await this.getRates(date);
    const result = calcCustomsEntry(dto, rates);
    const bill = dto.billId ? await this.getBillOrThrow(dto.billId) : null;
    const allocations = bill
      ? this.getAllocations(bill, result.dutiesAmount, dto.allocationMethod)
      : [];

    return { ...result, rates, allocations };
  }

  /**
   * Lists the entries, newest first.
   * @param {CustomsEntriesQueryDto} query
   */
  public async getEntries(query: CustomsEntriesQueryDto = {}) {
    const entries = await this.customsEntryModel()
      .query()
      .onBuild((builder) => {
        if (query.fromDate) builder.where('entryDate', '>=', query.fromDate);
        if (query.toDate) builder.where('entryDate', '<=', query.toDate);
      })
      .withGraphFetched('[bill.vendor, paymentAccount]')
      .orderBy('entryDate', 'desc')
      .orderBy('id', 'desc');

    return entries.map((entry) => this.transform(entry));
  }

  /**
   * Retrieves the given entry with its allocations.
   * @param {number} entryId
   */
  public async getEntry(entryId: number) {
    const entry = await this.findOrThrow(entryId);
    const landedCost = entry.landedCostId
      ? await this.billLandedCostModel()
          .query()
          .findById(entry.landedCostId)
          .withGraphFetched('allocateEntries.itemEntry.item')
      : null;

    const allocations: CustomsAllocation[] = (
      (landedCost?.allocateEntries as any[]) || []
    ).map((allocated) => ({
      entryId: allocated.entryId,
      itemId: allocated.itemEntry?.itemId,
      itemName: allocated.itemEntry?.item?.name ?? '',
      cost: Number(allocated.cost),
    }));
    const rates = await this.getRates(this.formatDate(entry.entryDate));
    const transformed = this.transform(entry);
    // Recompute with the stored amounts to list those that were overridden.
    const { overrides } = calcCustomsEntry(transformed, rates);

    return { ...transformed, overrides, rates, allocations };
  }

  /**
   * Records a customs entry and posts it.
   * @param {CreateCustomsEntryDto} dto
   */
  public async createEntry(dto: CreateCustomsEntryDto) {
    const { userId } = await this.getUser();

    const entryId = await this.uow.withTransaction(async (trx) => {
      const { attrs, bill, paymentAccount } = await this.prepare(
        dto,
        null,
        trx,
      );
      const entry = await this.customsEntryModel()
        .query(trx)
        .insertAndFetch({ ...attrs, userId });

      await this.post(entry, bill, paymentAccount, trx);
      return entry.id;
    });
    return this.getEntry(entryId);
  }

  /**
   * Edits the given entry: reverses what it posted and posts it again.
   * @param {number} entryId
   * @param {EditCustomsEntryDto} dto
   */
  public async editEntry(entryId: number, dto: EditCustomsEntryDto) {
    const oldEntry = await this.findOrThrow(entryId);

    await this.uow.withTransaction(async (trx) => {
      const { attrs, bill, paymentAccount } = await this.prepare(
        dto,
        entryId,
        trx,
      );
      await this.unpost(oldEntry, trx);

      const entry = await this.customsEntryModel()
        .query(trx)
        .patchAndFetchById(entryId, {
          ...attrs,
          expenseId: null,
          landedCostId: null,
        });
      await this.post(entry, bill, paymentAccount, trx);
    });
    return this.getEntry(entryId);
  }

  /**
   * Deletes the given entry and what it posted.
   * @param {number} entryId
   */
  public async deleteEntry(entryId: number) {
    const entry = await this.findOrThrow(entryId);

    await this.uow.withTransaction(async (trx) => {
      await this.unpost(entry, trx);
      await this.customsEntryModel().query(trx).deleteById(entryId);
    });
  }

  /**
   * Validates the DTO and works out the attributes to store.
   */
  private async prepare(
    dto: CreateCustomsEntryDto,
    entryId: number | null,
    trx: Knex.Transaction,
  ) {
    const entryDate = this.formatDate(dto.entryDate);

    const duplicate = await this.customsEntryModel()
      .query(trx)
      .findOne({ entryNumber: dto.entryNumber })
      .onBuild((builder) => {
        if (entryId) builder.whereNot('id', entryId);
      });
    if (duplicate) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_ENTRY_NUMBER_EXISTS,
        'A customs entry with this number already exists.',
      );
    }
    const paymentAccount = await this.accountModel()
      .query(trx)
      .findById(dto.paymentAccountId);

    if (
      !paymentAccount ||
      !paymentAccount.isAccountType(SUPPORTED_EXPENSE_PAYMENT_ACCOUNT_TYPES)
    ) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_PAYMENT_ACCOUNT_INVALID,
        'The payment account is not found or can not pay expenses.',
      );
    }
    const bill = dto.billId ? await this.getBillOrThrow(dto.billId, trx) : null;
    const rates = await this.getRates(entryDate, trx);
    const result = calcCustomsEntry(dto, rates);

    const attrs = {
      entryNumber: dto.entryNumber,
      entryDate,
      referenceNo: dto.referenceNo || null,
      billId: bill?.id ?? null,
      paymentAccountId: paymentAccount.id,
      allocationMethod: dto.allocationMethod || 'value',
      note: dto.note || null,
      ...this.resultAttrs(result),
    };
    return { attrs, bill, paymentAccount, result };
  }

  /**
   * Posts the expense, the landed cost and the tax ledger of the entry.
   */
  private async post(
    entry: CustomsEntry,
    bill: Bill | null,
    paymentAccount: Account,
    trx: Knex.Transaction,
  ) {
    const dutiesAmount = Number(entry.dutiesAmount);
    const { baseCurrency } = await this.getUser();
    let expenseId: number | null = null;
    let landedCostId: number | null = null;

    if (dutiesAmount > 0) {
      const customsDutiesAccountId =
        await this.customsAccounts.getCustomsDutiesAccountId(trx);

      const expense = await this.createExpenseService.newExpense(
        {
          paymentAccountId: paymentAccount.id,
          paymentDate: entry.entryDate as unknown as Date,
          referenceNo: entry.entryNumber,
          description: `Customs entry ${entry.entryNumber}`,
          currencyCode: baseCurrency,
          exchangeRate: 1,
          publish: true,
          categories: [
            {
              index: 1,
              expenseAccountId: customsDutiesAccountId,
              amount: dutiesAmount,
              description: `Customs duties and fees, entry ${entry.entryNumber}`,
              landedCost: !!bill,
            },
          ],
        } as CreateExpenseDto,
        trx,
      );
      expenseId = expense.id;

      if (bill) {
        const category = await this.expenseModel()
          .relatedQuery('categories', trx)
          .for(expense.id)
          .first();
        const allocations = this.getAllocations(
          bill,
          dutiesAmount,
          entry.allocationMethod,
        );
        const landedCost = await this.allocateLandedCost.allocateLandedCost(
          {
            transactionId: expense.id,
            transactionType: 'Expense',
            transactionEntryId: category.id,
            allocationMethod: entry.allocationMethod,
            description: `Customs entry ${entry.entryNumber}`,
            items: allocations.map(({ entryId, cost }) => ({ entryId, cost })),
          },
          bill.id,
          trx,
        );
        landedCostId = landedCost.id;
      }
    }
    // Import GCT and advance GCT.
    const ledger = new CustomsEntryGL(entry)
      .setCurrencyCode(baseCurrency)
      .setInputTaxAccountId(await this.taxAccounts.getInputTaxAccountId(trx))
      .setAdvanceGctAccountId(
        await this.customsAccounts.getAdvanceGctAccountId(trx),
      )
      .setPaymentAccountNormal(paymentAccount.accountNormal)
      .getLedger();
    await this.ledgerStorage.commit(ledger, trx);

    await this.customsEntryModel()
      .query(trx)
      .patchAndFetchById(entry.id, { expenseId, landedCostId });
  }

  /**
   * Reverses what the entry posted. Parts already removed elsewhere are
   * skipped.
   */
  private async unpost(entry: CustomsEntry, trx: Knex.Transaction) {
    // Unlink first, so the expense delete guard lets these through.
    await this.customsEntryModel()
      .query(trx)
      .patch({ expenseId: null, landedCostId: null })
      .where('id', entry.id);

    if (entry.landedCostId) {
      const landedCost = await this.billLandedCostModel()
        .query(trx)
        .findById(entry.landedCostId);
      if (landedCost) {
        await this.revertLandedCost.deleteAllocatedLandedCost(
          entry.landedCostId,
          trx,
        );
      }
    }
    if (entry.expenseId) {
      const expense = await this.expenseModel()
        .query(trx)
        .findById(entry.expenseId);
      if (expense) {
        await this.deleteExpenseService.deleteExpense(entry.expenseId, trx);
      }
    }
    await this.ledgerStorage.deleteByReference(entry.id, 'CustomsEntry', trx);
  }

  /**
   * Spreads the duties over the inventory lines of the bill.
   */
  private getAllocations(
    bill: Bill,
    amount: number,
    method: string = 'value',
  ): CustomsAllocation[] {
    const lines = this.inventoryEntries(bill);
    const allocated = allocateByWeight(
      amount,
      lines.map((line) => ({
        entryId: line.id,
        weight:
          method === 'quantity'
            ? Number(line.quantity)
            : Number(line.quantity) * Number(line.rate),
      })),
    );
    return allocated.map((allocation) => {
      const line = lines.find((l) => l.id === allocation.entryId);
      return {
        ...allocation,
        itemId: line.itemId,
        itemName: line.item?.name ?? '',
      };
    });
  }

  private inventoryEntries(bill: Bill) {
    return ((bill.entries as any[]) || []).filter(
      (entry) => entry.item?.type === 'inventory',
    );
  }

  private async getBillOrThrow(billId: number, trx?: Knex.Transaction) {
    const bill = await this.billModel()
      .query(trx)
      .findById(billId)
      .withGraphFetched('entries.item');

    if (!bill) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_BILL_NOT_FOUND,
        'The bill is not found.',
      );
    }
    if (!bill.openedAt) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_BILL_NOT_OPEN,
        'Open the bill before allocating customs duties to it.',
      );
    }
    if (this.inventoryEntries(bill).length === 0) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_BILL_NO_INVENTORY_ITEMS,
        'The bill has no inventory items to allocate the duties to.',
      );
    }
    return bill;
  }

  private async findOrThrow(entryId: number) {
    const entry = await this.customsEntryModel()
      .query()
      .findById(entryId)
      .withGraphFetched('[bill.vendor, paymentAccount]');

    if (!entry) {
      throw new ServiceError(
        CUSTOMS_ERRORS.CUSTOMS_ENTRY_NOT_FOUND,
        'The customs entry is not found.',
      );
    }
    return entry;
  }

  private async getUser() {
    const [metadata, user] = await Promise.all([
      this.tenancyContext.getTenantMetadata(),
      this.tenancyContext.getSystemUser().catch(() => null),
    ]);
    return {
      baseCurrency: (metadata as { baseCurrency?: string })?.baseCurrency,
      userId: (user as { id?: number })?.id ?? null,
    };
  }

  private formatDate(date: string | Date) {
    return moment(date).format('YYYY-MM-DD');
  }

  private resultAttrs(result: CustomsEntryResult) {
    const { overrides, taxesAmount, ...amounts } = result;
    return amounts;
  }

  private transform(
    entry: CustomsEntry & {
      bill?: Bill & { vendor?: { displayName: string } };
      paymentAccount?: Account;
    },
  ) {
    const num = (value: unknown) => Number(value) || 0;
    const importGctAmount = num(entry.importGctAmount);
    const advanceGctAmount = num(entry.advanceGctAmount);

    return {
      id: entry.id,
      entryNumber: entry.entryNumber,
      entryDate: this.formatDate(entry.entryDate),
      referenceNo: entry.referenceNo ?? null,
      billId: entry.billId ?? null,
      billNumber: entry.bill?.billNumber ?? null,
      vendorName: entry.bill?.vendor?.displayName ?? null,
      paymentAccountId: entry.paymentAccountId,
      paymentAccountName: entry.paymentAccount?.name ?? '',
      allocationMethod: entry.allocationMethod,
      fobAmount: num(entry.fobAmount),
      freightAmount: num(entry.freightAmount),
      insuranceAmount: num(entry.insuranceAmount),
      cifAmount: num(entry.cifAmount),
      customsDutyRate:
        entry.customsDutyRate === null || entry.customsDutyRate === undefined
          ? null
          : Number(entry.customsDutyRate),
      customsDutyAmount: num(entry.customsDutyAmount),
      scfAmount: num(entry.scfAmount),
      eplAmount: num(entry.eplAmount),
      asdAmount: num(entry.asdAmount),
      sctAmount: num(entry.sctAmount),
      cafAmount: num(entry.cafAmount),
      importGctBase: num(entry.importGctBase),
      importGctAmount,
      advanceGctAmount,
      dutiesAmount: num(entry.dutiesAmount),
      taxesAmount: Math.round((importGctAmount + advanceGctAmount) * 100) / 100,
      totalAmount: num(entry.totalAmount),
      expenseId: entry.expenseId ?? null,
      landedCostId: entry.landedCostId ?? null,
      note: entry.note ?? null,
      overrides: [] as CustomsEntryResult['overrides'],
    };
  }
}
