import { Inject, Injectable } from '@nestjs/common';
import { SETTINGS_PROVIDER } from '@/modules/Settings/Settings.types';
import { SettingsStore } from '@/modules/Settings/SettingsStore';

export interface TaxSettings {
  /** Tax is calculated on the line amount after line and document discounts. */
  calcAfterDiscount: boolean;
  /** Receipts, credit notes, vendor credits, estimates and expenses carry tax. */
  extendedDocuments: boolean;
  /** Lines that omit a tax rate take the item's default sell or purchase rate. */
  defaultFromItem: boolean;
  /** Account debited with input tax on purchases. Tax payable when unset. */
  inputTaxAccountId: number | null;
  /** Account credited with output tax on sales. Tax payable when unset. */
  outputTaxAccountId: number | null;
  /** Account debited with tax customers withhold from payments. */
  withholdingTaxAccountId: number | null;
}

/**
 * Reads the `tax.*` settings group. Every option defaults to off, so a
 * tenant that never set them keeps the upstream tax behaviour.
 */
@Injectable()
export class TaxSettingsService {
  constructor(
    @Inject(SETTINGS_PROVIDER)
    private readonly settings: () => Promise<SettingsStore>,
  ) {}

  /**
   * Retrieves the tax settings.
   * @returns {Promise<TaxSettings>}
   */
  public async getTaxSettings(): Promise<TaxSettings> {
    const settings = await this.settings();
    const get = (key: string, defaultValue = null) =>
      settings.get({ group: 'tax', key }, defaultValue);

    const toAccountId = (value: unknown) =>
      value ? Number(value) || null : null;

    return {
      calcAfterDiscount: !!get('calc_after_discount', false),
      extendedDocuments: !!get('extended_documents', false),
      defaultFromItem: !!get('default_from_item', false),
      inputTaxAccountId: toAccountId(get('input_tax_account_id')),
      outputTaxAccountId: toAccountId(get('output_tax_account_id')),
      withholdingTaxAccountId: toAccountId(get('withholding_account_id')),
    };
  }
}
