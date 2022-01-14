/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { makeStyles } from '@material-ui/core/styles';
import { Paper, Typography } from '@material-ui/core';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDevice, useDispatch, useSelector } from '../store';
import { selectCurrentDeviceId, selectCurrentTab } from '../store/currentSlice';
import { deviceBusy, deviceReady } from '../store/devicesSlice';
import { getStatesAsync, noop } from '../util/helpers';
import Minihost2Loader, { Minihost2Info } from '../util/Minihost2Loader';
import Minihost3Loader, { initialSelectors, Minihost3Info } from '../util/Minihost3Loader';
import MinihostLoader, { IModuleInfo } from '../util/MinihostLoader';
import ModuleInfo from './ModuleInfo';
import Range from './Range';
import type { MinihostTabProps } from './TabContainer';
import TelemetryToolbar from './TelemetryToolbar';

const XMAX = 24;
const YMAX = 32;

const useStyles = makeStyles(theme => ({
  root: {
    marginBottom: theme.spacing(1),
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gridTemplateRows: 'auto 1fr',
    gridTemplateAreas: `
      "corner hRange"
      "vRange main"
    `,
  },
  hidden: {
    display: 'none',
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
    marginBottom: theme.spacing(3),
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
  },
  vRange: {
    gridArea: 'vRange',
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(3),
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
    margin: theme.spacing(1) / 2,
  },
  xpos: {
    borderBottom: '1px solid white',
  },
  ypos: {},
}));

const TelemetryTab: React.FC<MinihostTabProps> = ({ id, selected = false }) => {
  const classes = useStyles();
  const { mib, props, isBusy = 0 } = useDevice(id) ?? {};
  const loader = useMemo<MinihostLoader<Minihost2Info | Minihost3Info> | null>(() => {
    if (!mib || !id) return null;
    switch (mib) {
      case 'minihost3':
        return new Minihost3Loader(id);
      case 'minihost_v2.06b':
        return new Minihost2Loader(id);
      default:
        return null;
    }
  }, [id, mib]);
  const { hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV } = props ?? {};
  const [xMax, setXMax] = useState<number>(XMAX - 1);
  const [xMin, setXMin] = useState<number>(0);
  const [yMax, setYMax] = useState<number>(YMAX - 1);
  const [yMin, setYMin] = useState(0);
  const [style, setStyle] = useState({});
  const [selectors, setSelectors] = useState(new Set(initialSelectors));
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!hres?.value || !vres?.value || !moduleHres || !moduleVres || !maxModulesH || !maxModulesV)
      return;
    setXMax(
      Math.min(
        Math.ceil(
          (hres.value as number) / ((moduleHres.value as number) || (hres.value as number))
        ),
        (maxModulesH.value as number) || XMAX
      ) - 1
    );
    setYMax(
      Math.min(
        Math.ceil(
          (vres.value as number) / ((moduleVres.value as number) || (vres.value as number))
        ),
        (maxModulesV.value as number) || YMAX
      ) - 1
    );
  }, [hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV]);

  const dirv = loader?.isInvertV() || false;
  const dirh = loader?.isInvertH() || false;
  const [modules, setModules] = useState<IModuleInfo<Minihost2Info | Minihost3Info>[]>([]);
  const start = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const [xMin, xMax, yMin, yMax, selectors] = await getStatesAsync(
      setXMin,
      setXMax,
      setYMin,
      setYMax,
      setSelectors
    );
    /* eslint-enable */
    setStyle({ gridTemplateRows: `repeat(${yMax! - yMin + 1}, 1fr)` });
    setModules([]);
    loader && (await loader.run({ xMin, yMin, xMax, yMax, selectors: [...selectors] }));
  }, [loader]);
  const cancel = useCallback(() => loader && loader.cancel(), [loader]);
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  const active = useSelector(selectCurrentDeviceId) === id && selected && tab === 'devices';
  const telemetryToolbar = useMemo(
    () => (
      <TelemetryToolbar
        mib={mib}
        selectors={selectors}
        onSelectorChanged={setSelectors}
        loading={loading}
        isBusy={isBusy}
        start={start}
        cancel={cancel}
      />
    ),
    [mib, selectors, loading, isBusy, start, cancel]
  );
  useEffect(() => {
    if (active) {
      setToolbar(telemetryToolbar);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar, telemetryToolbar]);
  useEffect(() => {
    if (!loader) return () => {};
    const columnHandler = (column: IModuleInfo<Minihost2Info | Minihost3Info>[]): void => {
      setModules(prev => prev.concat(column));
    };
    const startHandler = (): void => {
      setLoading(true);
      dispatch(deviceBusy(id));
    };
    const finishHandler = (): void => {
      setLoading(false);
      dispatch(deviceReady(id));
    };
    loader.on('column', columnHandler);
    loader.on('start', startHandler);
    loader.on('finish', finishHandler);
    return () => {
      loader.off('finish', finishHandler);
      loader.off('start', startHandler);
      loader.off('column', columnHandler);
    };
  }, [loader, dispatch, id]);

  return (
    <Paper className={classNames(classes.root, { [classes.hidden]: !selected })}>
      <Paper className={classes.corner}>
        <div className={classes.xpos}>
          <Typography variant="caption" color="inherit">
            <b>
              {xMin}..{xMax}
            </b>
          </Typography>
        </div>
        <div className={classes.ypos}>
          <Typography variant="caption" color="inherit">
            <b>
              {yMin}..{yMax}
            </b>
          </Typography>
        </div>
      </Paper>
      <Range
        min={0}
        max={(maxModulesH?.value as number) || 24}
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
            {modules.map(moduleProps => (
              <ModuleInfo key={`${moduleProps.y}:${moduleProps.x}`} {...moduleProps} />
            ))}
          </div>
        </div>
      </div>
    </Paper>
  );
};

export default React.memo(TelemetryTab);
