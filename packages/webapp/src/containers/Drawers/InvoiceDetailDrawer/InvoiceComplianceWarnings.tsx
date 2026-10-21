import { Callout, Intent } from '@blueprintjs/core';
import React from 'react';
import styled from 'styled-components';
import { useInvoiceDetailDrawerContext } from './InvoiceDetailDrawerProvider';

/**
 * Tax Invoice warnings (Jamaica, GCT Act s.29) returned with the invoice.
 * They never block saving; they list what the invoice is missing.
 */
export function InvoiceComplianceWarnings() {
  const { invoice } = useInvoiceDetailDrawerContext();
  const warnings = invoice?.complianceWarnings ?? [];

  if (warnings.length === 0) {
    return null;
  }
  return (
    <WarningsCallout
      intent={Intent.WARNING}
      title={'Not yet a complete Tax Invoice'}
      data-testId="invoice-compliance-warnings"
    >
      <ul>
        {warnings.map((warning) => (
          <li key={warning.code}>
            {warning.message}
            {warning.lines?.length ? ` (line ${warning.lines.join(', ')})` : ''}
          </li>
        ))}
      </ul>
    </WarningsCallout>
  );
}

const WarningsCallout = styled(Callout)`
  margin-bottom: 20px;

  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
`;
