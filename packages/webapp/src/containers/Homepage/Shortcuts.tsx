import React, { useEffect } from 'react';
import { HomepageContent } from './HomepageContent';
import type { WithDashboardActionsProps } from '@/containers/Dashboard/withDashboardActions';
import { DashboardInsider } from '@/components/Dashboard';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';

type ShortcutsPageProps = WithDashboardActionsProps;

/**
 * The shortcut cards that used to be the homepage.
 */
function ShortcutsPage({
  // #withDashboardActions
  changePageTitle,
}: ShortcutsPageProps) {
  useEffect(() => {
    changePageTitle('Shortcuts');
  }, [changePageTitle]);

  return (
    <DashboardInsider name="shortcuts">
      <HomepageContent />
    </DashboardInsider>
  );
}

export const Shortcuts = withDashboardActions(ShortcutsPage);
