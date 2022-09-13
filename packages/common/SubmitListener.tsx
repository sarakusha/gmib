import { useFormikContext } from 'formik';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import * as React from 'react';

const SubmitListener: React.FC = () => {
  const formik = useFormikContext();
  const [lastValues, updateState] = React.useState(formik.values);
  const originalSubmit = formik.submitForm;

  const submitForm = React.useMemo(
    () => debounce(originalSubmit, 200, { maxWait: 1000 }),
    [originalSubmit],
  );

  React.useEffect(() => {
    const valuesEqualLastValues = isEqual(lastValues, formik.values);
    const valuesEqualInitialValues = isEqual(formik.values, formik.initialValues);

    if (!valuesEqualLastValues) {
      updateState(formik.values);
    }

    if (!valuesEqualLastValues && !valuesEqualInitialValues && formik.isValid) {
      submitForm();
    }
  }, [formik.values, formik.isValid, lastValues, formik.initialValues, submitForm]);

  return null;
};

export default SubmitListener;
