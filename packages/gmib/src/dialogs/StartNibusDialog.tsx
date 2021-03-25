/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Paper from '@material-ui/core/Paper';
import React from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles(theme => ({
  command: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  paperRoot: {
    backgroundColor: theme.palette.grey[900],
    fontFamily: 'Courier, Monaco, monospace',
    color: 'white',
  },
}));

type Props = { open: boolean };
const StartNibusDialog: React.FC<Props> = ({ open }) => {
  const classes = useStyles();
  return (
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
        <Paper className={classes.command} classes={{ root: classes.paperRoot }} elevation={1}>
          &gt; nibus start
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default StartNibusDialog;
