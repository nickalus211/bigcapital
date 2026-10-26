// @ts-nocheck
import { FormGroup, Classes, Intent } from '@blueprintjs/core';
import classNames from 'classnames';
import React, { useRef, useCallback, useMemo } from 'react';
import intl from 'react-intl-universal';
import { AccountsSuggestField } from '@/components';
import { CellType } from '@/constants';
import { useCellAutoFocus } from '@/hooks';

/**
 * Account cell renderer.
 */
export default function AccountCellRenderer({
  column: {
    id,
    accountsDataProp,
    filterAccountsByRootTypes,
    filterAccountsByTypes,
    fieldProps,
    formGroupProps,
  },
  row: { index, original },
  cell: { value: initialValue },
  payload: {
    accounts: defaultAccounts,
    updateData,
    errors,
    autoFocus,
    ...restPayloadProps
  },
}) {
  const accountRef = useRef();

  useCellAutoFocus(accountRef, autoFocus, id, index);

  // `onItemChange` rather than `onItemSelect`: the latter replaces the
  // suggest's own handler, which is what routes the "Create" option to the
  // new account dialog.
  const handleAccountChange = useCallback(
    (accountId) => {
      updateData(index, id, accountId);
    },
    [updateData, index, id],
  );
  const error = errors?.[index]?.[id];

  const accounts = useMemo(
    () => restPayloadProps[accountsDataProp] || defaultAccounts,
    [restPayloadProps, defaultAccounts, accountsDataProp],
  );

  return (
    <FormGroup
      intent={error ? Intent.DANGER : null}
      className={classNames(
        'form-group--select-list',
        'form-group--account',
        Classes.FILL,
      )}
      {...formGroupProps}
    >
      <AccountsSuggestField
        items={accounts}
        onItemChange={handleAccountChange}
        selectedValue={initialValue}
        filterByRootTypes={filterAccountsByRootTypes}
        filterByTypes={filterAccountsByTypes}
        inputProps={{
          inputRef: (ref) => (accountRef.current = ref),
          placeholder: intl.get('search'),
        }}
        openOnKeyDown={true}
        blurOnSelectClose={false}
        {...fieldProps}
      />
    </FormGroup>
  );
}
AccountCellRenderer.cellType = CellType.Field;
