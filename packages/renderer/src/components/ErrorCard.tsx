
import { Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import React from 'react';

// const useStyles = makeStyles({
//   card: {
//     minWidth: 275,
//   },
//   bullet: {
//     display: 'inline-block',
//     margin: '0 2px',
//     transform: 'scale(0.8)',
//   },
//   title: {
//     fontSize: 14,
//   },
//   pos: {
//     marginBottom: 12,
//   },
// });

type Props = {
  error: Error | string;
  onAction?: () => void;
  onRelease?: () => void;
};

const ErrorCard: React.FC<Props> = ({ error, onAction, onRelease }) => (
  <Card sx={{ minWidth: 275 }}>
    <CardContent>
      <Typography sx={{ fontSize: '14px' }} color="textSecondary" gutterBottom>
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

// export default compose<Props, Props>(
//   hot,
//   React.memo,
// )(ErrorCard);

export default ErrorCard;
