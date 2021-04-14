/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import { Paper, Tooltip, Typography } from '@material-ui/core';
import React from 'react';
import ErrorIcon from '@material-ui/icons/Clear';
import { VertexType } from '../util/Minihost3Loader';

// const bg = grey[100];

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(1) / 2,
    display: 'flex',
    flexDirection: 'row',
    flexShrink: 0,
  },
  pos: {
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.grey[500],
    flex: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    borderBottomLeftRadius: 5,
    borderTopLeftRadius: 5,
    minWidth: '1.2rem',
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
    paddingRight: theme.spacing(1),
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
}));

type Props = {
  info?: Record<string, unknown>;
  error?: Error | string;
} & PosProps;

type PosProps = {
  x: number;
  y: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ValueType<T = string | number> = { name?: string; value?: T; index?: number | string };

const Temperature: React.FC<ValueType> = ({ value }) => {
  const classes = useStyles();
  return (
    <tr>
      <td className={classes.name}>
        <Typography variant="body2" classes={{ root: classes.typo }}>
          T
        </Typography>
      </td>
      <td className={classes.value}>
        <Typography variant="body2">
          <strong>{value}</strong>
        </Typography>
      </td>
      <td className={classes.unit}>
        <Typography variant="body2">&deg;C</Typography>
      </td>
    </tr>
  );
};

const VertexElement: React.FC<ValueType> = ({ name, value, index }) => {
  const classes = useStyles();
  return (
    <tr>
      <td className={classes.name}>
        <Typography variant="body2">
          {name}
          <sub>{index}</sub>
        </Typography>
      </td>
      <td className={classes.value}>
        <Typography variant="body2">
          <strong>{value}</strong>
        </Typography>
      </td>
    </tr>
  );
};

const Voltage: React.FC<ValueType> = ({ value, index }) => {
  const classes = useStyles();
  return (
    <tr>
      <td className={classes.name}>
        <Typography variant="body2">
          V<sub>{index}</sub>
        </Typography>
      </td>
      <td className={classes.value}>
        <Typography variant="body2">
          <strong>{value !== undefined && Number(value) / 1000}</strong>
        </Typography>
      </td>
      <td className={classes.unit}>
        <Typography variant="body2">В</Typography>
      </td>
    </tr>
  );
};

const Vertex: React.FC<ValueType<VertexType>> = ({ name, value }) => (
  <>
    <VertexElement value={value && value.x} index={name} name="X" />
    <VertexElement value={value && value.y} index={name} name="Y" />
  </>
);

const Row: React.FC<ValueType> = ({ value, name }) => {
  const [, title, sub] = name?.match(/([^(]*)(?:\(?(.*)\))?/) ?? [null, name, null];
  const classes = useStyles();
  return (
    <tr>
      <td className={classes.name}>
        <Typography variant="body2">
          {title}
          <sub>{sub}</sub>
        </Typography>
      </td>
      <td className={classes.value}>
        <Typography variant="body2">
          <strong>{value}</strong>
        </Typography>
      </td>
      <td className={classes.unit}>&nbsp;</td>
    </tr>
  );
};

type PropRenderType = Record<string, (props: ValueType<unknown>) => React.ReactElement>;

const propMap: PropRenderType = {
  t: ({ value }) => <Temperature value={value as number} />,
  v1: ({ value }) => <Voltage value={value as number} index={1} />,
  v2: ({ value }) => <Voltage value={value as number} index={2} />,
  redVertex: ({ value }) => <Vertex value={value as VertexType} name="R" />,
  greenVertex: ({ value }) => <Vertex value={value as VertexType} name="G" />,
  blueVertex: ({ value }) => <Vertex value={value as VertexType} name="B" />,
  default: ({ value, ...props }) => <Row value={value as string | number | undefined} {...props} />,
};

const Position: React.FC<PosProps> = ({ x, y }) => {
  const classes = useStyles();
  return (
    <div className={classes.pos}>
      <div className={classes.xpos}>
        <Typography variant="caption" color="inherit">
          <b>{x}</b>
        </Typography>
      </div>
      <div className={classes.ypos}>
        <Typography variant="caption" color="inherit">
          <b>{y}</b>
        </Typography>
      </div>
    </div>
  );
};

const ModuleInfo: React.FC<Props> = ({ info, error, x, y }) => {
  const classes = useStyles();
  return (
    <Paper className={classes.root} elevation={1}>
      <Position x={x} y={y} />
      {error && (
        <Tooltip title={error} enterDelay={300}>
          <div className={classes.error}>
            <ErrorIcon />
          </div>
        </Tooltip>
      )}
      {info && (
        <table className={classes.table}>
          <tbody>
            {Object.entries(info).map(([name, value]) => {
              const ModuleRow = propMap[name] ?? propMap.default;
              return <ModuleRow key={name} name={name} value={value} />;
            })}
          </tbody>
        </table>
      )}
    </Paper>
  );
};

// export default compose<Props, Props>(hot, React.memo)(ModuleInfo);
export default ModuleInfo;
