import { Button, Dialog, DialogActions, DialogContent, TextField } from '@mui/material';
import React from 'react';

import { usePage } from '../api/config';
import DialogTitle from '../components/DialogTitle';
import { useSelector } from '../store';

import type { Page } from '/@common/config';
import { noop } from '/@common/helpers';

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
  const { page } = usePage(pageId); // useSelector(state => selectPageById(state, pageId ?? ''));
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
        <div className="tNX9k9byJD58qNs4nxAIi rlXINR-cZo5bnISD5TaUT LqiknX4bnpOZyEn5DYsUT">
          <TextField
            variant="standard"
            name="url"
            value={url ?? ''}
            onChange={changeHandler}
            label="URL"
            required
            fullWidth
            margin="normal"
            type="url"
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
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ok</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HttpPageDialog;
