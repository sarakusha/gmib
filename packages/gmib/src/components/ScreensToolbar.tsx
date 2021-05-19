/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { IconButton, Tooltip } from '@material-ui/core';
import LoadIcon from '@material-ui/icons/SystemUpdateAlt';
import SaveIcon from '@material-ui/icons/Save';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import React from 'react';
import { useSelector } from '../store';
import { ConfigState, sendConfig, selectConfig } from '../store/configSlice';
import { noop, Writeable } from '../util/helpers';

const load = (): void => {
  const [fileName]: string[] =
    ipcRenderer.sendSync('showOpenDialogSync', {
      title: 'Загрузить из',
      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
      properties: ['openFile'],
    } as Electron.OpenDialogSyncOptions) ?? [];
  if (fileName) {
    try {
      const data = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
      sendConfig(data);
    } catch (e) {
      ipcRenderer.sendSync('showErrorBox', 'Ошибка загрузки', 'Файл испорчен');
    }
  }
};

const save = (config: ConfigState): void => {
  const defaultName = `gmib.${config.screens.map(scr => `${scr.width}x${scr.height}`).join('.')}`;
  const fileName: string | undefined = ipcRenderer.sendSync('showSaveDialogSync', {
    title: 'Сохранить как',
    defaultPath: defaultName,
    filters: [
      {
        name: 'JSON',
        extensions: ['json'],
      },
    ],
  });
  if (fileName) {
    const clone: Partial<Writeable<ConfigState>> = JSON.parse(JSON.stringify(config));
    clone.pages = clone.pages?.filter(({ permanent }) => !permanent);
    delete clone.brightness;
    delete clone.loading;
    fs.writeFileSync(fileName, JSON.stringify(clone, null, 2));
  }
};

const ScreensToolbar: React.FC<{ readonly?: boolean; toggle?: () => void }> = ({
  readonly = true,
  toggle = noop,
}) => {
  const config = useSelector(selectConfig);
  return (
    <>
      <Tooltip title="Загрузить конфигурацию из файла">
        <IconButton color="inherit" onClick={() => load()}>
          <LoadIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Сохранить конфигурацию в файл">
        <IconButton color="inherit" onClick={() => save(config)}>
          <SaveIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={readonly ? 'Разблокировать' : 'Заблокировать'}>
        <IconButton onClick={toggle} color="inherit">
          {readonly ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
      </Tooltip>
    </>
  );
};

export default ScreensToolbar;
