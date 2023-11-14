import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Field, Form, Formik, useFormikContext } from 'formik';
import * as React from 'react';

import { charValidator } from '/@common/keyValidator';

import FormikTextField from '../../common/FormikTextField';
import { useActivateMutation } from '../api/config';
import { useDispatch, useSelector } from '../store';
import { setActivateDialogOpen } from '../store/currentSlice';
import { selectHostName, selectIsActivateDialogOpen } from '../store/selectors';

const AutoFillKey = ({ field = 'key' }: { field?: string }) => {
  const { setFieldValue } = useFormikContext();
  React.useEffect(() => {
    navigator.clipboard.readText().then(key => {
      if (charValidator(key)) setFieldValue(field, key);
      // else window.license().then(lic => setFieldValue(field, lic.key));
    });
  }, [field, setFieldValue]);
  return null;
};

const ActivateDialog: React.FC = () => {
  const open = useSelector(selectIsActivateDialogOpen);
  const dispatch = useDispatch();
  const hostName = useSelector(selectHostName)?.replace(/\.local$/, '');
  const [activate, { error, reset }] = useActivateMutation();
  const closeHandler = () => {
    dispatch(setActivateDialogOpen(false));
    reset();
  };
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>Активация</DialogTitle>
      <DialogContent>
        <Formik
          initialValues={{ name: hostName, key: '' }}
          onSubmit={async ({ key, name }, { setSubmitting, setFieldError }) => {
            // const res = await window.activateLicense(key, name);
            activate({ key, name })
              .unwrap()
              .then(
                () => {
                  setSubmitting(false);
                  dispatch(setActivateDialogOpen(false));
                },
                err => {
                  console.error(err);
                  setFieldError('key', (err as Error).message);
                },
              );
          }}
          validate={values => {
            const errs: Partial<Record<keyof typeof values, string>> = {};
            if (values.key && !charValidator(values.key)) {
              errs.key = 'Неправильный ключ';
            }
            return errs;
          }}
        >
          <Form id="license">
            <Field
              label="Ключ"
              required
              name="key"
              component={FormikTextField}
              fullWidth
              margin="normal"
              autoFocus
            />
            <Field
              label="Имя устройства"
              title="Придумайте название для устройства"
              name="name"
              component={FormikTextField}
              fullWidth
              margin="normal"
            />
            <AutoFillKey />
          </Form>
        </Formik>
        {error && <Alert severity="error">{error as string}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button color="primary" type="submit" form="license">
          Активировать
        </Button>
        <Button onClick={closeHandler} color="primary">
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActivateDialog;
