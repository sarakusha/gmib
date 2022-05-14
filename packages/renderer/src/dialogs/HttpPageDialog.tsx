import { Dialog, DialogContent, TextField } from '@mui/material';
import React from 'react';

import DialogTitle from '../components/DialogTitle';
import { useSelector } from '../store';

import type { Page } from '/@common/config';
import { noop } from '/@common/helpers';

import {selectPageById} from '../store/selectors';

type Props = {
  pageId?: string;
  open?: boolean;
  onClose?: () => void;
  onChange?: (name: keyof Page, value: string) => void;
};

// const useStyles = makeStyles(theme => ({
//   root: {},
// }));

const HttpPageDialog: React.FC<Props> = ({
  pageId,
  open = false,
  onClose = noop,
  onChange = noop,
}) => {
  // const classes = useStyles();
  const changeHandler: React.ChangeEventHandler<HTMLInputElement> = event => {
    const { name, value } = event.target;
    onChange(name as keyof Page, value);
  };
  const page = useSelector(state => selectPageById(state, pageId ?? ''));
  const { url, title } = page ?? {};
  return (
    <Dialog
      open={open && page !== undefined}
      aria-labelledby="http-page-title"
      onClose={onClose}
      onKeyDown={({ key }) => (key === 'Enter' || key === 'Escape') && onClose()}
    >
      <DialogTitle id="http-page-title" onClose={onClose}>
        Параметры HTTP-страницы
      </DialogTitle>
      <DialogContent>
        <TextField
          variant="standard"
          name="url"
          value={url ?? ''}
          onChange={changeHandler}
          label="URL"
          required
          fullWidth
          margin="normal"
        />
        <TextField
          variant="standard"
          name="title"
          value={title ?? ''}
          onChange={changeHandler}
          label="Заголовок"
          required
          fullWidth
          margin="normal"
        />
      </DialogContent>
    </Dialog>
  );
};

export default HttpPageDialog;
