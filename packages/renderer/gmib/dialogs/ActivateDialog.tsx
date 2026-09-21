import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { Field, Form, Formik, useFormikContext } from 'formik';
import * as React from 'react';

import { charValidator } from '/@common/keyValidator';
import type { LicenseRuntimeState } from '/@common/license';

import FormikTextField from '../../common/FormikTextField';
import { useActivateMutation, useRetryLicenseMutation } from '../api/config';
import { canRetryStoredLicense } from '../licenseRecovery';
import { useDispatch, useSelector } from '../store';
import { setActivateDialogOpen } from '../store/currentSlice';
import { selectHostName, selectIsActivateDialogOpen } from '../store/selectors';

import {
  activationErrorMessage,
  type ActivationFormValues,
  hasControlCharacters,
  isActivationSubmitKey,
  normalizeActivationKey,
  normalizeDeviceName,
} from './activationForm';

const AutoFillKey = ({ field = 'key' }: { field?: string }) => {
  const { setFieldValue } = useFormikContext<ActivationFormValues>();
  React.useEffect(() => {
    void navigator.clipboard
      .readText()
      .then(value => {
        const key = normalizeActivationKey(value);
        if (charValidator(key)) void setFieldValue(field, key);
        // else window.license().then(lic => setFieldValue(field, lic.key));
      })
      .catch(() => undefined);
  }, [field, setFieldValue]);
  return null;
};

const AutoFillName = ({ fallbackName }: { fallbackName?: string }) => {
  const { setValues } = useFormikContext<ActivationFormValues>();
  React.useEffect(() => {
    void window
      .getDeviceName()
      .then(deviceName => {
        const name = normalizeDeviceName(deviceName || fallbackName);
        if (name) {
          void setValues(current =>
            current.name.trim() ? current : { ...current, name },
          );
        }
      })
      .catch(() => undefined);
  }, [fallbackName, setValues]);
  return null;
};

const ActivateDialog: React.FC<{ licenseState?: LicenseRuntimeState }> = ({ licenseState }) => {
  const open = useSelector(selectIsActivateDialogOpen);
  const dispatch = useDispatch();
  const hostName = useSelector(selectHostName);
  const [activate, { error, reset }] = useActivateMutation();
  const [retryLicense, retryState] = useRetryLicenseMutation();
  const canRetry = canRetryStoredLicense(licenseState?.status);
  const closeHandler = () => {
    dispatch(setActivateDialogOpen(false));
    reset();
    retryState.reset();
  };
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>Активация</DialogTitle>
      <Formik<ActivationFormValues>
        initialValues={{ name: normalizeDeviceName(hostName), key: '' }}
        onSubmit={async ({ key, name }, { setSubmitting }) => {
          reset();
          try {
            await activate({ key: normalizeActivationKey(key).trim(), name: name.trim() }).unwrap();
            dispatch(setActivateDialogOpen(false));
          } catch (activationError) {
            console.error(activationError);
          } finally {
            setSubmitting(false);
          }
        }}
        validate={values => {
          const errs: Partial<Record<keyof ActivationFormValues, string>> = {};
          if (!values.key.trim()) errs.key = 'Введите ключ';
          else if (!charValidator(values.key)) errs.key = 'Неправильный ключ';

          const name = values.name.trim();
          if (!name) errs.name = 'Введите имя устройства';
          else if (name.length > 200) errs.name = 'Не более 200 символов';
          else if (hasControlCharacters(name)) errs.name = 'Недопустимые символы';
          return errs;
        }}
      >
        {({ isSubmitting, setFieldValue }) => (
          <>
            <DialogContent>
              {canRetry && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      disabled={retryState.isLoading || isSubmitting}
                      onClick={() =>
                        void retryLicense()
                          .unwrap()
                          .catch(() => undefined)
                      }
                    >
                      Повторить
                    </Button>
                  }
                >
                  {licenseState?.message || 'Можно повторить проверку сохранённой лицензии.'}
                </Alert>
              )}
              <Form id="license">
                <Field
                  label="Ключ"
                  required
                  name="key"
                  component={FormikTextField}
                  fullWidth
                  margin="normal"
                  autoFocus
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    void setFieldValue('key', normalizeActivationKey(event.target.value))
                  }
                />
                <Field
                  label="Имя устройства"
                  title="Имя, под которым устройство будет видно при удалённом подключении"
                  required
                  name="name"
                  component={FormikTextField}
                  fullWidth
                  margin="normal"
                  inputProps={{ maxLength: 200 }}
                />
                <AutoFillKey />
                <AutoFillName fallbackName={hostName} />
              </Form>
              {(error || retryState.error) && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {activationErrorMessage(error || retryState.error) || 'Не удалось активировать'}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                color="primary"
                type="submit"
                form="license"
                disabled={isSubmitting}
                startIcon={
                  isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined
                }
                onKeyDown={event => {
                  if (isActivationSubmitKey(event.key)) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              >
                {isSubmitting ? 'Активация…' : 'Активировать'}
              </Button>
              <Button onClick={closeHandler} color="primary" disabled={isSubmitting}>
                Отмена
              </Button>
            </DialogActions>
          </>
        )}
      </Formik>
    </Dialog>
  );
};

export default ActivateDialog;
