import { Button, Dialog, DialogActions, DialogContent, InputAdornment } from '@mui/material';
import { Field, Form, Formik } from 'formik';
import React from 'react';

import FormikTextField from '../../common/FormikTextField';
import { updatePage, usePage } from '../api/config';
import CopyToClipboard from '../components/CopyToClipboard';
import DialogTitle from '../components/DialogTitle';

import { noop } from '/@common/helpers';

import { useDispatch } from '../store';

type Props = {
  pageId?: string;
  open?: boolean;
  onClose?: () => void;
};

const isValidParam = (param: string): boolean => {
  try {
    if (param.trim().startsWith('{')) JSON.parse(param);
    return true;
  } catch {
    return false;
  }
};

export const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(decodeURI(urlString));
    return [...url.searchParams.values()].reduce((res, value) => res && isValidParam(value), true);
  } catch (e) {
    return false;
  }
};

const HttpPageDialog: React.FC<Props> = ({ pageId, open = false, onClose = noop }) => {
  const { page } = usePage(pageId);
  const { url, title } = page ?? {};
  const dispatch = useDispatch();

  return (
    <Dialog
      open={open && page !== undefined}
      aria-labelledby="http-page-title"
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle id="http-page-title" onClose={onClose}>
        Параметры HTTP-страницы
      </DialogTitle>
      <DialogContent>
        <div className="tNX9k9byJD58qNs4nxAIi rlXINR-cZo5bnISD5TaUT LqiknX4bnpOZyEn5DYsUT">
          <Formik
            initialValues={{ url: url ? decodeURI(url) : '', title: title ?? '' }}
            onSubmit={props => {
              pageId && dispatch(updatePage(pageId, prev => ({ ...prev, ...props })));
              onClose?.();
            }}
            validate={props => {
              const errs: Partial<Record<keyof typeof props, string>> = {};
              if (!props.title) errs.title = 'Требуется';
              if (!props.url) errs.title = 'Требуется';
              else if (!isValidUrl(props.url)) errs.url = 'Неверный адрес';
              return errs;
            }}
          >
            <Form id="http-widget">
              <Field
                component={FormikTextField}
                variant="standard"
                name="url"
                label="URL"
                required
                fullWidth
                margin="normal"
                type="url"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <CopyToClipboard name="url" />
                    </InputAdornment>
                  ),
                }}
              />
              <Field
                component={FormikTextField}
                variant="standard"
                name="title"
                label="Заголовок"
                required
                fullWidth
                margin="normal"
              />
            </Form>
          </Formik>
        </div>
      </DialogContent>
      <DialogActions>
        <Button type="submit" form="http-widget" disabled={!page}>
          Ok
        </Button>
        <Button onClick={onClose}>Отмена</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HttpPageDialog;
