/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Paper, Typography } from '@material-ui/core';
import React from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
// import grey from '@material-ui/core/colors/grey';
import ErrorIcon from '@material-ui/icons/clear';

// const bg = grey[100];

const styles = (theme: Theme) => createStyles({
  root: {
    margin: theme.spacing.unit / 2,
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 0,
    // marginTop: theme.spacing.unit,
  },
  pos: {
    // backgroundColor: bg,
    // color: grey[500], // theme.palette.getContrastText(bg),
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.grey[500],
    flex: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    borderBottomLeftRadius: 5,
    borderTopLeftRadius: 5,
    minWidth: '1.2rem',
    // width: theme.spacing.unit,
    '&>*': {
      padding: 2,
      textAlign: 'right',
    },
  },
  xpos: {
    borderBottom: '1px solid white',
  },
  ypos: {},
  table: {
    // backgroundColor: 'gray',
    minWidth: '5ch',
    flex: 0,
    borderCollapse: 'collapse',
    margin: 2,
  },
  typo: {
    fontSize: theme.typography.pxToRem(13),
  },
  name: {
    padding: 0,
    paddingRight: theme.spacing.unit,
    borderCollapse: 'collapse',
  },
  value: {
    textAlign: 'right',
    borderCollapse: 'collapse',
    padding: 0,
  },
  unit: {
    borderCollapse: 'collapse',
    padding: 0,
    opacity: 0.7,
  },
  error: {
    width: '100%',
    // fontSize: '300%',
    display: 'flex',
    opacity: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    '& > *': {
      margin: 0,
      fontSize: '300%',
    },
  },
});
type Props = {
  info?: Record<string, string | number | undefined>,
  error?: Error | string,
} & PosProps;

type PosProps = {
  x: number,
  y: number,
};

type StylesType = WithStyles<typeof styles>;
type InnerProps = Props & StylesType;
type ValueType = { name?: string, value?: string | number, index?: number, aux?: any } & StylesType;

const Temperature: React.FC<ValueType> = ({ classes, value }) => (
  <tr>
    <td className={classes.name}>
      <Typography variant="body2" classes={{ root: classes.typo }}>T</Typography>
    </td>
    <td className={classes.value}>
      <Typography variant="body2"><strong>{value}</strong></Typography>
    </td>
    <td className={classes.unit}>
      <Typography variant="body2">&deg;C</Typography>
    </td>
  </tr>
);

const Voltage: React.FC<ValueType> = ({ classes, value, index }) => (
  <tr>
    <td className={classes.name}>
      <Typography variant="body2">V<sub>{index}</sub></Typography>
    </td>
    <td className={classes.value}>
      <Typography variant="body2">
        <strong>{value !== undefined && Number(value) / 1000}</strong>
      </Typography>
    </td>
    <td className={classes.unit}>
      <Typography variant="body2">
        В
      </Typography>
    </td>
  </tr>
);

const Row: React.FC<ValueType> = ({ classes, value, name }) => {
  const [, title, sub] = name && name.match(/([^(]*)(?:\(?(.*)\))?/) || [null, name, null];
  return (
    <tr>
      <td className={classes.name}>
        <Typography variant="body2">{title}<sub>{sub}</sub></Typography>
      </td>
      <td className={classes.value}>
        <Typography variant="body2"><strong>{value}</strong></Typography>
      </td>
      <td className={classes.unit}>&nbsp;</td>
    </tr>
  );
};

type PropRenderType = Record<string,
  (props: ValueType) => React.ReactElement>;

const propMap: PropRenderType = {
  t: ({ value, classes }) => <Temperature value={value} classes={classes} />,
  v1: ({ value, classes }) => <Voltage value={value} classes={classes} index={1} />,
  v2: ({ value, classes }) => <Voltage value={value} classes={classes} index={2} />,
  default: props => <Row {...props} />,
};

const Position: React.FC<PosProps & StylesType> = ({ classes, x, y }) => (
  <div className={classes.pos}>
    <div className={classes.xpos}>
      <Typography variant="caption" color="inherit"><b>{x}</b></Typography>
    </div>
    <div className={classes.ypos}>
      <Typography variant="caption" color="inherit"><b>{y}</b></Typography>
    </div>
  </div>
);

const ModuleInfo: React.FC<InnerProps> = ({ classes, info, error, x, y }: InnerProps) => {
  return (
    <Paper className={classes.root} elevation={1}>
      <Position x={x} y={y} classes={classes} />
      {error && <div className={classes.error}><ErrorIcon /></div>}
      {info && <table className={classes.table}>
        <tbody>
        {Object.entries(info).map(([name, value]) => {
          const Row = propMap[name] || propMap.default;
          return <Row key={name} classes={classes} name={name} value={value} />;
        })}
        </tbody>
      </table>}
    </Paper>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(ModuleInfo);
