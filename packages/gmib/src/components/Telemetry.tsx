/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { CircularProgress, IconButton, Paper, Tooltip, Typography } from '@material-ui/core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import StartIcon from '@material-ui/icons/Refresh';
import CancelIcon from '@material-ui/icons/Cancel';
import MinihostLoader, { IModuleInfo } from '../util/MinihostLoader';
import { useDevicesContext } from './DevicesProvier';
import { useDevice } from './DevicesStateProvider';
import ModuleInfo from './ModuleInfo';
import { useToolbar } from './ToolbarProvider';
import Range from './Range';
import Minihost3Loader, { Minihost3Info } from '../util/Minihost3Loader';
import Minihost2Loader, { Minihost2Info } from '../util/Minihost2Loader';

const styles = (theme: Theme) => createStyles({
  root: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gridTemplateRows: 'auto 1fr',
    gridTemplateAreas: `
      "corner hRange"
      "vRange main"
    `,
  },
  main: {
    gridArea: 'main',
    display: 'flex',
    overflow: 'auto',
  },
  grid: {
    display: 'grid',
    gridAutoFlow: 'column',
  },
  hRange: {
    gridArea: 'hRange',
    width: '36ch',
    marginBottom: theme.spacing.unit * 3,
    marginTop: theme.spacing.unit * 3,
    marginLeft: theme.spacing.unit * 2,
  },
  vRange: {
    gridArea: 'vRange',
    marginTop: theme.spacing.unit * 2,
    marginLeft: theme.spacing.unit * 3,
    marginRight: theme.spacing.unit * 3,
    height: '48ch',
  },
  corner: {
    gridArea: 'corner',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.grey[500],
    '&>*': {
      padding: 2,
      textAlign: 'center',
    },
    margin: theme.spacing.unit / 2,
  },
  xpos: {
    borderBottom: '1px solid white',
  },
  ypos: {},
  fabProgress: {
    color: theme.palette.secondary.light,
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  wrapper: {
    // margin: theme.spacing.unit,
    position: 'relative',
  },
});

type Props = {
  id: string,
  active?: boolean,
};

type InnerProps = Props & WithStyles<typeof styles>;
const Telemetry: React.FC<InnerProps> = ({ classes, id, active = true }) => {
  const { props, device } = useDevice(id);
  const mib = device ? Reflect.getMetadata('mib', device) : '';
  const loader = useMemo<MinihostLoader<Minihost2Info|Minihost3Info> | null>(
    () => {
      switch (mib) {
        case 'minihost3':
          return new Minihost3Loader(device!);
        case 'minihost_v2.06b':
          return new Minihost2Loader(device!);
        default:
          return null;
      }
    },
    [device],
  );
  const { hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV } = props;
  const [xMax, setXMax] = useState<number | undefined>();
  const [xMin, setXMin] = useState<number>(0);
  const [yMax, setYMax] = useState<number | undefined>();
  const [yMin, setYMin] = useState(0);
  const [dirv, setDirv] = useState(false);
  const [dirh, setDirh] = useState(false);
  const [style, setStyle] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(
    () => {
      if (!hres || !vres) return;
      setXMax(Math.min(Math.ceil(hres / (moduleHres || hres)), maxModulesH || 24) - 1);
      setYMax(Math.min(Math.ceil(vres / (moduleVres || vres)), maxModulesV || 32) - 1);
    },
    [[hres, vres, moduleHres, moduleVres, maxModulesH]
      .reduce((result, prop) => result && Number.isFinite(prop), true)],
  );

  useEffect(
    () => {
      setDirv(!!loader && loader.isInvertV());
      setDirh(!!loader && loader.isInvertH());
    },
    [props.dirv, props.dirh, props.vinvert, props.hinvert],
  );

  const [modules, setModules] = useState<any[]>([]);
  const refRange = useRef({
    xMin,
    xMax,
    yMin,
    yMax,
  });
  const start = useCallback(
    () => {
      const { xMin, xMax, yMin, yMax } = refRange.current;
      setStyle({
        gridTemplateRows: `repeat(${yMax! - yMin + 1}, 1fr)`,
      });
      setModules([]);
      loader && loader.run({
        xMin,
        yMin,
        xMax: xMax!,
        yMax: yMax!,
      });
    },
    [loader, refRange],
  );
  useEffect(
    () => {
      refRange.current = {
        xMin,
        yMin,
        xMax,
        yMax,
      };
    },
    [xMin, xMax, yMin, yMax],
  );
  const cancel = useCallback(() => loader && loader.cancel(), []);
  const telemetryToolbar = useMemo(
    () => loading ? (
        <Tooltip title="Отменить опрос">
          <div className={classes.wrapper}>
            <IconButton onClick={cancel} color="inherit">
              <CancelIcon />
            </IconButton>
            <CircularProgress size={48} className={classes.fabProgress} />
          </div>
        </Tooltip>
      )
      : (
        <Tooltip title="Запустить опрос модулей" enterDelay={500}>
          <div className={classes.wrapper}>
            <IconButton onClick={start} color="inherit">
              <StartIcon />
            </IconButton>
          </div>
        </Tooltip>
      ),
    [start, cancel, loading],
  );
  const [, setToolbar] = useToolbar();
  const { current } = useDevicesContext();
  useEffect(
    () => setToolbar((toolbar: React.ReactNode) => {
      if (active && current === id) return telemetryToolbar;
      return toolbar === telemetryToolbar ? null : toolbar;
    }),
    [active, current, telemetryToolbar],
  );
  useEffect(
    () => {
      if (!loader) return;
      const columnHandler = (column: IModuleInfo<Minihost2Info|Minihost3Info>[]) => {
        setModules(modules => modules.concat(column));
      };
      const startHandler = () => setLoading(true);
      const finishHandler = () => setLoading(false);
      loader.on('column', columnHandler);
      loader.on('start', startHandler);
      loader.on('finish', finishHandler);
      return () => {
        loader.off('finish', finishHandler);
        loader.off('start', startHandler);
        loader.off('column', columnHandler);
      };
    },
    [loader],
  );

  return (
    <div className={classes.root}>
      <Paper className={classes.corner}>
        <div className={classes.xpos}>
          <Typography variant="caption" color="inherit"><b>{xMin}..{xMax}</b></Typography>
        </div>
        <div className={classes.ypos}>
          <Typography variant="caption" color="inherit"><b>{yMin}..{yMax}</b></Typography>
        </div>
      </Paper>
      <Range
        min={0}
        max={maxModulesH || 24}
        values={[xMin, xMax || 0]}
        className={classes.hRange}
        setMin={setXMin}
        setMax={setXMax}
        reverse={dirh}
      />
      <Range
        min={0}
        max={32}
        values={[yMin, yMax || 0]}
        className={classes.vRange}
        setMin={setYMin}
        setMax={setYMax}
        vertical
        reverse={!dirv}
        tooltipPos={'right'}
      />
      <div className={classes.main}>
        <div>
          <div className={classes.grid} style={style}>
            {modules.map(props => (
              <ModuleInfo
                key={`${props.y}:${props.x}`}
                {...props}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(Telemetry);
