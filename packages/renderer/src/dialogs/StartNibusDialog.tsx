import { Dialog, DialogContent, DialogContentText, DialogTitle, Paper } from '@mui/material';
import React from 'react';

// const useStyles = makeStyles(theme => ({
//   command: {
//     padding: theme.spacing(2),
//     marginTop: theme.spacing(1),
//   },
//   paperRoot: {
//     backgroundColor: theme.palette.grey[900],
//     fontFamily: 'Courier, Monaco, monospace',
//     color: 'white',
//   },
// }));

type Props = { open: boolean };
const StartNibusDialog: React.FC<Props> = ({ open }) => (
  <Dialog
    open={open}
    aria-labelledby="nibus-start-title"
    aria-describedby="nibus-start-description"
  >
    <DialogTitle id="nibus-start-title">Служба NiBUS не запущена</DialogTitle>
    <DialogContent>
      <DialogContentText id="nibus-start-description">
        Вы можете запустить службу командой:
        <br />
      </DialogContentText>
      <Paper
        sx={{
          p: 2,
          mt: 1,
          '&.MuiPaper-root': {
            bgcolor: 'grey.900',
            fontFamily: 'Courier, Monaco, monospace',
            color: 'white',
          },
        }}
        elevation={1}
      >
        &gt; nibus start
      </Paper>
    </DialogContent>
  </Dialog>
);

export default StartNibusDialog;
