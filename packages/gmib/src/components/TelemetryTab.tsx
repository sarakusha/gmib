/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import CancelIcon from '@material-ui/icons/Cancel';
import StartIcon from '@material-ui/icons/Refresh';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Filter1 from '@material-ui/icons/Filter1';
import Filter2 from '@material-ui/icons/Filter2';
import Filter3 from '@material-ui/icons/Filter3';
import Filter4 from '@material-ui/icons/Filter4';
import Filter5 from '@material-ui/icons/Filter5';
import Filter6 from '@material-ui/icons/Filter6';
import Filter7 from '@material-ui/icons/Filter7';
import Minihost3SelectorDialog from '../dialogs/Minihost3SelectorDialog';
import { useDevicesContext } from '../providers/DevicesProvier';
import { useDevice } from '../providers/DevicesStateProvider';
import { useToolbar } from '../providers/ToolbarProvider';
import Minihost2Loader, { Minihost2Info } from '../util/Minihost2Loader';
import Minihost3Loader, {
  initialSelectors,
  Minihost3Info,
  Minihost3Selector,
} from '../util/Minihost3Loader';
import MinihostLoader, { IModuleInfo } from '../util/MinihostLoader';
import ModuleInfo from './ModuleInfo';
import Range from './Range';
import type { Props } from './TabContainer';

const useStyles = makeStyles(theme => ({
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
}));

const icons = [Filter1, Filter2, Filter3, Filter4, Filter5, Filter6, Filter7] as const;

const TelemetryTab: React.FC<Props> = ({ id, selected = false }) => {
  const classes = useStyles();
  const { props, device } = useDevice(id);
  const mib = device ? Reflect.getMetadata('mib', device) : '';
  const [selectors, setSelectors] = useState<Set<Minihost3Selector>>(
    () => new Set(initialSelectors)
  );
  const [selectorOpen, setSelectorOpen] = useState(false);
  const openSelectorHandler = useCallback(() => setSelectorOpen(true), []);
  const closeSelectorHandler = useCallback((value: Set<Minihost3Selector>) => {
    setSelectors(value);
    setSelectorOpen(false);
  }, []);
  const loader = useMemo<MinihostLoader<Minihost2Info | Minihost3Info> | null>(() => {
    switch (mib) {
      case 'minihost3':
        return new Minihost3Loader(device!);
      case 'minihost_v2.06b':
        return new Minihost2Loader(device!);
      default:
        return null;
    }
  }, [device, mib]);
  const { hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV } = props;
  const [xMax, setXMax] = useState<number>();
  const [xMin, setXMin] = useState<number>(0);
  const [yMax, setYMax] = useState<number>();
  const [yMin, setYMin] = useState(0);
  const [dirv, setDirv] = useState(false);
  const [dirh, setDirh] = useState(false);
  const [style, setStyle] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hres || !vres) return;
    setXMax(Math.min(Math.ceil(hres / (moduleHres || hres)), maxModulesH || 24) - 1);
    setYMax(Math.min(Math.ceil(vres / (moduleVres || vres)), maxModulesV || 32) - 1);
  }, [hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV]);

  useEffect(
    () => {
      setDirv(!!loader && loader.isInvertV());
      setDirh(!!loader && loader.isInvertH());
    },
    // eslint-disable-next-line react/destructuring-assignment
    [props.dirv, props.dirh, props.vinvert, props.hinvert, loader]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [modules, setModules] = useState<any[]>([]);
  const refRange = useRef({ xMin, xMax, yMin, yMax });
  const start = useCallback(() => {
    /* eslint-disable no-shadow */
    const { xMin, xMax, yMin, yMax } = refRange.current;
    /* eslint-enable */
    setStyle({ gridTemplateRows: `repeat(${yMax! - yMin + 1}, 1fr)` });
    setModules([]);
    loader &&
      setSelectors(current => {
        loader.run({ xMin, yMin, xMax: xMax!, yMax: yMax!, selectors: current });
        return current;
      });
  }, [loader, refRange]);
  useEffect(() => {
    refRange.current = { xMin, yMin, xMax, yMax };
  }, [xMin, xMax, yMin, yMax]);
  const cancel = useCallback(() => loader && loader.cancel(), [loader]);
  const telemetryToolbar = useMemo(() => {
    const FilterIcon = icons[Math.max(selectors.size - 1, 0)];
    return (
      <>
        {mib === 'minihost3' && (
          <Tooltip title="Задать переменные">
            <div className={classes.wrapper}>
              <IconButton color="inherit" onClick={openSelectorHandler}>
                <FilterIcon />
              </IconButton>
            </div>
          </Tooltip>
        )}
        {loading ? (
          <Tooltip title="Отменить опрос">
            <div className={classes.wrapper}>
              <IconButton onClick={cancel} color="inherit">
                <CancelIcon />
              </IconButton>
              <CircularProgress size={48} className={classes.fabProgress} />
            </div>
          </Tooltip>
        ) : (
          <Tooltip title="Запустить опрос модулей" enterDelay={500}>
            <div className={classes.wrapper}>
              <IconButton onClick={start} color="inherit">
                <StartIcon />
              </IconButton>
            </div>
          </Tooltip>
        )}
      </>
    );
  }, [
    loading,
    classes.wrapper,
    classes.fabProgress,
    cancel,
    start,
    mib,
    selectors.size,
    openSelectorHandler,
  ]);
  const [, setToolbar] = useToolbar();
  const { current } = useDevicesContext();
  useEffect(
    () =>
      setToolbar((toolbar: React.ReactNode) => {
        if (selected && current === id) return telemetryToolbar;
        return toolbar === telemetryToolbar ? null : toolbar;
      }),
    [selected, current, id, setToolbar, telemetryToolbar]
  );
  useEffect(() => {
    if (!loader) return () => {};
    const columnHandler = (column: IModuleInfo<Minihost2Info | Minihost3Info>[]): void => {
      setModules(modls => modls.concat(column));
    };
    const startHandler = (): void => setLoading(true);
    const finishHandler = (): void => setLoading(false);
    loader.on('column', columnHandler);
    loader.on('start', startHandler);
    loader.on('finish', finishHandler);
    return () => {
      loader.off('finish', finishHandler);
      loader.off('start', startHandler);
      loader.off('column', columnHandler);
    };
  }, [loader]);

  return (
    <div className={classNames(classes.root, { [classes.hidden]: !selected })}>
      <Minihost3SelectorDialog
        open={selectorOpen}
        onClose={closeSelectorHandler}
        initial={selectors}
      />
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
            {modules.map(moduleProps => (
              <ModuleInfo key={`${moduleProps.y}:${moduleProps.x}`} {...moduleProps} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryTab;
