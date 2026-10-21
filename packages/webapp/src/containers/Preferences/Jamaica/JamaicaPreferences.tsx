import { Button, Callout, Classes, Intent, Position } from '@blueprintjs/core';
import { Form, Formik, type FormikHelpers } from 'formik';
import * as FF from 'fp-ts/function';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import * as Yup from 'yup';
import { TaxCalculationCard } from './TaxCalculationCard';
import type { WithDashboardActionsProps } from '@/containers/Dashboard/withDashboardActions';
import type { JamaicaSetupReport } from '@bigcapital/sdk-ts';
import {
  AppToaster,
  Card,
  CardFooterActions,
  FDateInput,
  FFormGroup,
  FInputGroup,
  FSwitch,
} from '@/components';
import { withDashboardActions } from '@/containers/Dashboard/withDashboardActions';
import { useDateInputFormatter } from '@/hooks';
import {
  useEditJamaicaSettings,
  useJamaicaSettings,
  useRunJamaicaSetup,
} from '@/hooks/query';

interface JamaicaSettingsFormValues {
  gctRegistered: boolean;
  gctRegistrationNumber: string;
  gctRegistrationDate: string;
  apportionmentEnabled: boolean;
}

const JamaicaSettingsSchema = Yup.object().shape({
  gctRegistered: Yup.boolean(),
  gctRegistrationNumber: Yup.string().nullable().label('GCT registration no.'),
  gctRegistrationDate: Yup.string().nullable(),
  apportionmentEnabled: Yup.boolean(),
});

type JamaicaPreferencesProps = Pick<
  WithDashboardActionsProps,
  'changePreferencesPageTitle'
>;

/**
 * Preferences page of the Jamaica localization: GCT registration and the
 * Jamaica setup (GCT rates, accounts, tax settings).
 */
function JamaicaPreferencesInner({
  changePreferencesPageTitle,
}: JamaicaPreferencesProps) {
  const { data: settings, isLoading } = useJamaicaSettings();
  const { mutateAsync: editSettings } = useEditJamaicaSettings();
  const dateInputFormatter = useDateInputFormatter();

  useEffect(() => {
    changePreferencesPageTitle('Jamaica (GCT)');
  }, [changePreferencesPageTitle]);

  if (isLoading || !settings) {
    return null;
  }
  const initialValues: JamaicaSettingsFormValues = {
    gctRegistered: !!settings.gctRegistered,
    gctRegistrationNumber: settings.gctRegistrationNumber ?? '',
    gctRegistrationDate: settings.gctRegistrationDate ?? '',
    apportionmentEnabled: !!settings.apportionmentEnabled,
  };

  const handleSubmit = (
    values: JamaicaSettingsFormValues,
    { setSubmitting }: FormikHelpers<JamaicaSettingsFormValues>,
  ) => {
    editSettings({
      gctRegistered: values.gctRegistered,
      gctRegistrationNumber: values.gctRegistrationNumber || null,
      gctRegistrationDate: values.gctRegistrationDate || null,
      apportionmentEnabled: values.apportionmentEnabled,
    })
      .then(() => {
        AppToaster.show({
          message: 'The GCT settings have been saved.',
          intent: Intent.SUCCESS,
        });
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <PageRoot>
      <JamaicaSetupCard setupAt={settings.setupAt} />

      <Card>
        <Formik
          initialValues={initialValues}
          validationSchema={JamaicaSettingsSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting }) => (
            <Form>
              <FFormGroup
                name={'trn'}
                label={<strong>TRN</strong>}
                helperText={
                  <>
                    The organization's Taxpayer Registration Number. Edit it in{' '}
                    <Link to={'/preferences/general'}>General</Link> (Tax
                    number).
                  </>
                }
              >
                <TrnValue data-testId="jamaica-trn">
                  {settings.trn || 'Not set'}
                </TrnValue>
              </FFormGroup>

              <FFormGroup
                name={'gctRegistered'}
                inline
                helperText={
                  'Registered businesses charge GCT and issue Tax Invoices.'
                }
              >
                <FSwitch
                  name={'gctRegistered'}
                  label={'Registered for GCT'}
                  large
                />
              </FFormGroup>

              <FFormGroup
                name={'gctRegistrationNumber'}
                label={<strong>GCT registration no.</strong>}
              >
                <FInputGroup name={'gctRegistrationNumber'} />
              </FFormGroup>

              <FFormGroup
                name={'gctRegistrationDate'}
                label={<strong>GCT registration date</strong>}
              >
                <FDateInput
                  name={'gctRegistrationDate'}
                  popoverProps={{ position: Position.BOTTOM, minimal: true }}
                  {...dateInputFormatter}
                />
              </FFormGroup>

              <FFormGroup
                name={'apportionmentEnabled'}
                inline
                helperText={
                  'Apportion input GCT between taxable and exempt sales on the GCT return.'
                }
              >
                <FSwitch
                  name={'apportionmentEnabled'}
                  label={'Apportion input tax'}
                  large
                />
              </FFormGroup>

              <CardFooterActions>
                <Button
                  intent={Intent.PRIMARY}
                  loading={isSubmitting}
                  type="submit"
                >
                  Save
                </Button>
              </CardFooterActions>
            </Form>
          )}
        </Formik>
      </Card>

      <TaxCalculationCard />
    </PageRoot>
  );
}

