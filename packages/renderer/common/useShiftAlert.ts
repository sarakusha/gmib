import { useSnackbar } from 'notistack';
import React from 'react';

export default () => {
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  return React.useCallback(() => {
    enqueueSnackbar('Удерживайте Shift, чтобы удалить безвозвратно', {
      key: 'shiftAlert',
      variant: 'info',
      preventDuplicate: true,
      autoHideDuration: 3000,
      onClose: () => closeSnackbar(),
    });
  }, [closeSnackbar, enqueueSnackbar]);
};
