/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable no-bitwise */
import { makeStyles } from '@material-ui/core/styles';
import { Button, FormControl, FormHelperText, IconButton } from '@material-ui/core';
import FolderIcon from '@material-ui/icons/FolderOpen';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import { Kind, KindMap } from '@nibus/core';
import classNames from 'classnames';
import { ipcRenderer } from 'electron';
import React, { memo, useCallback, useState } from 'react';
import { useSelector } from '../store';
import { selectAutobrightness, selectOverheatProtection } from '../store/configSlice';
import { selectCurrentDevice } from '../store/currentSlice';
import { getStatesAsync } from '../util/helpers';
import FilenameEllipsis from './FilenameEllipsis';
import FormFieldSet from './FormFieldSet';
import Selector from './Selector';

export type Props = {
  kind: Kind;
  onFlash: (
    kind: Kind | false,
    filename: string | undefined,
    moduleSelect?: number,
    column?: number,
    row?: number
  ) => void;
  hidden?: boolean;
};

const useStyles = makeStyles(theme => ({
  hidden: {
    display: 'none',
  },
  file: {
    display: 'flex',
    alignItems: 'center',
  },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: `calc(100% - 48px - ${theme.spacing(1)}px)`,
    // padding: '5px 15px',
    // border: `1px solid ${theme.palette.action.disabledBackground}`,
    borderRadius: theme.shape.borderRadius,
    marginRight: theme.spacing(1),
  },
  button: {
    flexGrow: 0,
    flexShrink: 0,
  },
  selectors: {
    display: 'flex',
    flexWrap: 'wrap',
    // padding: theme.spacing(1),
    alignItems: 'flex-end',
    '& > *': {
      // flex: `0 1 12ch`,
      margin: theme.spacing(1),
    },
  },
  selector: {
    flex: `0 1 12ch`,
  },
  reset: {
    flex: '0 0 auto',
    marginLeft: 'auto',
  },
  write: {
    flexShrink: 0,
  },
  root: {
    width: '100%',
    padding: theme.spacing(1),
  },
  set: {
    width: '100%',
  },
  invisible: {
    visibility: 'hidden',
  },
}));

export const displayName = (kind: string): string => {
  switch (kind) {
    case 'rbf':
      return 'FPGA';
    case 'ctrl':
      return 'MCU';
    default:
      return kind.toUpperCase();
  }
};

const FlashUpgrade: React.FC<Props> = ({ kind, onFlash, hidden = false }) => {
  const classes = useStyles();
  const [ext, isModule] = KindMap[kind];
  const [file, setFile] = useState('');
  const [column, setColumn] = useState(0);
  const [row, setRow] = useState(0);
  const { enabled = false } = useSelector(selectOverheatProtection) ?? {};
  const autobrightness = useSelector(selectAutobrightness);
  const { isBusy = 0 } = useSelector(selectCurrentDevice) ?? {};
  const selectFileHandler = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    _ => {
      const fileNames: string[] | undefined = ipcRenderer.sendSync('showOpenDialogSync', {
        title: 'Выбор файла прошивки',
        filters: [{ extensions: [ext], name: kind }],
        properties: ['openFile'],
      } as Electron.OpenDialogSyncOptions);
      const firmware = fileNames?.[0];
      if (firmware) {
        setFile(firmware);
      }
    },
    [ext, kind, setFile]
  );
  const flashHandler = useCallback<React.MouseEventHandler>(
    async _ => {
      const [, needModuleSelect] = KindMap[kind];
      const [x, y, filename] = await getStatesAsync(setColumn, setRow, setFile);
      const moduleArgs = needModuleSelect ? [(x << 8) | (y & 0xff), x, y] : [];
      onFlash(kind, filename, ...moduleArgs);
    },
    [kind, onFlash, setColumn, setRow, setFile]
  );
  const resetHandler = (): void => {
    const moduleArgs = [];
    onFlash(false, undefined, (column << 8) | (row & 0xff), column, row);
  };
  return (
    <div className={classNames(classes.root, { [classes.hidden]: hidden })}>
      <FormFieldSet className={classes.set} legend={displayName(kind)}>
        <div className={classes.file}>
          <FilenameEllipsis
            filename={file}
            className={classes.name}
            placeholder={`Выберите файл (*.${ext ?? '*'})`}
          />
          <IconButton
            aria-label={`upgrade-${kind}`}
            onClick={selectFileHandler}
            className={classes.button}
          >
            <FolderIcon />
          </IconButton>
        </div>
        <div className={classes.selectors}>
          <Selector
            label="Столб"
            groupName="Все"
            value={column}
            onChange={setColumn}
            max={23}
            className={classNames({ [classes.invisible]: !isModule }, classes.selector)}
          />
          <Selector
            label="Ряд"
            groupName="Все"
            value={row}
            onChange={setRow}
            max={255}
            className={classNames({ [classes.invisible]: !isModule }, classes.selector)}
          />
          <Button className={classes.reset} onClick={resetHandler}>
            Сброс
          </Button>
          <FormControl className={classes.write}>
            <FormHelperText
              className={classNames({ [classes.invisible]: !enabled })}
              error
              margin="dense"
            >
              {'\u26a0'}Защита от перегрева
            </FormHelperText>
            <FormHelperText
              className={classNames({ [classes.invisible]: !autobrightness })}
              error
              margin="dense"
            >
              {'\u26a0'}Автояркость
            </FormHelperText>
            <Button
              variant="contained"
              color="default"
              startIcon={<SaveAltIcon />}
              disabled={!file || enabled || autobrightness || isBusy > 0}
              onClick={flashHandler}
            >
              Прошить
            </Button>
          </FormControl>
        </div>
      </FormFieldSet>
    </div>
  );
};
export default memo(FlashUpgrade);
