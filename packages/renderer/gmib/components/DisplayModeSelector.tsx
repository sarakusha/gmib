
import type { SelectProps } from '@mui/material';
import { MenuItem, Select } from '@mui/material';
import { TestModeEnum } from '@novastar/native/TestMode';
import React from 'react';


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
