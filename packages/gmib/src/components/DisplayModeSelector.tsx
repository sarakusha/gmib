/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React from 'react';
import { MenuItem, Select, SelectProps } from '@material-ui/core';
import { TestModeEnum } from '@novastar/native/build/main/generated/TestMode';

const modes: Partial<Record<TestModeEnum, string>> = {
  [TestModeEnum.Reserved1_Mode]: 'Видео',
  [TestModeEnum.Red_Mode]: 'Красный',
  [TestModeEnum.Green_Mode]: 'Зеленый',
  [TestModeEnum.Blue_Mode]: 'Синий',
  [TestModeEnum.White_Mode]: 'Белый',
  [TestModeEnum.HorizonLine_Mode]: 'Горизонтали',
  [TestModeEnum.VerticalLine_Mode]: 'Вертикали',
  [TestModeEnum.InclineLine_Mode]: 'Диагонали',
  [TestModeEnum.GrayIncrease_Mode]: 'Градиент',
  [TestModeEnum.Age_Mode]: 'Чередование',
};

const DisplayModeSelector: React.FC<SelectProps> = ({ children: _, value, ...props }) => (
  <Select
    {...props}
    value={value === TestModeEnum.Reserved2_Mode ? TestModeEnum.Reserved1_Mode : value}
  >
    {Object.entries(modes).map(([key, name]) => (
      <MenuItem key={key} value={key}>
        {name}
      </MenuItem>
    ))}
  </Select>
);

export default DisplayModeSelector;
