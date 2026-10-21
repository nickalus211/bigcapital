import { Icon as BlueprintIcon } from '@blueprintjs/core';
import { FFormGroup, FInputGroup } from '@/components';
import { Features } from '@/constants/features';
import { useFeatureCan } from '@/hooks/state/feature';

/**
 * Contact tax registration number field, labelled TRN for Jamaica.
 * @returns {JSX.Element}
 */
export function TaxNumberFormGroup() {
  const { featureCan } = useFeatureCan();
  const label = featureCan(Features.Jamaica) ? 'TRN' : 'Tax number';

  return (
    <FFormGroup name={'taxNumber'} label={label} inline fastField>
      <FInputGroup
        name={'taxNumber'}
        placeholder={featureCan(Features.Jamaica) ? '123-456-789' : ''}
        leftIcon={<BlueprintIcon icon="id-number" />}
        data-testId="contact-tax-number"
        fastField
      />
    </FFormGroup>
  );
}
