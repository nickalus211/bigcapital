import { Radio, RadioGroup } from '@blueprintjs/core';
import classNames from 'classnames';
import * as FF from 'fp-ts/function';
import React, { useEffect } from 'react';
import styled from 'styled-components';
import type { WithDashboardActionsProps } from '@/containers/Dashboard/withDashboardActions';
import { Card } from '@/components';
import { CLASSES } from '@/constants/classes';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';
import { ThemePreference, useTheme } from '@/hooks/useTheme';

type AppearancePreferencesProps = Pick<
  WithDashboardActionsProps,
  'changePreferencesPageTitle'
>;

/**
 * Appearance preferences page. The theme is saved per browser.
 */
function AppearancePreferences({
  // #withDashboardActions
  changePreferencesPageTitle,
}: AppearancePreferencesProps) {
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    changePreferencesPageTitle('Appearance');
  }, [changePreferencesPageTitle]);

  return (
    <div className={classNames(CLASSES.PREFERENCES_PAGE_INSIDE_CONTENT)}>
      <AppearanceCard>
        <RadioGroup
          label={'Theme'}
          selectedValue={preference}
          onChange={(event) =>
            setPreference(event.currentTarget.value as ThemePreference)
          }
        >
          <Radio label={'Light'} value={'light'} data-testId="theme-light" />
          <Radio label={'Dark'} value={'dark'} data-testId="theme-dark" />
          <Radio
            label={'System (follow the operating system)'}
            value={'system'}
            data-testId="theme-system"
          />
        </RadioGroup>
        <AppearanceHint>
          Saved in this browser only. Press Shift+H to switch between light and
          dark.
        </AppearanceHint>
      </AppearanceCard>
    </div>
  );
}

const AppearanceCard = styled(Card)`
  padding: 20px;
`;

const AppearanceHint = styled.p`
  margin: 10px 0 0;
  font-size: 13px;
  opacity: 0.7;
`;

export const Appearance = FF.pipe(AppearancePreferences, withDashboardActions);
