/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, { useCallback, MouseEvent } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';

const styles = (theme: Theme) => createStyles({
  card: {
    minWidth: 275,
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    fontSize: 14,
  },
  pos: {
    marginBottom: 12,
  },
});

type Props = {
  error: Error | string,
  onAction?: Function,
};
type InnerProps = Props & WithStyles<typeof styles>;

const ErrorCard = ({ error, classes, onAction }: InnerProps) => {
  const clickHandler = useCallback((event: MouseEvent) => onAction && onAction(), [onAction]);
  return (
    <Card className={classes.card}>
      <CardContent>
        <Typography className={classes.title} color="textSecondary" gutterBottom>
          Возникла ошибка!
        </Typography>
        <Typography variant="h6">
          {(error as Error).message || error}
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small" onClick={clickHandler}>Обновить</Button>
      </CardActions>
    </Card>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(ErrorCard);
