import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import * as React from 'react';
import { Field, Form, Formik } from 'formik';
import { charGenerator, charValidator } from '/@common/keyValidator';
import fetchJson, { FetchError } from '../../common/fetchJson';

import { useDispatch, useSelector } from '../store';
import { setActivateDialogOpen } from '../store/currentSlice';
import { selectIsActivateDialogOpen } from '../store/selectors';
import FormikTextField from '../../common/FormikTextField';

// const login = async (password: string, host: string) => {
//   const routines = new SRPRoutines(new SRPParameters());
//   const client = new SRPClientSession(routines);
//   const identifier = window.identify.getIdentifier();
//   const [first, { salt, B }] = await Promise.all([
//     client.step1('gmib', password),
//     fetchJson<{ salt: string; B: string }>(`http://${host}/api/handshake/${identifier}`, {
//       cache: 'no-cache',
//     }),
//   ]);
//   const second = await first.step2(BigInt(salt), BigInt(B));
//   const { A, M1 } = second;
//   const { M2 } = await fetchJson<{ M2: string }>(`http://${host}/api/login/${identifier}`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       A: `0x${A.toString(16)}`,
//       M1: `0x${M1.toString(16)}`,
//     }),
//   });
//   await second.step3(BigInt(M2));
//   return second.S;
// };

const ActivateDialog: React.FC = () => {
  const open = useSelector(selectIsActivateDialogOpen);
  const dispatch = useDispatch();
  const closeHandler = () => dispatch(setActivateDialogOpen(false));
  // console.log('CHAR', charGenerator('0AVF-IOKW-MJ9'), charValidator('0AVF-IOKW-MJ9K'));
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>Активация</DialogTitle>
      <DialogContent>
        <Formik
          initialValues={{ name: '', key: '' }}
          onSubmit={async ({ key, name }, { setSubmitting, setFieldError }) => {
            const res = await window.activateLicense(key, name);
            if (res === true) {
              setSubmitting(false);
              dispatch(setActivateDialogOpen(false));
            } else {
              setFieldError('key', res);
            }
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
            />
            <Field
              label="Имя устройства"
              title="Придумайте название для устройства"
              name="name"
              component={FormikTextField}
              fullWidth
              margin="normal"
            />
          </Form>
        </Formik>
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
