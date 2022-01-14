/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Card, CardActions, CardContent, Button, Typography } from '@material-ui/core';

const useStyles = makeStyles({
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
  error: Error | string;
  onAction?: () => void;
  onRelease?: () => void;
};

const ErrorCard: React.FC<Props> = ({ error, onAction, onRelease }) => {
  const classes = useStyles();
  return (
    <Card className={classes.card}>
      <CardContent>
        <Typography className={classes.title} color="textSecondary" gutterBottom>
          Возникла ошибка!
        </Typography>
        <Typography variant="h6">{(error as Error).message || error}</Typography>
      </CardContent>
      <CardActions>
        {onAction && (
          <Button size="small" onClick={onAction}>
            Обновить
          </Button>
        )}
        {onRelease && (
          <Button size="small" onClick={onRelease}>
            Удалить
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

// export default compose<Props, Props>(
//   hot,
//   React.memo,
// )(ErrorCard);

export default ErrorCard;
