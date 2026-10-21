import { Inject, Injectable } from '@nestjs/common';
import { SETTINGS_PROVIDER } from '@/modules/Settings/Settings.types';
import { SettingsStore } from '@/modules/Settings/SettingsStore';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import {
  EditJamaicaSettingsDto,
  JamaicaSettingsResponseDto,
} from '../dtos/JamaicaSettings.dto';

const SETTINGS_KEYS: Array<[keyof EditJamaicaSettingsDto, string]> = [
  ['gctRegistered', 'gct_registered'],
  ['gctRegistrationNumber', 'gct_registration_number'],
  ['gctRegistrationDate', 'gct_registration_date'],
  ['filingFrequency', 'filing_frequency'],
  ['apportionmentEnabled', 'apportionment_enabled'],
];

@Injectable()
export class JamaicaSettingsService {
  constructor(
    @Inject(SETTINGS_PROVIDER)
    private readonly settings: () => Promise<SettingsStore>,

    private readonly tenancyContext: TenancyContext,
  ) {}

  /**
   * Retrieves the Jamaica settings with the organization TRN.
   * @returns {Promise<JamaicaSettingsResponseDto>}
   */
  public async getSettings(): Promise<JamaicaSettingsResponseDto> {
    const settings = await this.settings();
    const metadata = await this.tenancyContext.getTenantMetadata();
    const get = (key: string, defaultValue = null) =>
      settings.get({ group: 'jamaica', key }, defaultValue);

    return {
      gctRegistered: !!get('gct_registered', false),
      gctRegistrationNumber: get('gct_registration_number') || null,
      gctRegistrationDate: get('gct_registration_date') || null,
      filingFrequency: get('filing_frequency', 'monthly'),
      apportionmentEnabled: !!get('apportionment_enabled', false),
      trn: (metadata as { taxNumber?: string })?.taxNumber || null,
      setupAt: get('setup_at') || null,
    };
  }

  /**
   * Saves the given Jamaica settings. Omitted fields are left unchanged.
   * @param {EditJamaicaSettingsDto} dto
   * @returns {Promise<JamaicaSettingsResponseDto>}
   */
  public async editSettings(
    dto: EditJamaicaSettingsDto,
  ): Promise<JamaicaSettingsResponseDto> {
    const settings = await this.settings();

    SETTINGS_KEYS.forEach(([field, key]) => {
      if (dto[field] !== undefined) {
        settings.set({ group: 'jamaica', key, value: dto[field] ?? '' });
      }
    });
    await settings.save();

    return this.getSettings();
  }
}
