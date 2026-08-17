import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { IconButtonProps } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';

import { useSetPlayerOutputVisibilityMutation } from '../api/player';
import { useDispatch, useSelector } from '../store';
import { setOutputHidden } from '../store/currentSlice';
import { selectOutputHidden } from '../store/selectors';

type Props = {
  size?: IconButtonProps['size'];
};

const OutputVisibilityButton: React.FC<Props> = ({ size }) => {
  const outputHidden = useSelector(selectOutputHidden);
  const dispatch = useDispatch();
  const [setOutputVisibility, { isLoading }] = useSetPlayerOutputVisibilityMutation();
  const toggleOutputVisibility = React.useCallback(() => {
    const visible = outputHidden;
    void setOutputVisibility(visible)
      .unwrap()
      .then(() => dispatch(setOutputHidden(!visible)))
      .catch(() => undefined);
  }, [dispatch, outputHidden, setOutputVisibility]);
  return (
    <IconButton
      size={size}
      color="inherit"
      disabled={isLoading}
      title={outputHidden ? 'Показать окно вывода' : 'Скрыть окно вывода'}
      onClick={toggleOutputVisibility}
    >
      {outputHidden ? (
        <VisibilityOffIcon fontSize="inherit" />
      ) : (
        <VisibilityIcon fontSize="inherit" />
      )}
    </IconButton>
  );
};

OutputVisibilityButton.displayName = 'OutputVisibilityButton';

export default OutputVisibilityButton;
