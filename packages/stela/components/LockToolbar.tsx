import React, { useCallback } from 'react';
import Typography from '@material-ui/core/Typography';
import { withStyles, createStyles, WithStyles, Theme } from '@material-ui/core/styles';
import IconButton, { IconButtonProps } from '@material-ui/core/IconButton';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import Fab from '@material-ui/core/Fab';
import AddIcon from '@material-ui/icons/Add';
import { compose } from 'recompose';

const styles = (theme: Theme) => createStyles({
  heading: {
    // fontSize: theme.typography.pxToRem(15),
    // fontWeight: theme.typography.fontWeightRegular,
    flexGrow: 1,
  },
  root: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
  },
  margin: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
});

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export interface Props extends Omit<IconButtonProps, 'classes' | 'onChange'> {
  title: string;
  // label?: string;
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  onAdd?: () => void;
}

type InnerProps = Props & WithStyles<typeof styles>;

const LockToolbar = ({ title, classes, checked, onChange, onAdd, ...props }: InnerProps) => {
  const handleChange = useCallback(
    (e) => {
      onChange && onChange(e.target, !checked);
      e.stopPropagation();
    },
    [onChange],
  );

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      onAdd && onAdd();
      e.stopPropagation();
    },
    [onAdd],
  );

  return (
    <div className={classes.root}>
      <Typography variant={'h6'} className={classes.heading}>{title}</Typography>
      <IconButton
        onClick={handleChange}
        title="Изменить настройки"
        {...props}
        className={classes.margin}
        color="primary"
      >
        {checked ? <LockIcon /> : <LockOpenIcon />}
      </IconButton>
      <Fab
        color={'secondary'}
        aria-label={'Add'}
        size={'medium'}
        disabled={checked}
        className={classes.margin}
        onClick={handleAdd}
        title="Добавить позицию"
      >
        <AddIcon />
      </Fab>
    </div>
  );
};

export default compose<InnerProps, Props>(
  React.memo,
  withStyles(styles),
)(LockToolbar);
