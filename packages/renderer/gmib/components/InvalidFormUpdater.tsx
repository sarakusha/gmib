import { useFormikContext } from 'formik';
import React from 'react';
import type { ActionCreatorWithPayload } from '@reduxjs/toolkit';
import { useDispatch } from '../store';

const InvalidFormUpdater: React.FC<{ action: ActionCreatorWithPayload<boolean> }> = ({
  action,
}) => {
  const { isValid } = useFormikContext();
  const dispatch = useDispatch();
  React.useEffect(() => {
    dispatch(action(!isValid));
  }, [isValid, action, dispatch]);
  return null;
};

export default InvalidFormUpdater;
