import React, { useRef, useCallback } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import { Field, Form, Formik, FormikActions } from 'formik';
import { TextField } from 'formik-material-ui';

export interface LoginProps {
  username?: string;
  password: string;
}

export type LoginResult = [boolean, { message?: string, passport?: { user: string } }];

export interface LoginDialogProps extends Partial<LoginProps> {
  isOpen: boolean;
  onSubmit?: (values: LoginProps) => Promise<LoginResult>;
}

const LoginForm = ({ isOpen, onSubmit, username, password }: LoginDialogProps) => {
  const formRef = useRef<Formik<LoginProps>>(null);
  const submitForm = useCallback(
    (e: React.MouseEvent) => {
      if (formRef.current) formRef.current.submitForm();
      e.stopPropagation();
    },
    [],
  );
  const onSubmitForm = useCallback(
    (values: LoginProps, formikActions: FormikActions<LoginProps>) => {
      onSubmit &&
      Promise
        .resolve(onSubmit(values))
        .then(([isOk, { message }]) => {
          formikActions.setSubmitting(false);
          if (!isOk) {
            formikActions.setFieldError('password', message || 'invalid password');
          }
        });
    },
    [onSubmit],
  );
  return (
    <Dialog open={isOpen} aria-labelledby="form-login-title" onClose={submitForm}>
      <DialogTitle id="form-login-title">Стела</DialogTitle>
      <DialogContent>
        <Formik
          initialValues={{
            username: username || 'admin',
            password: password || '',
          }}
          onSubmit={onSubmitForm}
          ref={formRef}
          enableReinitialize={true}
        >
          {({ errors }) => (
            <Form>
              {/*<Field*/}
                {/*autoFocus*/}
                {/*margin="dense"*/}
                {/*name="username"*/}
                {/*label="Логин"*/}
                {/*type="text"*/}
                {/*fullWidth*/}
                {/*component={TextField}*/}
              {/*/>*/}
              <Field
                margin="dense"
                name="password"
                label="Пароль"
                type="password"
                fullWidth
                component={TextField}
                errors={errors.password}
              />
            </Form>
          )}
        </Formik>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={submitForm}
          color="primary"
          fullWidth
          variant="contained"
          type="submit"
        >
          Войти
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginForm;
