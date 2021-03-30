/* eslint-disable no-bitwise */
/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import { Button, IconButton } from '@material-ui/core';
import FolderIcon from '@material-ui/icons/FolderOpen';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import { Kind, KindMap } from '@nibus/core';
import classNames from 'classnames';
import { ipcRenderer } from 'electron';
import React, { memo, useCallback, useState } from 'react';
// import { useFlashState } from '../providers/FlashStateProvider';
import { getStatesAsync } from '../util/helpers';
import FilenameEllipsis from './FilenameEllipsis';
import FormFieldSet from './FormFieldSet';
import Selector from './Selector';

export type Props = {
  kind: Kind;
  onFlash: (
    kind: Kind,
    filename: string,
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
      flex: `0 1 12ch`,
      margin: theme.spacing(1),
    },
  },
  write: {
    flex: '0 0 auto',
    marginLeft: 'auto',
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
  // const { column, row, file, setColumn, setRow, setFile } = useFlashState(kind);
  const [file, setFile] = useState('');
  const [column, setColumn] = useState(0);
  const [row, setRow] = useState(0);
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
            className={classNames({ [classes.invisible]: !isModule })}
          />
          <Selector
            label="Ряд"
            groupName="Все"
            value={row}
            onChange={setRow}
            max={255}
            className={classNames({ [classes.invisible]: !isModule })}
          />
          <Button
            variant="contained"
            color="default"
            className={classes.write}
            startIcon={<SaveAltIcon />}
            disabled={!file}
            onClick={flashHandler}
          >
            Прошить
          </Button>
        </div>
      </FormFieldSet>
    </div>
  );
};
export default memo(FlashUpgrade);