/**
 * Runs the Jamaica setup, with a dry run to preview the changes.
 */
function JamaicaSetupCard({ setupAt }: { setupAt?: string | null }) {
  const { mutateAsync: runSetup, isPending } = useRunJamaicaSetup();
  const [report, setReport] = useState<JamaicaSetupReport | null>(null);

  const handleRun = (dryRun: boolean) => {
    runSetup({ dryRun }).then((result) => {
      setReport(result);
      if (!dryRun) {
        AppToaster.show({
          message: 'The Jamaica setup has been applied.',
          intent: Intent.SUCCESS,
        });
      }
    });
  };

  return (
    <Card>
      <h4 className={Classes.HEADING}>Jamaica setup</h4>
      <p>
        Adds the GCT tax rates (standard, zero-rated, exempt), the GCT input tax
        and withholding tax accounts, and turns on the GCT tax settings. Running
        it again only adds what is missing.
      </p>
      <p className={Classes.TEXT_MUTED}>
        {setupAt
          ? `Last run: ${new Date(setupAt).toLocaleString()}`
          : 'Not run yet.'}
      </p>
      <Callout intent={Intent.WARNING} icon={'warning-sign'}>
        The seeded rates and thresholds are not verified. Confirm them against
        current TAJ guidance with your accountant.
      </Callout>

      {report && <SetupReport report={report} />}

      <CardFooterActions>
        <Button
          loading={isPending}
          onClick={() => handleRun(true)}
          data-testId="jamaica-setup-preview"
        >
          Preview changes
        </Button>
        <Button
          intent={Intent.PRIMARY}
          loading={isPending}
          onClick={() => handleRun(false)}
          data-testId="jamaica-setup-run"
        >
          Run setup
        </Button>
      </CardFooterActions>
    </Card>
  );
}

function SetupReport({ report }: { report: JamaicaSetupReport }) {
  const changes = [...report.created, ...report.updated];

  return (
    <ReportBox data-testId="jamaica-setup-report">
      <strong>
        {report.dryRun ? 'Preview: ' : 'Applied: '}
        {changes.length === 0
          ? 'nothing to change.'
          : `${report.created.length} to create, ${report.updated.length} to update.`}
      </strong>
      {changes.length > 0 && (
        <ul>
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      )}
    </ReportBox>
  );
}

const PageRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  max-width: 800px;
`;

const TrnValue = styled.div`
  font-family: monospace;
  font-size: 14px;
`;

const ReportBox = styled.div`
  margin-top: 12px;
  font-size: 13px;

  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
`;

export const JamaicaPreferences = FF.pipe(
  JamaicaPreferencesInner,
  withDashboardActions,
);
