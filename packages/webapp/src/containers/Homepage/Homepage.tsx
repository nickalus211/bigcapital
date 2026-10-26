import React, { useEffect } from 'react';
import { HomepageContent } from './HomepageContent';
import { HomeDashboard } from './Dashboard/HomeDashboard';
import { useAbilityContext } from '@/hooks';
import { AbilitySubject, ReportsAction } from '@/constants/abilityOption';
import type { WithDashboardActionsProps } from '@/containers/Dashboard/withDashboardActions';
import { DashboardInsider } from '@/components/Dashboard';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';
import { useCurrentOrganizationName } from '@/hooks/query';

type DashboardHomepageProps = WithDashboardActionsProps;

/**
 * Dashboard homepage.
 */
function DashboardHomepage({
  // #withDashboardActions
  changePageTitle,
}: DashboardHomepageProps) {
  const organizationName = useCurrentOrganizationName();
  const ability = useAbilityContext();

  // The dashboard shows report figures; without the permission the
  // homepage keeps the shortcuts.
  const canSeeDashboard = ability.can(
    ReportsAction.READ_PROFIT_LOSS,
    AbilitySubject.Report,
  );

  useEffect(() => {
    changePageTitle(organizationName);
  }, [organizationName, changePageTitle]);

  return (
    <DashboardInsider name="homepage">
      {canSeeDashboard ? <HomeDashboard /> : <HomepageContent />}
    </DashboardInsider>
  );
}

export const Homepage = withDashboardActions(DashboardHomepage);
